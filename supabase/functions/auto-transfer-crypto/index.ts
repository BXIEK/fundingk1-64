import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransferRequest {
  userId: string;
  fromExchange: 'binance' | 'okx';
  toExchange: 'binance' | 'okx';
  asset: string; // USDT, BTC, ETH, etc
  amount: number;
  network?: string; // TRC20, ERC20, BEP20
  binanceApiKey?: string;
  binanceSecretKey?: string;
  okxApiKey?: string;
  okxSecretKey?: string;
  okxPassphrase?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      userId,
      fromExchange,
      toExchange,
      asset,
      amount,
      network = 'TRC20', // Default TRC20 para USDT (mais barato)
      binanceApiKey,
      binanceSecretKey,
      okxApiKey,
      okxSecretKey,
      okxPassphrase
    } = await req.json() as TransferRequest;

    console.log(`🚀 Iniciando transferência: ${amount} ${asset} de ${fromExchange} → ${toExchange} via ${network}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`🔑 Credenciais fornecidas: Binance=${!!binanceApiKey}, OKX=${!!okxApiKey}`);

    // Validações
    if (!userId || !fromExchange || !toExchange || !asset || !amount) {
      throw new Error('Parâmetros obrigatórios faltando');
    }

    if (fromExchange === toExchange) {
      throw new Error('Exchange de origem e destino não podem ser iguais');
    }

    // Validar credenciais das exchanges envolvidas
    if (fromExchange === 'binance' && (!binanceApiKey || !binanceSecretKey)) {
      throw new Error('Credenciais da Binance não fornecidas');
    }
    if (fromExchange === 'okx' && (!okxApiKey || !okxSecretKey || !okxPassphrase)) {
      throw new Error('Credenciais da OKX não fornecidas');
    }
    if (toExchange === 'binance' && (!binanceApiKey || !binanceSecretKey)) {
      throw new Error('Credenciais da Binance não fornecidas');
    }
    if (toExchange === 'okx' && (!okxApiKey || !okxSecretKey || !okxPassphrase)) {
      throw new Error('Credenciais da OKX não fornecidas');
    }

    console.log('✅ Validações iniciais passaram');

    // 1. Obter endereço de depósito da exchange de destino
    console.log(`📍 Obtendo endereço de depósito da ${toExchange}...`);
    const depositAddress = await getDepositAddress(
      toExchange,
      asset,
      network,
      { binanceApiKey, binanceSecretKey, okxApiKey, okxSecretKey, okxPassphrase }
    );

    console.log(`📍 Endereço de depósito obtido: ${depositAddress.address} (${depositAddress.network})`);

    // 2. Executar withdrawal da exchange de origem
    const withdrawalResult = await executeWithdrawal(
      fromExchange,
      asset,
      amount,
      depositAddress.address,
      depositAddress.network,
      depositAddress.memo,
      { binanceApiKey, binanceSecretKey, okxApiKey, okxSecretKey, okxPassphrase }
    );

    console.log(`✅ Withdrawal executado com sucesso: ${withdrawalResult.id}`);

    // 3. Registrar transferência no banco de dados
    const { data: transfer, error: transferError } = await supabase
      .from('crypto_transfers')
      .insert({
        user_id: userId,
        from_exchange: fromExchange,
        to_exchange: toExchange,
        asset,
        amount,
        network,
        withdrawal_id: withdrawalResult.id,
        deposit_address: depositAddress.address,
        status: 'pending',
        estimated_arrival: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
        withdrawal_fee: withdrawalResult.fee
      })
      .select()
      .single();

    if (transferError) {
      console.error('Erro ao registrar transferência:', transferError);
      throw transferError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        transfer: {
          id: transfer.id,
          asset,
          amount,
          from_exchange: fromExchange,
          to_exchange: toExchange,
          network,
          withdrawal_id: withdrawalResult.id,
          deposit_address: depositAddress.address,
          status: 'pending',
          estimated_arrival_minutes: 15,
          withdrawal_fee: withdrawalResult.fee,
          tx_url: withdrawalResult.txUrl
        },
        message: `Transferência de ${amount} ${asset} iniciada com sucesso! Chegará em ~15 minutos.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na transferência:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Retornar sempre 200 mas com success: false para evitar erro "Failed to send request"
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 200, // Mudado para 200 para evitar erro de rede
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// ===== HELPER FUNCTIONS =====

async function getDepositAddress(
  exchange: string,
  asset: string,
  network: string,
  credentials: any
): Promise<{ address: string; network: string; memo?: string }> {
  
  if (exchange === 'binance') {
    return getBinanceDepositAddress(asset, network, credentials);
  } else if (exchange === 'okx') {
    return getOKXDepositAddress(asset, network, credentials);
  }
  
  throw new Error(`Exchange ${exchange} não suportada`);
}

async function getBinanceDepositAddress(
  asset: string,
  network: string,
  credentials: any
): Promise<{ address: string; network: string; memo?: string }> {
  
  // Mapeamento de redes: Frontend → Binance API
  const networkMapping: { [key: string]: string } = {
    'TRC20': 'TRX',
    'ERC20': 'ETH',
    'BEP20': 'BSC',
    'BEP2': 'BNB',
    'ARBITRUM': 'ARBITRUM',
    'POLYGON': 'MATIC',
    'OPTIMISM': 'OPTIMISM'
  };
  
  // Normalizar entrada (aceita formatos: TRX, ETH, BSC, USDT-TRC20, etc.)
  const raw = (network || '').toUpperCase();
  const part = raw.includes('-') ? raw.split('-').slice(-1)[0] : raw;
  const canonical = ((): string => {
    switch (part) {
      case 'TRX': return 'TRC20';
      case 'ETH': return 'ERC20';
      case 'BSC': return 'BEP20';
      case 'BNB': return 'BEP2';
      case 'MATIC': return 'POLYGON';
      case 'ARBITRUM ONE': return 'ARBITRUM';
      default: return part;
    }
  })();
  
  const binanceNetwork = networkMapping[canonical] || canonical;
  console.log(`🔄 Mapeamento de rede: ${network} → ${canonical} → ${binanceNetwork}`);
  
  const timestamp = Date.now();
  const queryString = `coin=${asset}&network=${binanceNetwork}&timestamp=${timestamp}`;
  const signature = createHmac('sha256', credentials.binanceSecretKey)
    .update(queryString)
    .digest('hex');

  const url = `https://api.binance.com/sapi/v1/capital/deposit/address?${queryString}&signature=${signature}`;
  
  const response = await fetch(url, {
    headers: {
      'X-MBX-APIKEY': credentials.binanceApiKey
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao obter endereço Binance: ${error}`);
  }

  const data = await response.json();
  
  console.log(`✅ Endereço Binance obtido: ${data.address} (rede: ${data.network})`);
  
  return {
    address: data.address,
    network: binanceNetwork,
    memo: data.tag || undefined
  };
}

async function getOKXDepositAddress(
  asset: string,
  network: string,
  credentials: any
): Promise<{ address: string; network: string; memo?: string }> {
  
  // Mapeamento de redes: Frontend → OKX API
  const chainMapping: { [key: string]: string } = {
    'TRC20': `${asset}-TRC20`,
    'ERC20': `${asset}-ERC20`,
    'BEP20': `${asset}-BSC`,
    'BEP2': `${asset}-BEP2`,
    'ARBITRUM': `${asset}-Arbitrum One`,
    'POLYGON': `${asset}-Polygon`,
    'OPTIMISM': `${asset}-Optimism`
  };
  
  const okxChain = chainMapping[network] || `${asset}-${network}`;
  console.log(`🔄 Mapeamento de rede OKX para depósito: ${network} → ${okxChain}`);
  
  const timestamp = new Date().toISOString();
  const method = 'GET';
  const requestPath = `/api/v5/asset/deposit-address?ccy=${asset}`;
  
  const sign = createHmac('sha256', credentials.okxSecretKey)
    .update(timestamp + method + requestPath)
    .digest('base64');

  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method,
    headers: {
      'OK-ACCESS-KEY': credentials.okxApiKey,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao obter endereço OKX: ${error}`);
  }

  const data = await response.json();
  
  if (data.code !== '0') {
    throw new Error(`OKX Error: ${data.msg}`);
  }

  const addressData = data.data.find((d: any) => d.chain === okxChain);
  
  if (!addressData) {
    throw new Error(`Rede ${okxChain} não encontrada na OKX para ${asset}`);
  }

  console.log(`✅ Endereço OKX obtido: ${addressData.addr} (rede: ${addressData.chain})`);

  return {
    address: addressData.addr,
    network: okxChain,
    memo: addressData.memo || undefined
  };
}

async function getOKXAllBalances(
  asset: string,
  credentials: any
): Promise<{ trading: number; funding: number; total: number; location: string }> {
  try {
    console.log(`🔍 Verificando saldo de ${asset} em OKX (Trading + Funding)...`);
    
    const timestamp = new Date().toISOString();
    const method = 'GET';
    const requestPath = `/api/v5/asset/balances?ccy=${asset}`;
    
    const sign = createHmac('sha256', credentials.okxSecretKey)
      .update(timestamp + method + requestPath)
      .digest('base64');
    
    const response = await fetch(`https://www.okx.com${requestPath}`, {
      method,
      headers: {
        'OK-ACCESS-KEY': credentials.okxApiKey,
        'OK-ACCESS-SIGN': sign,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao buscar saldo OKX: ${error}`);
    }
    
    const data = await response.json();
    
    if (data.code !== '0') {
      throw new Error(`OKX Error: ${data.msg}`);
    }
    
    let tradingBalance = 0;
    let fundingBalance = 0;
    
    if (data.data && Array.isArray(data.data)) {
      for (const balance of data.data) {
        const available = parseFloat(balance.availBal || '0');
        
        if (balance.account === 'trading' || balance.account === '18') {
          tradingBalance += available;
        } else if (balance.account === 'funding' || balance.account === '6') {
          fundingBalance += available;
        }
      }
    }
    
    const totalBalance = tradingBalance + fundingBalance;
    
    let location = 'none';
    if (tradingBalance > 0 && fundingBalance > 0) {
      location = 'both';
    } else if (tradingBalance > 0) {
      location = 'trading';
    } else if (fundingBalance > 0) {
      location = 'funding';
    }
    
    console.log(`💰 Saldos OKX de ${asset}:`);
    console.log(`   Trading: ${tradingBalance}`);
    console.log(`   Funding: ${fundingBalance}`);
    console.log(`   Total: ${totalBalance} (${location})`);
    
    return { trading: tradingBalance, funding: fundingBalance, total: totalBalance, location };
    
  } catch (error) {
    console.error(`❌ Erro ao buscar saldo OKX:`, error);
    throw error;
  }
}

async function executeWithdrawal(
  exchange: string,
  asset: string,
  amount: number,
  address: string,
  network: string,
  memo: string | undefined,
  credentials: any
): Promise<{ id: string; fee: number; txUrl?: string }> {
  
  if (exchange === 'binance') {
    return executeBinanceWithdrawal(asset, amount, address, network, memo, credentials);
  } else if (exchange === 'okx') {
    return executeOKXWithdrawal(asset, amount, address, network, memo, credentials);
  }
  
  throw new Error(`Exchange ${exchange} não suportada`);
}

async function executeBinanceWithdrawal(
  asset: string,
  amount: number,
  address: string,
  network: string,
  addressTag: string | undefined,
  credentials: any
): Promise<{ id: string; fee: number; txUrl?: string }> {
  
  // Mapeamento de redes: Frontend → Binance API
  const networkMapping: { [key: string]: string } = {
    'TRC20': 'TRX',
    'ERC20': 'ETH',
    'BEP20': 'BSC',
    'BEP2': 'BNB',
    'ARBITRUM': 'ARBITRUM',
    'POLYGON': 'MATIC',
    'OPTIMISM': 'OPTIMISM'
  };
  
  // Normalizar entrada (pode vir como USDT-TRC20, TRX, etc.)
  const raw = (network || '').toUpperCase();
  const part = raw.includes('-') ? raw.split('-').slice(-1)[0] : raw;
  const canonical = ((): string => {
    switch (part) {
      case 'TRX': return 'TRC20';
      case 'ETH': return 'ERC20';
      case 'BSC': return 'BEP20';
      case 'BNB': return 'BEP2';
      case 'MATIC': return 'POLYGON';
      case 'ARBITRUM ONE': return 'ARBITRUM';
      default: return part;
    }
  })();
  
  const binanceNetwork = networkMapping[canonical] || canonical;
  console.log(`🔄 Mapeamento de rede para withdrawal: ${network} → ${canonical} → ${binanceNetwork}`);
  
  const timestamp = Date.now();
  let queryString = `coin=${asset}&network=${binanceNetwork}&address=${address}&amount=${amount}&timestamp=${timestamp}`;
  
  if (addressTag) {
    queryString += `&addressTag=${addressTag}`;
  }
  
  const signature = createHmac('sha256', credentials.binanceSecretKey)
    .update(queryString)
    .digest('hex');

  const url = `https://api.binance.com/sapi/v1/capital/withdraw/apply?${queryString}&signature=${signature}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-MBX-APIKEY': credentials.binanceApiKey
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro na transferência Binance: ${error}`);
  }

  const data = await response.json();
  
  return {
    id: data.id,
    fee: parseFloat(data.transactionFee || '0'),
    txUrl: `https://www.binance.com/en/my/wallet/account/withdrawal/crypto/${data.id}`
  };
}

async function executeOKXWithdrawal(
  asset: string,
  amount: number,
  address: string,
  chain: string,
  memo: string | undefined,
  credentials: any
): Promise<{ id: string; fee: number; txUrl?: string }> {
  
  console.log(`🚀 Iniciando withdrawal OKX: ${amount} ${asset}`);
  
  // PASSO 0: Verificar saldo total (Trading + Funding)
  const balanceInfo = await getOKXAllBalances(asset, credentials);
  
  if (balanceInfo.total < amount) {
    throw new Error(
      `❌ Saldo insuficiente na OKX!\n` +
      `   Necessário: ${amount} ${asset}\n` +
      `   Disponível: ${balanceInfo.total} ${asset}\n` +
      `   Trading: ${balanceInfo.trading} ${asset}\n` +
      `   Funding: ${balanceInfo.funding} ${asset}`
    );
  }
  
  // Determinar se precisa de transferência interna
  const needsInternalTransfer = balanceInfo.funding < amount && balanceInfo.trading > 0;
  const amountToTransfer = needsInternalTransfer 
    ? Math.min(amount - balanceInfo.funding, balanceInfo.trading)
    : 0;
  
  console.log(`📊 Análise de saldo OKX:`);
  console.log(`   Total disponível: ${balanceInfo.total} ${asset} (${balanceInfo.location})`);
  console.log(`   Necessário: ${amount} ${asset}`);
  console.log(`   Trading: ${balanceInfo.trading} ${asset}`);
  console.log(`   Funding: ${balanceInfo.funding} ${asset}`);
  console.log(`   Precisa transferência interna? ${needsInternalTransfer ? 'SIM' : 'NÃO'}`);
  if (needsInternalTransfer) {
    console.log(`   Quantidade a transferir: ${amountToTransfer} ${asset}`);
  }
  
  // PASSO 1: Transferência interna (Trading → Funding) se necessário
  if (needsInternalTransfer && amountToTransfer > 0) {
    console.log(`🔄 PASSO 1: Transferindo ${amountToTransfer} ${asset} de Trading → Funding...`);
    
    const transferTimestamp = new Date().toISOString();
    const transferMethod = 'POST';
    const transferPath = '/api/v5/asset/transfer';
    const transferBody = {
      ccy: asset,
      amt: amountToTransfer.toString(),
      from: '18', // Trading account
      to: '6',    // Funding account
      type: '0'   // Internal transfer
    };
    const transferBodyString = JSON.stringify(transferBody);
    
    const transferSign = createHmac('sha256', credentials.okxSecretKey)
      .update(transferTimestamp + transferMethod + transferPath + transferBodyString)
      .digest('base64');
    
    const transferResponse = await fetch(`https://www.okx.com${transferPath}`, {
      method: transferMethod,
      headers: {
        'OK-ACCESS-KEY': credentials.okxApiKey,
        'OK-ACCESS-SIGN': transferSign,
        'OK-ACCESS-TIMESTAMP': transferTimestamp,
        'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase,
        'Content-Type': 'application/json',
      },
      body: transferBodyString
    });
    
    if (!transferResponse.ok) {
      const error = await transferResponse.text();
      throw new Error(`Erro na transferência interna OKX: ${error}`);
    }
    
    const transferData = await transferResponse.json();
    
    if (transferData.code !== '0') {
      throw new Error(`OKX Internal Transfer Error: ${transferData.msg}`);
    }
    
    console.log(`✅ Transferência interna concluída: ${amountToTransfer} ${asset} movidos para Funding`);
    
    // PASSO 2: Aguardar e verificar saldo na Funding com retry robusto
    console.log('⏳ Aguardando saldo aparecer na Funding Account...');
    
    const maxAttempts = 4;
    const delays = [5000, 10000, 15000, 20000]; // 5s, 10s, 15s, 20s
    let balanceConfirmed = false;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      
      try {
        const currentBalance = await getOKXAllBalances(asset, credentials);
        console.log(`   Tentativa ${attempt + 1}/${maxAttempts}: Funding = ${currentBalance.funding} ${asset}`);
        
        if (currentBalance.funding >= amount * 0.95) { // Tolerância de 5%
          console.log(`✅ Saldo confirmado na Funding: ${currentBalance.funding} ${asset}`);
          balanceConfirmed = true;
          break;
        }
      } catch (checkError) {
        console.warn(`⚠️ Erro ao verificar saldo (tentativa ${attempt + 1}):`, checkError);
      }
    }
    
    if (!balanceConfirmed) {
      throw new Error(
        `❌ Timeout: Saldo não apareceu na Funding Account após ${delays.reduce((a, b) => a + b) / 1000}s.\n` +
        `Possíveis causas:\n` +
        `• Transferência interna ainda processando\n` +
        `• Verifique manualmente o status na OKX\n` +
        `• Pode haver ordens abertas travando o saldo`
      );
    }
  } else {
    console.log(`⚡ Saldo já suficiente na Funding (${balanceInfo.funding} ${asset}) - pulando transferência interna`);
  }
  
  // PASSO 3: Executar withdrawal da Funding Account
  console.log(`🔄 PASSO FINAL: Executando withdrawal de ${amount} ${asset} da Funding Account...`);
  
  const chainMapping: { [key: string]: string } = {
    'TRC20': `${asset}-TRC20`,
    'ERC20': `${asset}-ERC20`,
    'BEP20': `${asset}-BSC`,
    'BEP2': `${asset}-BEP2`,
    'ARBITRUM': `${asset}-Arbitrum One`,
    'POLYGON': `${asset}-Polygon`,
    'OPTIMISM': `${asset}-Optimism`
  };
  
  const raw = (chain || '').toUpperCase();
  const part = raw.includes('-') ? raw.split('-').slice(-1)[0] : raw;
  const canonical = ((): string => {
    switch (part) {
      case 'TRX': return 'TRC20';
      case 'ETH': return 'ERC20';
      case 'BSC': return 'BEP20';
      case 'BNB': return 'BEP2';
      case 'MATIC': return 'POLYGON';
      case 'ARBITRUM ONE': return 'ARBITRUM';
      default: return part;
    }
  })();
  
  const okxChain = chainMapping[canonical] || `${asset}-${canonical}`;
  console.log(`🔄 Mapeamento de rede: ${chain} → ${canonical} → ${okxChain}`);
  
  const timestamp = new Date().toISOString();
  const method = 'POST';
  const requestPath = '/api/v5/asset/withdrawal';
  
  const body: any = {
    ccy: asset,
    amt: amount.toString(),
    dest: '4',
    toAddr: address,
    fee: 'auto',
    chain: okxChain
  };
  
  if (memo) {
    body.memo = memo;
  }
  
  const bodyString = JSON.stringify(body);
  
  const sign = createHmac('sha256', credentials.okxSecretKey)
    .update(timestamp + method + requestPath + bodyString)
    .digest('base64');

  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method,
    headers: {
      'OK-ACCESS-KEY': credentials.okxApiKey,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase,
      'Content-Type': 'application/json'
    },
    body: bodyString
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro no withdrawal OKX: ${error}`);
  }

  const data = await response.json();
  
  if (data.code !== '0') {
    throw new Error(`OKX Withdrawal Error: ${data.msg}`);
  }

  console.log(`✅ Withdrawal OKX executado com sucesso!`);

  return {
    id: data.data[0].wdId,
    fee: parseFloat(data.data[0].fee || '0'),
    txUrl: `https://www.okx.com/balance/withdrawal-records`
  };
}
