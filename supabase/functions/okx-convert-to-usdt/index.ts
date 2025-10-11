import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

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
    const { apiKey, secretKey, passphrase, minUsdValue = 10, userId } = await req.json();
    
    // Buscar user_id se não fornecido
    let finalUserId = userId
    if (!finalUserId) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabase.auth.getUser(token)
        finalUserId = user?.id
      }
    }

    if (!apiKey || !secretKey || !passphrase) {
      throw new Error('Credenciais OKX incompletas');
    }

    console.log('🔄 Iniciando conversão automática OKX para USDT');
    console.log(`💰 Valor mínimo por token: $${minUsdValue}`);

    // ⭐ ETAPA 1: Transferir todos os tokens da Funding para Trading
    console.log(`\n📤 ETAPA 1: Transferindo tokens de Funding → Trading...`);
    try {
      const fundingResponse = await callOKXAPI('/api/v5/asset/balances', 'GET', {}, apiKey, secretKey, passphrase);
      
      if (fundingResponse.data && Array.isArray(fundingResponse.data)) {
        const fundingTokens = fundingResponse.data.filter((b: any) => {
          const bal = parseFloat(b.availBal || '0');
          return bal > 0 && b.ccy !== 'USDT' && b.ccy !== 'USDC';
        });
        
        console.log(`💰 Encontrados ${fundingTokens.length} tokens na Funding Account`);
        
        for (const token of fundingTokens) {
          const balance = parseFloat(token.availBal);
          console.log(`  📤 Transferindo ${balance} ${token.ccy}...`);
          
          try {
            const transferResponse = await callOKXAPI(
              '/api/v5/asset/transfer',
              'POST',
              {
                ccy: token.ccy,
                amt: balance.toString(),
                from: '6', // Funding
                to: '18',  // Trading
                type: '0'
              },
              apiKey,
              secretKey,
              passphrase
            );
            
            if (transferResponse.code === '0') {
              console.log(`  ✅ ${token.ccy} transferido com sucesso`);
            } else {
              console.warn(`  ⚠️ Falha ao transferir ${token.ccy}: ${transferResponse.msg}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (transferError: any) {
            console.warn(`  ⚠️ Erro ao transferir ${token.ccy}: ${transferError.message}`);
          }
        }
        
        // Aguardar 2 segundos para todas as transferências processarem
        if (fundingTokens.length > 0) {
          console.log(`⏳ Aguardando processamento das transferências...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (fundingError: any) {
      console.warn(`⚠️ Erro ao processar Funding Account: ${fundingError.message}`);
      console.log(`ℹ️ Continuando com tokens da Trading Account...`);
    }

    // ⭐ ETAPA 2: Buscar saldos da Trading Account
    console.log(`\n🔍 ETAPA 2: Buscando saldos na Trading Account...`);
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

          // ⭐ Salvar no histórico de conversões
          if (finalUserId) {
            try {
              await supabase.from('conversion_history').insert({
                user_id: finalUserId,
                from_token: symbol,
                to_token: 'USDT',
                from_amount: orderSize,
                to_amount: usdtReceived,
                exchange: 'OKX',
                conversion_type: 'market',
                price: price,
                status: 'success'
              })
              console.log(`   💾 Conversão ${symbol}→USDT salva no histórico`)
            } catch (dbError) {
              console.error(`   ⚠️ Erro ao salvar histórico:`, dbError)
            }
          }
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
        
        // ⭐ Salvar falha no histórico
        if (finalUserId) {
          try {
            await supabase.from('conversion_history').insert({
              user_id: finalUserId,
              from_token: symbol,
              to_token: 'USDT',
              from_amount: orderSize,
              to_amount: 0,
              exchange: 'OKX',
              conversion_type: 'market',
              price: price,
              status: 'failed',
              error_message: orderError.message
            });
          } catch (dbError) {
            console.error(`⚠️ Erro ao salvar histórico de falha:`, dbError);
          }
        }
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
