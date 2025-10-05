import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversionResult {
  symbol: string;
  amount: string;
  success: boolean;
  usdtReceived?: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey, secretKey, passphrase, minUsdValue = 10 } = await req.json();

    if (!apiKey || !secretKey || !passphrase) {
      throw new Error('Credenciais OKX incompletas');
    }

    console.log('🔄 Iniciando conversão automática OKX para USDT');
    console.log(`💰 Valor mínimo por token: $${minUsdValue}`);

    // Buscar saldos da conta
    const balancesResponse = await callOKXAPI('/api/v5/account/balance', 'GET', {}, apiKey, secretKey, passphrase);
    
    if (!balancesResponse.data || balancesResponse.data.length === 0) {
      throw new Error('Não foi possível obter saldos da OKX');
    }

    const balances = balancesResponse.data[0].details || [];
    console.log(`📊 Total de ativos na conta: ${balances.length}`);

    // Filtrar tokens para converter (excluir USDT, USDC e saldos zerados)
    const tokensToConvert = balances.filter((asset: any) => {
      const availBal = parseFloat(asset.availBal || '0');
      return availBal > 0 && 
             asset.ccy !== 'USDT' && 
             asset.ccy !== 'USDC';
    });

    console.log(`🎯 Tokens candidatos à conversão: ${tokensToConvert.length}`);

    if (tokensToConvert.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum token para converter',
          conversions: [],
          totalUsdtReceived: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar preços atuais dos tokens
    const tickersResponse = await callOKXAPI('/api/v5/market/tickers', 'GET', { instType: 'SPOT' }, apiKey, secretKey, passphrase);
    const tickers = tickersResponse.data || [];
    
    const priceMap = new Map();
    tickers.forEach((ticker: any) => {
      priceMap.set(ticker.instId, parseFloat(ticker.last || '0'));
    });

    console.log(`💹 Preços obtidos para ${priceMap.size} pares`);

    const results: ConversionResult[] = [];
    let totalUsdtReceived = 0;

    // Processar cada token
    for (const token of tokensToConvert) {
      const symbol = token.ccy;
      const balance = parseFloat(token.availBal);
      const tradePair = `${symbol}-USDT`;
      const price = priceMap.get(tradePair) || 0;
      const estimatedValue = balance * price;

      console.log(`\n🔍 Analisando ${symbol}:`);
      console.log(`   Saldo: ${balance}`);
      console.log(`   Preço: $${price}`);
      console.log(`   Valor estimado: $${estimatedValue.toFixed(2)}`);

      // Pular se não houver par de trading ou valor abaixo do mínimo
      if (price === 0) {
        console.log(`   ⚠️ Sem par ${tradePair} disponível`);
        results.push({
          symbol,
          amount: balance.toString(),
          success: false,
          error: `Par ${tradePair} não disponível`
        });
        continue;
      }

      if (estimatedValue < minUsdValue) {
        console.log(`   ⏭️ Valor abaixo do mínimo ($${minUsdValue})`);
        results.push({
          symbol,
          amount: balance.toString(),
          success: false,
          error: `Valor abaixo do mínimo ($${estimatedValue.toFixed(2)} < $${minUsdValue})`
        });
        continue;
      }

      // Buscar informações do instrumento para tamanho mínimo de ordem
      const instrumentResponse = await callOKXAPI(
        '/api/v5/public/instruments',
        'GET',
        { instType: 'SPOT', instId: tradePair },
        apiKey,
        secretKey,
        passphrase
      );

      if (!instrumentResponse.data || instrumentResponse.data.length === 0) {
        console.log(`   ❌ Instrumento ${tradePair} não encontrado`);
        results.push({
          symbol,
          amount: balance.toString(),
          success: false,
          error: `Instrumento ${tradePair} não encontrado`
        });
        continue;
      }

      const instrument = instrumentResponse.data[0];
      const minSize = parseFloat(instrument.minSz || '0');
      const lotSize = parseFloat(instrument.lotSz || '0.00000001');

      // Ajustar quantidade para o lot size
      let orderSize = balance;
      if (lotSize > 0) {
        orderSize = Math.floor(balance / lotSize) * lotSize;
      }

      if (orderSize < minSize) {
        console.log(`   ⚠️ Quantidade ${orderSize} abaixo do mínimo ${minSize}`);
        results.push({
          symbol,
          amount: balance.toString(),
          success: false,
          error: `Quantidade abaixo do mínimo de ordem (${orderSize} < ${minSize})`
        });
        continue;
      }

      // Executar ordem de venda MARKET
      try {
        console.log(`   📤 Executando ordem MARKET SELL: ${orderSize} ${symbol}`);
        
        const orderResponse = await callOKXAPI(
          '/api/v5/trade/order',
          'POST',
          {
            instId: tradePair,
            tdMode: 'cash',
            side: 'sell',
            ordType: 'market',
            sz: orderSize.toString()
          },
          apiKey,
          secretKey,
          passphrase
        );

        if (orderResponse.code === '0' && orderResponse.data && orderResponse.data.length > 0) {
          const orderId = orderResponse.data[0].ordId;
          const usdtReceived = orderSize * price;
          
          console.log(`   ✅ Ordem executada com sucesso!`);
          console.log(`   🆔 Order ID: ${orderId}`);
          console.log(`   💵 USDT recebido (estimado): ${usdtReceived.toFixed(4)}`);

          results.push({
            symbol,
            amount: orderSize.toString(),
            success: true,
            usdtReceived
          });

          totalUsdtReceived += usdtReceived;
        } else {
          const errorMsg = orderResponse.msg || 'Erro desconhecido na execução da ordem';
          console.log(`   ❌ Falha na ordem: ${errorMsg}`);
          results.push({
            symbol,
            amount: orderSize.toString(),
            success: false,
            error: errorMsg
          });
        }

        // Aguardar 200ms entre ordens para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (orderError: any) {
        console.log(`   ❌ Erro ao executar ordem: ${orderError.message}`);
        results.push({
          symbol,
          amount: balance.toString(),
          success: false,
          error: orderError.message
        });
      }
    }

    console.log(`\n✅ Conversão finalizada!`);
    console.log(`📊 Total convertido: ${totalUsdtReceived.toFixed(2)} USDT`);
    console.log(`✔️ Sucessos: ${results.filter(r => r.success).length}`);
    console.log(`❌ Falhas: ${results.filter(r => !r.success).length}`);

    return new Response(
      JSON.stringify({
        success: true,
        conversions: results,
        totalUsdtReceived,
        message: `Conversão concluída: ${results.filter(r => r.success).length}/${results.length} tokens convertidos`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na conversão:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        conversions: [],
        totalUsdtReceived: 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
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
