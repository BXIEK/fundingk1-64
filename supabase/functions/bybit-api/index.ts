import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, api_key, secret_key } = await req.json();
    console.log(`🎯 Ação Bybit solicitada: ${action}`);

    // Usar secrets do Supabase como fallback
    const bybitApiKey = api_key || Deno.env.get('BYBIT_API_KEY');
    const bybitSecretKey = secret_key || Deno.env.get('BYBIT_SECRET_KEY');

    if (!bybitApiKey || !bybitSecretKey) {
      console.error('❌ Credenciais Bybit não fornecidas');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Credenciais Bybit não configuradas'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const baseUrl = 'https://api.bybit.com';

    function generateSignature(timestamp: string, apiKey: string, recvWindow: string, queryString: string, secretKey: string): string {
      const message = timestamp + apiKey + recvWindow + queryString;
      return createHmac('sha256', secretKey).update(message).digest('hex');
    }

    if (action === 'get_balances') {
      console.log('📊 Obtendo saldos da Bybit...');
      console.log('🔗 CONEXÃO DIRETA BYBIT - SEM PROXIES/BYPASS');

      const timestamp = Date.now().toString();
      const recvWindow = '5000';
      const queryString = 'accountType=UNIFIED';
      const signature = generateSignature(timestamp, bybitApiKey, recvWindow, queryString, bybitSecretKey);

      const url = `${baseUrl}/v5/account/wallet-balance?${queryString}`;
      
      console.log('🌐 Bybit Direct Request: GET ' + url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-BAPI-API-KEY': bybitApiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-SIGN': signature,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.retCode !== 0) {
        console.error('❌ Erro da Bybit:', data.retMsg);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Erro Bybit: ${data.retMsg}`,
            code: data.retCode
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const balances = [];
      if (data.result?.list?.[0]?.coin) {
        for (const coin of data.result.list[0].coin) {
          const totalBalance = parseFloat(coin.walletBalance || '0');
          if (totalBalance > 0) {
            balances.push({
              symbol: coin.coin,
              balance: totalBalance,
              available: parseFloat(coin.availableToWithdraw || '0'),
              locked: parseFloat(coin.locked || '0'),
              source: 'bybit'
            });
          }
        }
      }

      console.log(`✅ Saldos da Bybit obtidos: ${balances.length} moedas`);

      return new Response(
        JSON.stringify({
          success: true,
          balances,
          total_assets: balances.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_prices') {
      console.log('📊 Obtendo preços da Bybit...');

      const url = `${baseUrl}/v5/market/tickers?category=spot`;
      
      console.log('🌐 Bybit Direct Request: GET ' + url);

      const response = await fetch(url);
      const data = await response.json();

      if (data.retCode !== 0) {
        console.error('❌ Erro da Bybit:', data.retMsg);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Erro Bybit: ${data.retMsg}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const prices: Record<string, number> = {};
      if (data.result?.list) {
        for (const ticker of data.result.list) {
          if (ticker.symbol.endsWith('USDT')) {
            const symbol = ticker.symbol.replace('USDT', '');
            prices[symbol] = parseFloat(ticker.lastPrice);
          }
        }
      }

      console.log(`✅ Preços da Bybit obtidos: ${Object.keys(prices).length} símbolos`);

      return new Response(
        JSON.stringify({
          success: true,
          prices,
          total_symbols: Object.keys(prices).length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação não suportada' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('❌ Erro geral na Bybit API:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
