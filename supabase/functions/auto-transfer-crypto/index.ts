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
  
  const timestamp = Date.now();
  const queryString = `coin=${asset}&network=${network}&timestamp=${timestamp}`;
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
  
  return {
    address: data.address,
    network: data.network,
    memo: data.tag || undefined
  };
}

async function getOKXDepositAddress(
  asset: string,
  network: string,
  credentials: any
): Promise<{ address: string; network: string; memo?: string }> {
  
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

  const addressData = data.data.find((d: any) => d.chain === network);
  
  if (!addressData) {
    throw new Error(`Rede ${network} não encontrada na OKX para ${asset}`);
  }

  return {
    address: addressData.addr,
    network: addressData.chain,
    memo: addressData.memo || undefined
  };
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
  
  const timestamp = Date.now();
  let queryString = `coin=${asset}&network=${network}&address=${address}&amount=${amount}&timestamp=${timestamp}`;
  
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
  
  const timestamp = new Date().toISOString();
  const method = 'POST';
  const requestPath = '/api/v5/asset/withdrawal';
  
  const body: any = {
    ccy: asset,
    amt: amount.toString(),
    dest: '4', // On-chain withdrawal
    toAddr: address,
    fee: 'auto',
    chain
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
    throw new Error(`Erro na transferência OKX: ${error}`);
  }

  const data = await response.json();
  
  if (data.code !== '0') {
    throw new Error(`OKX Withdrawal Error: ${data.msg}`);
  }

  return {
    id: data.data[0].wdId,
    fee: parseFloat(data.data[0].fee || '0'),
    txUrl: `https://www.okx.com/balance/withdrawal-records`
  };
}
