import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey, secretKey, passphrase, symbol, direction, amount: customAmount, orderType = 'limit' } = await req.json();
    // direction: 'toUsdt' ou 'toToken'
    // amount: quantidade específica a converter (opcional)
    // orderType: 'market' (taker fees ~0.08%) ou 'limit' (maker fees ~0.02% ou menos)

    if (!apiKey || !secretKey || !passphrase || !symbol || !direction) {
      throw new Error('Parâmetros incompletos');
    }

    console.log(`🔄 OKX Swap: ${direction === 'toUsdt' ? symbol + ' → USDT' : 'USDT → ' + symbol}`);
    console.log(`📊 Tipo de ordem: ${orderType.toUpperCase()} (${orderType === 'limit' ? 'maker fees ~0.02%' : 'taker fees ~0.08%'})`);
    if (customAmount) {
      console.log(`💰 Valor personalizado: ${customAmount}`);
    }

    // Buscar saldo atual
    const balancesResponse = await callOKXAPI('/api/v5/account/balance', 'GET', {}, apiKey, secretKey, passphrase);
    
    if (!balancesResponse.data || balancesResponse.data.length === 0) {
      throw new Error('Não foi possível obter saldos');
    }

    const balances = balancesResponse.data[0].details || [];
    let sourceBalance = 0;
    let tradePair = '';
    let orderSide = '';
    let orderSize = 0;

    if (direction === 'toUsdt') {
      // Converter token para USDT (SELL)
      const tokenBalance = balances.find((b: any) => b.ccy === symbol);
      sourceBalance = parseFloat(tokenBalance?.availBal || '0');
      tradePair = `${symbol}-USDT`;
      orderSide = 'sell';
      orderSize = customAmount || sourceBalance; // Usar valor personalizado se fornecido

      console.log(`💰 Saldo de ${symbol}: ${sourceBalance}`);
      console.log(`🎯 Quantidade a converter: ${orderSize}`);

      if (sourceBalance <= 0) {
        throw new Error(`Saldo insuficiente de ${symbol}`);
      }

      if (orderSize > sourceBalance) {
        throw new Error(`Quantidade solicitada (${orderSize}) maior que saldo disponível (${sourceBalance})`);
      }
    } else {
      // Converter USDT para token (BUY)
      const usdtBalance = balances.find((b: any) => b.ccy === 'USDT');
      sourceBalance = parseFloat(usdtBalance?.availBal || '0');
      tradePair = `${symbol}-USDT`;
      orderSide = 'buy';

      console.log(`💰 Saldo de USDT: ${sourceBalance}`);

      if (sourceBalance <= 0) {
        throw new Error('Saldo insuficiente de USDT');
      }

      // Buscar preço atual
      const tickerResponse = await callOKXAPI(
        '/api/v5/market/ticker',
        'GET',
        { instId: tradePair },
        apiKey,
        secretKey,
        passphrase
      );

      if (!tickerResponse.data || tickerResponse.data.length === 0) {
        throw new Error(`Par ${tradePair} não encontrado`);
      }

      const currentPrice = parseFloat(tickerResponse.data[0].last);
      
      if (customAmount) {
        // Se valor personalizado de USDT foi especificado
        const usdtToSpend = customAmount;
        if (usdtToSpend > sourceBalance) {
          throw new Error(`Saldo insuficiente. Disponível: ${sourceBalance} USDT`);
        }
        orderSize = usdtToSpend / currentPrice;
      } else {
        // Usar 95% do saldo USDT
        orderSize = (sourceBalance * 0.95) / currentPrice;
      }

      console.log(`📊 Preço atual de ${symbol}: $${currentPrice}`);
      console.log(`🎯 Quantidade a comprar: ${orderSize} ${symbol}`);
    }

    // Buscar informações do instrumento
    const instrumentResponse = await callOKXAPI(
      '/api/v5/public/instruments',
      'GET',
      { instType: 'SPOT', instId: tradePair },
      apiKey,
      secretKey,
      passphrase
    );

    if (!instrumentResponse.data || instrumentResponse.data.length === 0) {
      throw new Error(`Instrumento ${tradePair} não encontrado`);
    }

    const instrument = instrumentResponse.data[0];
    const minSize = parseFloat(instrument.minSz || '0');
    const lotSize = parseFloat(instrument.lotSz || '0.00000001');

    // Ajustar quantidade ao lot size
    // Para USDT: 1 casa decimal, demais tokens: 2 casas decimais
    if (lotSize > 0) {
      orderSize = Math.floor(orderSize / lotSize) * lotSize;
      const targetPrecision = (direction === 'toToken' && symbol === 'USDT') ? 1 : 2;
      orderSize = parseFloat(orderSize.toFixed(targetPrecision));
    }

    console.log(`📏 Quantidade ajustada: ${orderSize} ${symbol}`);

    if (orderSize < minSize) {
      throw new Error(`Quantidade mínima não atingida. Mínimo: ${minSize} ${symbol}`);
    }

    // Buscar preço atual para limit order
    let limitPrice = 0;
    if (orderType === 'limit') {
      const tickerResponse = await callOKXAPI(
        '/api/v5/market/ticker',
        'GET',
        { instId: tradePair },
        apiKey,
        secretKey,
        passphrase
      );

      if (!tickerResponse.data || tickerResponse.data.length === 0) {
        throw new Error(`Preço de ${tradePair} não encontrado`);
      }

      const currentPrice = parseFloat(tickerResponse.data[0].last);
      
      // Ajustar preço para ser maker:
      // SELL: colocar 0.05% acima do mercado (mais favorável para nós)
      // BUY: colocar 0.05% abaixo do mercado (mais favorável para nós)
      if (orderSide === 'sell') {
        limitPrice = currentPrice * 1.0005;
      } else {
        limitPrice = currentPrice * 0.9995;
      }

      // Arredondar para precisão adequada (8 casas decimais)
      limitPrice = parseFloat(limitPrice.toFixed(8));
      console.log(`💹 Preço limite ajustado: $${limitPrice} (mercado: $${currentPrice})`);
    }

    // Executar ordem
    console.log(`📤 Executando ordem ${orderSide.toUpperCase()} ${orderType.toUpperCase()}`);

    const orderParams: any = {
      instId: tradePair,
      tdMode: 'cash',
      side: orderSide,
      ordType: orderType,
      sz: orderSize.toString()
    };

    if (orderType === 'limit') {
      orderParams.px = limitPrice.toString();
    }

    const orderResponse = await callOKXAPI(
      '/api/v5/trade/order',
      'POST',
      orderParams,
      apiKey,
      secretKey,
      passphrase
    );

    if (orderResponse.code !== '0' || !orderResponse.data || orderResponse.data.length === 0) {
      throw new Error(orderResponse.msg || 'Erro na execução da ordem');
    }

    const orderId = orderResponse.data[0].ordId;
    const orderState = orderResponse.data[0].sCode; // Status code
    
    if (orderType === 'limit') {
      console.log(`✅ Ordem LIMIT colocada com sucesso!`);
      console.log(`🆔 Order ID: ${orderId}`);
      console.log(`⏳ Aguardando execução (ordens limit podem levar alguns segundos)`);
    } else {
      console.log(`✅ Ordem MARKET executada com sucesso!`);
      console.log(`🆔 Order ID: ${orderId}`);
    }

    let resultMessage = '';
    if (direction === 'toUsdt') {
      resultMessage = `${orderSize.toFixed(6)} ${symbol} → USDT (${orderType})`;
    } else {
      resultMessage = `USDT → ${orderSize.toFixed(6)} ${symbol} (${orderType})`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: resultMessage,
        orderId,
        symbol,
        direction,
        executedQty: orderSize
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na conversão:', error);
    
    // Retornar status 200 com success: false para que o frontend possa processar o erro
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido na conversão'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});

async function callOKXAPI(
  endpoint: string,
  method: string,
  params: any,
  apiKey: string,
  secretKey: string,
  passphrase: string
): Promise<any> {
  const timestamp = new Date().toISOString();
  let url = `https://www.okx.com${endpoint}`;
  let body = '';

  if (method === 'GET' && Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString();
    url += `?${queryString}`;
  } else if (method === 'POST') {
    body = JSON.stringify(params);
  }

  const signatureData = timestamp + method + endpoint + (method === 'GET' && Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : '') + (body || '');
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(signatureData);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const headers: Record<string, string> = {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signatureBase64,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'Content-Type': 'application/json'
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body || undefined
  });

  if (!response.ok) {
    throw new Error(`OKX API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}
