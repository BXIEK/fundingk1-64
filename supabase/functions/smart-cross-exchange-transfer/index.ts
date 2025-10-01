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
      binanceApiKey,
      binanceSecretKey,
      okxApiKey,
      okxSecretKey,
      okxPassphrase
    }: TransferRequest = await req.json();

    console.log(`💱 TRANSFERÊNCIA AUTOMÁTICA: ${amount} ${asset} de ${fromExchange} → ${toExchange}`);
    console.log(`⚡ Usando rede Arbitrum (rápido: 2-5 min). Aguarde...`);

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
      depositAddress = await getBinanceDepositAddress(asset, binanceApiKey!, binanceSecretKey!);
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

async function getBinanceDepositAddress(asset: string, apiKey: string, secretKey: string) {
  const timestamp = Date.now();
  const network = asset === 'USDT' ? 'ARBITRUM' : 'ARBITRUM'; // USDT via Arbitrum (rápido e barato)
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

async function executeOKXWithdrawal(
  asset: string,
  amount: number,
  toAddress: string,
  network: string,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
) {
  const timestamp = new Date().toISOString();
  const method = 'POST';
  const requestPath = '/api/v5/asset/withdrawal';
  
  // Taxa de saque (0.1 USDT para rede Arbitrum)
  const fee = asset === 'USDT' && network === 'ARBITRUM' ? '0.1' : '0.01';
  
  const body = JSON.stringify({
    ccy: asset,
    amt: amount.toString(),
    dest: '4', // On-chain
    toAddr: toAddress,
    fee: fee,
    chain: network === 'ARBITRUM' ? 'USDT-Arbitrum One' : network
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
  
  return await response.json();
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
