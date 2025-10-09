import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransferRequest {
  fromExchange: string;
  toExchange: string;
  asset: string;
  amount: number;
  networkOverride?: string; // Rede customizada selecionada pelo usuário
  binanceApiKey?: string;
  binanceSecretKey?: string;
  okxApiKey?: string;
  okxSecretKey?: string;
  okxPassphrase?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      fromExchange,
      toExchange,
      asset,
      amount,
      networkOverride, // Rede customizada
      binanceApiKey,
      binanceSecretKey,
      okxApiKey,
      okxSecretKey,
      okxPassphrase
    }: TransferRequest = await req.json();

    console.log(`💱 TRANSFERÊNCIA AUTOMÁTICA: ${amount} ${asset} de ${fromExchange} → ${toExchange}`);
    if (networkOverride) {
      console.log(`🎯 Rede customizada selecionada: ${networkOverride}`);
    } else {
      console.log(`⚡ Usando rede padrão (Arbitrum para ERC-20, ou nativa)`);
    }

    // Validar credenciais
    if (fromExchange === 'Binance' || toExchange === 'Binance') {
      if (!binanceApiKey || !binanceSecretKey) {
        throw new Error('Credenciais da Binance são obrigatórias');
      }
    }
    
    if (fromExchange === 'OKX' || toExchange === 'OKX') {
      if (!okxApiKey || !okxSecretKey || !okxPassphrase) {
        throw new Error('Credenciais da OKX são obrigatórias');
      }
    }

    let transferResult: any;
    let depositAddress: any;

    // Executar transferência baseada nas exchanges
    if (fromExchange === 'OKX' && toExchange === 'Binance') {
      console.log('📤 Passo 1/3: Obtendo endereço de depósito Binance...');
      depositAddress = await getBinanceDepositAddress(asset, binanceApiKey!, binanceSecretKey!, networkOverride);
      console.log(`📍 Endereço: ${depositAddress.address} (rede: ${depositAddress.network})`);
      
      console.log('📤 Passo 2/3: Iniciando saque da OKX...');
      transferResult = await executeOKXWithdrawal(
        asset,
        amount,
        depositAddress.address,
        depositAddress.network,
        { okxApiKey, okxSecretKey, okxPassphrase }
      );
      console.log(`✅ Saque iniciado! ID: ${transferResult.wdId}`);
      
      console.log('⏳ Passo 3/3: Aguardando confirmação Arbitrum (2-5 minutos)...');
      const confirmed = await waitForTransferConfirmation(
        toExchange,
        asset,
        amount,
        binanceApiKey,
        binanceSecretKey,
        8 * 60 * 1000 // 8 minutos timeout (Arbitrum é mais rápido)
      );
      
      if (!confirmed) {
        throw new Error('Timeout aguardando confirmação. Verifique manualmente nas exchanges.');
      }
      
    } else if (fromExchange === 'Binance' && toExchange === 'OKX') {
      console.log('📤 Passo 1/3: Obtendo endereço de depósito OKX...');
      depositAddress = await getOKXDepositAddress(asset, { okxApiKey, okxSecretKey, okxPassphrase });
      console.log(`📍 Endereço: ${depositAddress.address} (rede: ${depositAddress.network})`);
      
      console.log('📤 Passo 2/3: Iniciando saque da Binance...');
      transferResult = await executeBinanceWithdrawal(
        asset,
        amount,
        depositAddress.address,
        depositAddress.network,
        binanceApiKey!,
        binanceSecretKey!
      );
      console.log(`✅ Saque iniciado! ID: ${transferResult.id}`);
      
      console.log('⏳ Passo 3/3: Aguardando confirmação Arbitrum (2-5 minutos)...');
      const confirmed = await waitForTransferConfirmation(
        toExchange,
        asset,
        amount,
        undefined,
        undefined,
        8 * 60 * 1000, // 8 minutos timeout (Arbitrum é mais rápido)
        { okxApiKey, okxSecretKey, okxPassphrase }
      );
      
      if (!confirmed) {
        throw new Error('Timeout aguardando confirmação. Verifique manualmente nas exchanges.');
      }
      
    } else {
      throw new Error(`Transferência ${fromExchange} → ${toExchange} não suportada`);
    }

    console.log('🎉 TRANSFERÊNCIA CONCLUÍDA COM SUCESSO!');

    return new Response(
      JSON.stringify({
        success: true,
        transferId: transferResult.wdId || transferResult.id,
        fromExchange,
        toExchange,
        asset,
        amount,
        status: 'confirmed',
        depositAddress: depositAddress.address,
        network: depositAddress.network,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ ERRO NA TRANSFERÊNCIA:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// FUNÇÕES AUXILIARES

async function getBinanceDepositAddress(asset: string, apiKey: string, secretKey: string, networkOverride?: string) {
  const timestamp = Date.now();
  
  // Mapeamento correto de ativos → redes na Binance
  // PRIORIDADE: Arbitrum para tokens ERC-20 (mais rápido e barato)
  const networkMap: Record<string, string> = {
    'USDT': 'ARBITRUM',      // USDT via Arbitrum (2-5 min)
    'USDC': 'ARBITRUM',      // USDC via Arbitrum (2-5 min)
    'ETH': 'ARBITRUM',       // ETH via Arbitrum (2-5 min)
    'LINK': 'ARBITRUM',      // LINK via Arbitrum (2-5 min)
    'UNI': 'ARBITRUM',       // UNI via Arbitrum (2-5 min)
    'PEPE': 'ARBITRUM',      // PEPE via Arbitrum (2-5 min)
    'SHIB': 'ARBITRUM',      // SHIB via Arbitrum (2-5 min)
    
    // Redes nativas (sem suporte Arbitrum)
    'BTC': 'BTC',            // Bitcoin mainnet (10-60 min)
    'DOT': 'DOT',            // Polkadot mainnet (2-5 min)
    'ADA': 'ADA',            // Cardano mainnet (5-10 min)
    'SOL': 'SOL',            // Solana mainnet (1-2 min)
    'AVAX': 'AVAXC',         // Avalanche C-Chain (2-5 min)
    'ATOM': 'ATOM',          // Cosmos mainnet (3-7 min)
    'DOGE': 'DOGE',          // Dogecoin mainnet (5-10 min)
    'XRP': 'XRP',            // Ripple mainnet (1-3 min)
    'BNB': 'BSC',            // Binance Smart Chain (1-3 min)
    'FLOKI': 'ETH',          // FLOKI via Ethereum (não tem Arbitrum)
    'WIF': 'SOL',            // WIF é token Solana (1-2 min)
    'FIL': 'FIL',            // Filecoin mainnet (5-10 min)
    'LTC': 'LTC'             // Litecoin mainnet (5-15 min)
  };
  
  // Usar rede customizada se fornecida, senão usar mapeamento padrão
  const network = networkOverride || networkMap[asset] || asset;
  console.log(`📡 Buscando endereço de depósito Binance: ${asset} na rede ${network}${networkOverride ? ' (customizada)' : ''}`);
  
  const queryString = `coin=${asset}&network=${network}&timestamp=${timestamp}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const response = await fetch(
    `https://api.binance.com/sapi/v1/capital/deposit/address?${queryString}&signature=${signatureHex}`,
    {
      headers: { 'X-MBX-APIKEY': apiKey }
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro Binance deposit address: ${error}`);
  }
  
  const data = await response.json();
  return {
    address: data.address,
    network: network
  };
}

async function getOKXDepositAddress(
  asset: string,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
) {
  const timestamp = new Date().toISOString();
  const method = 'GET';
  const requestPath = `/api/v5/asset/deposit-address?ccy=${asset}`;
  
  const prehash = timestamp + method + requestPath;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(credentials.okxSecretKey!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': credentials.okxApiKey!,
      'OK-ACCESS-SIGN': signatureBase64,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase!,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro OKX deposit address: ${error}`);
  }
  
  const data = await response.json();
  if (data.code !== '0') {
    throw new Error(`OKX API Error: ${data.msg}`);
  }
  
  return {
    address: data.data[0].addr,
    network: data.data[0].chain
  };
}

// ⭐ NOVA FUNÇÃO: Verificar saldos em TODAS as contas da OKX (Trading + Funding)
async function getOKXAllBalances(
  asset: string,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
): Promise<{ trading: number; funding: number; total: number; location: string }> {
  console.log(`🔍 Verificando saldos de ${asset} em todas as contas OKX...`);
  
  // Verificar Trading Account
  let tradingBalance = 0;
  try {
    tradingBalance = await getOKXTradingAccountBalance(asset, credentials);
    console.log(`  📊 Trading Account: ${tradingBalance} ${asset}`);
  } catch (error) {
    console.warn('⚠️ Erro ao verificar Trading Account:', error);
  }
  
  // Verificar Funding Account
  let fundingBalance = 0;
  try {
    fundingBalance = await getOKXAvailableBalance(asset, credentials);
    console.log(`  💰 Funding Account: ${fundingBalance} ${asset}`);
  } catch (error) {
    console.warn('⚠️ Erro ao verificar Funding Account:', error);
  }
  
  const total = tradingBalance + fundingBalance;
  let location = 'none';
  if (tradingBalance > 0 && fundingBalance > 0) location = 'both';
  else if (tradingBalance > 0) location = 'trading';
  else if (fundingBalance > 0) location = 'funding';
  
  console.log(`  🎯 Total: ${total} ${asset} (localização: ${location})`);
  
  return { trading: tradingBalance, funding: fundingBalance, total, location };
}

async function getOKXTradingAccountBalance(
  asset: string,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
): Promise<number> {
  const timestamp = new Date().toISOString();
  const method = 'GET';
  const requestPath = `/api/v5/account/balance?ccy=${asset}`;
  
  const prehash = timestamp + method + requestPath;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(credentials.okxSecretKey!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': credentials.okxApiKey!,
      'OK-ACCESS-SIGN': signatureBase64,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase!,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao buscar saldo OKX Trading Account: ${error}`);
  }
  
  const data = await response.json();
  if (data.code !== '0' || !data.data || data.data.length === 0) {
    return 0;
  }
  
  // Buscar o saldo do asset específico
  const details = data.data[0].details || [];
  const assetDetail = details.find((d: any) => d.ccy === asset);
  
  if (!assetDetail) {
    return 0;
  }
  
  // availBal = saldo disponível para trading e transferências
  return parseFloat(assetDetail.availBal || '0');
}

async function transferOKXTradingToFunding(
  asset: string,
  amount: number,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
) {
  console.log(`🔄 Transferindo ${amount} ${asset} de Trading → Funding na OKX...`);
  
  // 🔍 VERIFICAR SALDO COM RETRY AUTOMÁTICO ESTENDIDO (garantir liquidação completa)
  const maxRetries = 8;
  const retryDelays = [5000, 8000, 12000, 18000, 25000, 30000, 40000, 50000]; // Total: até 188s (3+ minutos)
  
  console.log(`🎯 SISTEMA DE RETRY ESTENDIDO: Até ${maxRetries} tentativas para garantir transferência imediata`);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const tradingBalance = await getOKXTradingAccountBalance(asset, credentials);
      const percentageAvailable = (tradingBalance / amount) * 100;
      
      console.log(`💰 [Tentativa ${attempt + 1}/${maxRetries}] Saldo Trading Account:`);
      console.log(`   Disponível: ${tradingBalance} ${asset}`);
      console.log(`   Necessário: ${amount} ${asset}`);
      console.log(`   Percentual: ${percentageAvailable.toFixed(1)}%`);
      
      if (tradingBalance >= amount) {
        console.log('✅ SALDO COMPLETO DISPONÍVEL! Prosseguindo com transferência...');
        break; // Saldo OK, prosseguir
      }
      
      // Saldo insuficiente
      if (attempt < maxRetries - 1) {
        const waitTime = retryDelays[attempt];
        const totalWaited = retryDelays.slice(0, attempt + 1).reduce((a, b) => a + b, 0);
        console.log(`⏳ Aguardando ordem liquidar completamente...`);
        console.log(`   Próxima verificação em: ${waitTime/1000}s`);
        console.log(`   Tempo total aguardado: ${totalWaited/1000}s`);
        console.log(`   Progresso: ${percentageAvailable.toFixed(1)}% do necessário`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // Última tentativa falhou
        const totalWaitTime = retryDelays.reduce((a, b) => a + b, 0) / 1000;
        throw new Error(
          `❌ FALHA APÓS ${maxRetries} TENTATIVAS (${totalWaitTime}s total)\n` +
          `Saldo na Trading Account da OKX: ${tradingBalance} ${asset}\n` +
          `Necessário: ${amount} ${asset}\n` +
          `Faltam: ${(amount - tradingBalance).toFixed(8)} ${asset}\n` +
          `Possíveis causas:\n` +
          `• Ordem de compra foi parcialmente executada\n` +
          `• Liquidez insuficiente no momento\n` +
          `• Ordem ainda em processamento (improvável após ${totalWaitTime}s)\n` +
          `Verifique manualmente o saldo na OKX.`
        );
      }
    } catch (balanceError) {
      // Se for a última tentativa, repassar o erro
      if (attempt === maxRetries - 1) {
        console.error('❌ ERRO CRÍTICO ao verificar saldo:', balanceError);
        throw balanceError;
      }
      // Senão, aguardar e tentar novamente
      console.log(`⚠️ Erro temporário ao verificar saldo (tentativa ${attempt + 1}/${maxRetries})`);
      console.log(`⏳ Aguardando ${retryDelays[attempt]/1000}s antes de tentar novamente...`);
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
    }
  }
  
  const timestamp = new Date().toISOString();
  const method = 'POST';
  const requestPath = '/api/v5/asset/transfer';
  
  const body = JSON.stringify({
    ccy: asset,
    amt: amount.toString(),
    from: '18', // Trading account
    to: '6',    // Funding account
    type: '0'   // Internal transfer
  });
  
  const prehash = timestamp + method + requestPath + body;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(credentials.okxSecretKey!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method: 'POST',
    headers: {
      'OK-ACCESS-KEY': credentials.okxApiKey!,
      'OK-ACCESS-SIGN': signatureBase64,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase!,
      'Content-Type': 'application/json'
    },
    body
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro OKX transfer: ${error}`);
  }
  
  const data = await response.json();
  if (data.code !== '0') {
    throw new Error(`OKX Transfer Error: ${data.msg}`);
  }
  
  console.log(`✅ Transferência interna OKX concluída: ${amount} ${asset} → Funding`);
  return data;
}

async function getOKXAvailableBalance(
  asset: string,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
) {
  const timestamp = new Date().toISOString();
  const method = 'GET';
  const requestPath = '/api/v5/asset/balances?ccy=' + asset;
  
  const prehash = timestamp + method + requestPath;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(credentials.okxSecretKey!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': credentials.okxApiKey!,
      'OK-ACCESS-SIGN': signatureBase64,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase!,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro OKX balance: ${error}`);
  }
  
  const data = await response.json();
  if (data.code !== '0' || !data.data || data.data.length === 0) {
    return 0;
  }
  
  // Saldo disponível para withdrawal
  const availableBalance = parseFloat(data.data[0].availBal || '0');
  return availableBalance;
}

async function executeOKXWithdrawal(
  asset: string,
  amount: number,
  toAddress: string,
  network: string,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
) {
  // ⭐ PASSO 0: VERIFICAR SALDOS EM AMBAS AS CONTAS PRIMEIRO
  console.log(`🔍 PASSO 0: Verificando saldos em Trading e Funding...`);
  
  const balances = await getOKXAllBalances(asset, credentials);
  
  // Determinar se precisa fazer transferência interna
  let needsInternalTransfer = false;
  let amountToTransfer = 0;
  
  if (balances.total < amount) {
    throw new Error(
      `❌ SALDO TOTAL INSUFICIENTE NA OKX\n` +
      `Total disponível: ${balances.total} ${asset}\n` +
      `Necessário: ${amount} ${asset}\n` +
      `Trading: ${balances.trading} ${asset}\n` +
      `Funding: ${balances.funding} ${asset}\n` +
      `Deposite mais ${asset} ou aguarde ordens pendentes serem liquidadas.`
    );
  }
  
  // Se tem saldo suficiente na Funding, pular transferência interna
  if (balances.funding >= amount) {
    console.log(`✅ Saldo suficiente na Funding (${balances.funding} ${asset}). Pulando transferência interna.`);
    needsInternalTransfer = false;
  }
  // Se tem todo o saldo na Trading, transferir tudo
  else if (balances.trading >= amount && balances.funding === 0) {
    console.log(`📊 Saldo está todo na Trading (${balances.trading} ${asset}). Transferência necessária.`);
    needsInternalTransfer = true;
    amountToTransfer = amount;
  }
  // Se tem saldo parcial em ambas, transferir apenas o que falta
  else if (balances.trading > 0 && balances.funding > 0) {
    const missingInFunding = amount - balances.funding;
    console.log(`📊 Saldo parcial em ambas as contas. Transferindo ${missingInFunding} ${asset} da Trading.`);
    needsInternalTransfer = true;
    amountToTransfer = Math.min(missingInFunding, balances.trading);
  }
  // Só tem na Trading, mas menos que o necessário - transferir tudo disponível
  else if (balances.trading > 0) {
    console.log(`📊 Transferindo todo saldo da Trading: ${balances.trading} ${asset}`);
    needsInternalTransfer = true;
    amountToTransfer = balances.trading;
  }
  
  // PASSO 1: Transferir APENAS SE NECESSÁRIO
  if (needsInternalTransfer) {
    console.log(`🔄 PASSO 1: Transferindo ${amountToTransfer} ${asset} de Trading → Funding...`);
    
    try {
      await transferOKXTradingToFunding(asset, amountToTransfer, credentials);
      console.log('✅ Transferência interna concluída');
      
      // Aguardar processamento interno da OKX
      console.log('⏳ Aguardando processamento interno da OKX (5 segundos)...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (transferError) {
      console.error('❌ ERRO na transferência interna OKX:', transferError);
      
      // Verificar se o erro é de saldo insuficiente
      const errorMsg = transferError instanceof Error ? transferError.message : String(transferError);
      
      if (errorMsg.includes('Insufficient balance') || errorMsg.includes('FALHA APÓS')) {
        throw new Error(
          `❌ Falha na transferência interna Trading → Funding\n` +
          `${errorMsg}\n\n` +
          `Verifique manualmente na OKX:\n` +
          `1. Se a ordem de compra foi executada\n` +
          `2. Se o saldo está disponível na Trading Account\n` +
          `3. Se há ordens pendentes travando o saldo`
        );
      }
      
      throw new Error(`Falha na transferência interna: ${errorMsg}`);
    }
  } else {
    console.log(`⚡ PASSO 1 PULADO: Saldo já disponível na Funding Account`);
  }
  
  // PASSO 2: Verificar saldo final disponível na Funding Account
  console.log(`🔍 PASSO 2: Verificando saldo final de ${asset} na Funding...`);
  
  // Fazer várias verificações com esperas progressivas
  const maxRetries = 4;
  const retryDelays = [5000, 10000, 15000, 20000]; // Total: até 50s
  let finalFundingBalance = 0;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    finalFundingBalance = await getOKXAvailableBalance(asset, credentials);
    console.log(`💰 [Tentativa ${attempt + 1}/${maxRetries}] Saldo Funding: ${finalFundingBalance} ${asset} (necessário: ${amount})`);
    
    if (finalFundingBalance >= amount) {
      console.log(`✅ Saldo suficiente confirmado na Funding!`);
      break;
    }
    
    if (attempt < maxRetries - 1) {
      const waitTime = retryDelays[attempt];
      console.log(`⏳ Aguardando transferência interna completar (${waitTime/1000}s)...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } else {
      throw new Error(
        `❌ SALDO INSUFICIENTE NA FUNDING ACCOUNT após ${retryDelays.reduce((a,b) => a+b, 0)/1000}s de espera\n` +
        `Disponível: ${finalFundingBalance} ${asset}\n` +
        `Necessário: ${amount} ${asset}\n` +
        `A transferência interna Trading → Funding pode ter falhado ou ainda está processando.\n` +
        `Aguarde alguns minutos e tente novamente.`
      );
    }
  }
  
  // PASSO 3: Executar withdrawal
  const timestamp = new Date().toISOString();
  const method = 'POST';
  const requestPath = '/api/v5/asset/withdrawal';
  
  // Mapeamento por ASSET+NETWORK para OKX (formato: ASSET-Network)
  const getOKXChain = (asset: string, binanceNetwork: string): string => {
    // Casos especiais por asset + network (Arbitrum prioritário)
    const assetChainMap: Record<string, string> = {
      'USDT_ARBITRUM': 'USDT-Arbitrum One',
      'USDC_ARBITRUM': 'USDC-Arbitrum One',
      'ETH_ARBITRUM': 'ETH-Arbitrum One',
      'LINK_ARBITRUM': 'LINK-Arbitrum One',
      'UNI_ARBITRUM': 'UNI-Arbitrum One',
      'PEPE_ARBITRUM': 'PEPE-Arbitrum One',
      'SHIB_ARBITRUM': 'SHIB-Arbitrum One',
      
      // Ethereum mainnet (fallback)
      'USDT_ETH': 'USDT-ERC20',
      'LINK_ETH': 'LINK-ERC20',
      'UNI_ETH': 'UNI-ERC20',
      'PEPE_ETH': 'PEPE-ERC20',
      'FLOKI_ETH': 'FLOKI-ERC20',
      'SHIB_ETH': 'SHIB-ERC20',
    };
    
    const key = `${asset}_${binanceNetwork}`;
    if (assetChainMap[key]) {
      return assetChainMap[key];
    }
    
    // Mapeamento genérico de rede
    const genericNetworkMap: Record<string, string> = {
      'ARBITRUM': 'ETH-Arbitrum One',
      'ETH': 'ETH-Ethereum',
      'BTC': 'BTC-Bitcoin',
      'DOT': 'DOT-BSC',
      'ADA': 'ADA-Cardano',
      'SOL': 'SOL-Solana',
      'AVAXC': 'AVAX-Avalanche C-Chain',
      'ATOM': 'ATOM-Cosmos',
      'DOGE': 'DOGE-Dogecoin',
      'XRP': 'XRP-Ripple',
      'BSC': 'BSC-BSC',
      'FIL': 'FIL-Filecoin',
      'LTC': 'LTC-Litecoin'
    };
    
    return genericNetworkMap[binanceNetwork] || `${asset}-${binanceNetwork}`;
  };
  
  const okxChain = getOKXChain(asset, network);
  console.log(`📤 OKX Withdrawal: ${asset} via ${okxChain}`);
  
  // Taxa de saque adaptativa
  const fee = asset === 'USDT' && network === 'ARBITRUM' ? '0.1' : '0.01';
  
  const body = JSON.stringify({
    ccy: asset,
    amt: amount.toString(),
    dest: '4', // On-chain
    toAddr: toAddress,
    fee: fee,
    chain: okxChain
  });
  
  const prehash = timestamp + method + requestPath + body;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(credentials.okxSecretKey!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method: 'POST',
    headers: {
      'OK-ACCESS-KEY': credentials.okxApiKey!,
      'OK-ACCESS-SIGN': signatureBase64,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase!,
      'Content-Type': 'application/json'
    },
    body
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro OKX withdrawal: ${error}`);
  }
  
  const data = await response.json();
  
  // Verificar se houve erro na resposta (OKX retorna 200 mas com código de erro)
  if (data.code !== '0') {
    const errorMsg = data.msg || JSON.stringify(data);
    
    // Erro de endereço não verificado
    if (errorMsg.includes('verified address list') || errorMsg.includes('address list')) {
      throw new Error(`OKX Withdrawal Error: O endereço de destino não está na lista de endereços verificados da OKX. 

⚠️ AÇÃO NECESSÁRIA:
1. Acesse https://www.okx.com/balance/withdrawal-address
2. Adicione o endereço: ${toAddress}
3. Rede: ${okxChain}
4. Complete a verificação (pode levar alguns minutos)
5. Tente a operação novamente

Nota: A OKX exige que todos os endereços de saque sejam previamente cadastrados e verificados por segurança.`);
    }
    
    throw new Error(`OKX Withdrawal Error: ${errorMsg}`);
  }
  if (data.code !== '0') {
    throw new Error(`OKX Withdrawal Error: ${data.msg}`);
  }
  
  return data.data[0];
}

async function executeBinanceWithdrawal(
  asset: string,
  amount: number,
  toAddress: string,
  network: string,
  apiKey: string,
  secretKey: string
) {
  const timestamp = Date.now();
  const queryString = `coin=${asset}&network=${network}&address=${toAddress}&amount=${amount}&timestamp=${timestamp}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const response = await fetch(
    `https://api.binance.com/sapi/v1/capital/withdraw/apply?${queryString}&signature=${signatureHex}`,
    {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': apiKey }
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro Binance withdrawal: ${error}`);
  }
  
  const data = await response.json();
  
  // Verificar se houve erro na resposta da Binance
  if (data.code && data.code !== 200) {
    const errorMsg = data.msg || JSON.stringify(data);
    
    // Erro de endereço não whitelistado
    if (errorMsg.includes('address not in whitelist') || 
        errorMsg.includes('not in the address whitelist') ||
        errorMsg.includes('address whitelist') ||
        data.code === -5002 || // Código específico da Binance para whitelist
        data.code === -4012) {  // Outro código de whitelist
      throw new Error(`Binance Withdrawal Error: O endereço de destino não está na whitelist da Binance.

⚠️ AÇÃO NECESSÁRIA:
1. Acesse https://www.binance.com/en/my/security/address-management
2. Clique em "Add Withdrawal Address"
3. Selecione o token: ${asset}
4. Selecione a rede: ${network}
5. Cole o endereço: ${toAddress}
6. Complete a verificação (pode levar até 24h para aprovação)
7. Tente a operação novamente

Nota: A Binance exige que todos os endereços de saque sejam previamente cadastrados e verificados por segurança. A verificação pode levar até 24 horas.`);
    }
    
    throw new Error(`Binance Withdrawal Error: ${errorMsg}`);
  }
  
  return data;
}

async function waitForTransferConfirmation(
  exchange: string,
  asset: string,
  expectedAmount: number,
  binanceApiKey?: string,
  binanceSecretKey?: string,
  timeout: number = 600000,
  okxCredentials?: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 30000; // Verificar a cada 30s
  let checks = 0;
  const maxChecks = Math.floor(timeout / checkInterval);
  
  console.log(`⏳ Aguardando ${expectedAmount} ${asset} na ${exchange}...`);
  
  while (Date.now() - startTime < timeout) {
    checks++;
    console.log(`🔍 Verificação ${checks}/${maxChecks}...`);
    
    try {
      let balance = 0;
      
      if (exchange === 'Binance' && binanceApiKey && binanceSecretKey) {
        balance = await getBinanceBalance(asset, binanceApiKey, binanceSecretKey);
      } else if (exchange === 'OKX' && okxCredentials) {
        balance = await getOKXBalance(asset, okxCredentials);
      }
      
      console.log(`💰 Saldo ${asset}: ${balance} (esperado: ${expectedAmount})`);
      
      if (balance >= expectedAmount * 0.95) { // 95% do esperado (considera taxas)
        console.log('✅ Transferência confirmada!');
        return true;
      }
      
    } catch (error) {
      console.error('⚠️ Erro ao verificar saldo:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  return false;
}

async function getBinanceBalance(asset: string, apiKey: string, secretKey: string): Promise<number> {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const response = await fetch(
    `https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`,
    { headers: { 'X-MBX-APIKEY': apiKey } }
  );
  
  if (!response.ok) throw new Error('Erro ao obter saldo Binance');
  
  const data = await response.json();
  const assetBalance = data.balances.find((b: any) => b.asset === asset);
  return assetBalance ? parseFloat(assetBalance.free) : 0;
}

async function getOKXBalance(
  asset: string,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
): Promise<number> {
  const timestamp = new Date().toISOString();
  const method = 'GET';
  const requestPath = '/api/v5/account/balance';
  
  const prehash = timestamp + method + requestPath;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(credentials.okxSecretKey!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': credentials.okxApiKey!,
      'OK-ACCESS-SIGN': signatureBase64,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase!,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) throw new Error('Erro ao obter saldo OKX');
  
  const data = await response.json();
  if (data.code !== '0') throw new Error(`OKX API Error: ${data.msg}`);
  
  const assetBalance = data.data[0].details.find((d: any) => d.ccy === asset);
  return assetBalance ? parseFloat(assetBalance.availBal) : 0;
}
