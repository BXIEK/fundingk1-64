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
    const { apiKey, secretKey, symbol, direction, amount: customAmount } = await req.json();
    // direction: 'toUsdt' ou 'toToken'
    // amount: quantidade específica a converter (opcional)

    if (!apiKey || !secretKey || !symbol || !direction) {
      throw new Error('Parâmetros incompletos');
    }

    console.log(`🔄 Binance Swap: ${direction === 'toUsdt' ? symbol + ' → USDT' : 'USDT → ' + symbol}`);
    if (customAmount) {
      console.log(`💰 Valor personalizado: ${customAmount}`);
    }

    const timestamp = Date.now();
    const baseUrl = 'https://api.binance.com';

    // Buscar saldo atual
    const accountQuery = `timestamp=${timestamp}`;
    const accountSignature = await createSignature(accountQuery, secretKey);
    const accountUrl = `${baseUrl}/api/v3/account?${accountQuery}&signature=${accountSignature}`;

    const accountResponse = await fetch(accountUrl, {
      headers: { 'X-MBX-APIKEY': apiKey }
    });

    if (!accountResponse.ok) {
      throw new Error(`Erro ao buscar conta: ${accountResponse.statusText}`);
    }

    const accountData = await accountResponse.json();
    const balances = accountData.balances;

    let sourceBalance = 0;
    let tradePair = '';
    let orderSide = '';
    let orderQuantity = 0;
    let usdtAmountForBuy = 0; // For BUY orders using quoteOrderQty
    let currentPrice = 0; // Latest market price used for NOTIONAL checks

    if (direction === 'toUsdt') {
      // Converter token para USDT (SELL)
      const tokenBalance = balances.find((b: any) => b.asset === symbol);
      sourceBalance = parseFloat(tokenBalance?.free || '0');
      tradePair = `${symbol}USDT`;
      orderSide = 'SELL';
      orderQuantity = customAmount || sourceBalance; // Usar valor personalizado se fornecido

      console.log(`💰 Saldo de ${symbol}: ${sourceBalance}`);
      console.log(`🎯 Quantidade a converter: ${orderQuantity}`);

      if (sourceBalance <= 0) {
        throw new Error(`Saldo insuficiente de ${symbol}`);
      }

      if (orderQuantity > sourceBalance) {
        throw new Error(`Quantidade solicitada (${orderQuantity}) maior que saldo disponível (${sourceBalance})`);
      }

      // Buscar preço atual para validação de NOTIONAL
      const tickerUrl = `${baseUrl}/api/v3/ticker/price?symbol=${tradePair}`;
      const tickerResponse = await fetch(tickerUrl);
      const tickerData = await tickerResponse.json();
      currentPrice = parseFloat(tickerData.price);
    } else {
      // Converter USDT para token (BUY)
      const usdtBalance = balances.find((b: any) => b.asset === 'USDT');
      sourceBalance = parseFloat(usdtBalance?.free || '0');
      tradePair = `${symbol}USDT`;
      orderSide = 'BUY';

      console.log(`💰 Saldo de USDT: ${sourceBalance}`);

      if (sourceBalance <= 0) {
        throw new Error('Saldo insuficiente de USDT');
      }

      // Buscar preço atual para calcular quantidade
      const tickerUrl = `${baseUrl}/api/v3/ticker/price?symbol=${tradePair}`;
      const tickerResponse = await fetch(tickerUrl);
      const tickerData = await tickerResponse.json();
      currentPrice = parseFloat(tickerData.price);

      if (customAmount) {
        // Se valor personalizado de USDT foi especificado
        usdtAmountForBuy = customAmount;
        if (usdtAmountForBuy > sourceBalance) {
          throw new Error(`Saldo insuficiente. Disponível: ${sourceBalance} USDT`);
        }
        orderQuantity = usdtAmountForBuy / currentPrice;
      } else {
        // Usar 95% do saldo USDT para evitar erros de saldo insuficiente
        usdtAmountForBuy = sourceBalance * 0.95;
        orderQuantity = usdtAmountForBuy / currentPrice;
      }

      console.log(`📊 Preço atual de ${symbol}: $${currentPrice}`);
      console.log(`🎯 Quantidade a comprar: ${orderQuantity} ${symbol}`);
    }

    // Buscar informações do par para ajustar quantidade
    const exchangeInfoUrl = `${baseUrl}/api/v3/exchangeInfo?symbol=${tradePair}`;
    const exchangeInfoResponse = await fetch(exchangeInfoUrl);
    
    if (!exchangeInfoResponse.ok) {
      throw new Error(`Par ${tradePair} não encontrado`);
    }

    const exchangeInfo = await exchangeInfoResponse.json();
    const symbolInfo = exchangeInfo.symbols[0];
    const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE' || f.filterType === 'MARKET_LOT_SIZE');
    const stepSize = parseFloat(lotSizeFilter.stepSize);
    const minQty = parseFloat(lotSizeFilter.minQty);
    const notionalFilter = symbolInfo.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL');
    const minNotional = notionalFilter ? parseFloat(notionalFilter.minNotional) : 0;

    // Ajustar quantidade ao step size
    const precision = stepSize.toString().split('.')[1]?.length || 0;
    orderQuantity = Math.floor(orderQuantity / stepSize) * stepSize;
    orderQuantity = parseFloat(orderQuantity.toFixed(precision));

    // Validar NOTIONAL mínimo da Binance
    if (minNotional > 0) {
      if (direction === 'toUsdt') {
        const notional = orderQuantity * currentPrice;
        if (notional < minNotional) {
          const requiredQtyRaw = minNotional / currentPrice;
          const requiredQty = Math.ceil(requiredQtyRaw / stepSize) * stepSize;
          const requiredQtyFixed = parseFloat(requiredQty.toFixed(precision));

          if (customAmount) {
            throw new Error(`Valor da ordem abaixo do NOTIONAL mínimo da Binance (${minNotional} USDT). Sua ordem: ${notional.toFixed(2)} USDT.`);
          }
          if (requiredQtyFixed <= sourceBalance) {
            console.log(`ℹ️ Ajustando quantidade para atender NOTIONAL mínimo: ${requiredQtyFixed} ${symbol}`);
            orderQuantity = requiredQtyFixed;
          } else {
            throw new Error(`Saldo insuficiente para atender NOTIONAL mínimo de ${minNotional} USDT. Necessário ~ ${requiredQtyFixed} ${symbol}, disponível ${sourceBalance}.`);
          }
        }
      } else {
        if (usdtAmountForBuy < minNotional) {
          if (customAmount) {
            throw new Error(`Valor em USDT abaixo do NOTIONAL mínimo (${minNotional} USDT). Informado: ${usdtAmountForBuy} USDT.`);
          }
          if (sourceBalance >= minNotional) {
            console.log(`ℹ️ Ajustando quoteOrderQty para NOTIONAL mínimo: ${minNotional} USDT`);
            usdtAmountForBuy = minNotional;
            orderQuantity = usdtAmountForBuy / currentPrice;
          } else {
            throw new Error(`Saldo de USDT insuficiente para o NOTIONAL mínimo da Binance: ${minNotional} USDT. Disponível: ${sourceBalance} USDT.`);
          }
        }
      }

      // Reaplicar arredondamento após ajustes
      orderQuantity = Math.floor(orderQuantity / stepSize) * stepSize;
      orderQuantity = parseFloat(orderQuantity.toFixed(precision));
    }

    console.log(`📏 Quantidade ajustada: ${orderQuantity} ${symbol}`);

    if (orderQuantity < minQty) {
      throw new Error(`Quantidade mínima não atingida. Mínimo: ${minQty} ${symbol}`);
    }

    // Executar ordem MARKET
    const orderTimestamp = Date.now();
    let orderQuery = `symbol=${tradePair}&side=${orderSide}&type=MARKET&timestamp=${orderTimestamp}`;
    
    if (direction === 'toUsdt') {
      console.log(`📊 Quantidade a vender: ${orderQuantity} ${symbol}`);
      orderQuery += `&quantity=${orderQuantity}`;
    } else {
      // Para BUY, usar quoteOrderQty (valor em USDT) arredondado para 2 casas decimais
      const usdtRounded = parseFloat(usdtAmountForBuy.toFixed(2));
      orderQuery += `&quoteOrderQty=${usdtRounded}`;
      console.log(`💵 USDT a gastar (arredondado): ${usdtRounded}`);
    }

    const orderSignature = await createSignature(orderQuery, secretKey);
    const orderUrl = `${baseUrl}/api/v3/order?${orderQuery}&signature=${orderSignature}`;

    console.log(`📤 Executando ordem ${orderSide} MARKET`);

    const orderResponse = await fetch(orderUrl, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': apiKey }
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      throw new Error(`Erro na ordem: ${errorData.msg || orderResponse.statusText}`);
    }

    const orderData = await orderResponse.json();
    const fills = orderData.fills || [];
    const totalExecuted = fills.reduce((sum: number, fill: any) => sum + parseFloat(fill.qty), 0);
    const avgPrice = fills.length > 0
      ? fills.reduce((sum: number, fill: any) => sum + (parseFloat(fill.price) * parseFloat(fill.qty)), 0) / totalExecuted
      : 0;

    console.log(`✅ Ordem executada com sucesso!`);
    console.log(`🆔 Order ID: ${orderData.orderId}`);
    console.log(`💹 Preço médio: $${avgPrice.toFixed(6)}`);

    let resultMessage = '';
    if (direction === 'toUsdt') {
      const usdtReceived = totalExecuted * avgPrice;
      resultMessage = `${totalExecuted.toFixed(6)} ${symbol} convertido para ${usdtReceived.toFixed(2)} USDT`;
      console.log(`💵 USDT recebido: ${usdtReceived.toFixed(2)}`);
    } else {
      resultMessage = `USDT convertido para ${totalExecuted.toFixed(6)} ${symbol}`;
      console.log(`🪙 ${symbol} recebido: ${totalExecuted.toFixed(6)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: resultMessage,
        orderId: orderData.orderId,
        symbol,
        direction,
        executedQty: totalExecuted,
        avgPrice,
        fills
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

async function createSignature(queryString: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(queryString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
