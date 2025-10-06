import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrendingToken {
  symbol: string;
  change24h: number;
  volume24h: number;
  price: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  exchange: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    console.log(`📊 Analisando tendências de mercado - User: ${userId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar credenciais ativas
    const { data: credentials } = await supabase
      .from('exchange_api_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!credentials || credentials.length === 0) {
      throw new Error('Credenciais não configuradas');
    }

    const trendingTokens: TrendingToken[] = [];

    // Analisar Binance
    const binanceCred = credentials.find(c => c.exchange === 'binance');
    if (binanceCred) {
      const binanceTrends = await analyzeBinanceTrends();
      trendingTokens.push(...binanceTrends);
    }

    // Analisar OKX
    const okxCred = credentials.find(c => c.exchange === 'okx');
    if (okxCred) {
      const okxTrends = await analyzeOKXTrends(okxCred);
      trendingTokens.push(...okxTrends);
    }

    // Filtrar apenas tokens relevantes e com tendências fortes
    const strongTrends = trendingTokens.filter(t => 
      Math.abs(t.change24h) > 5 // Variação > 5%
    );

    // Separar em alta e baixa
    const bullishTokens = strongTrends
      .filter(t => t.change24h > 0)
      .sort((a, b) => b.change24h - a.change24h)
      .slice(0, 10); // Top 10 em alta

    const bearishTokens = strongTrends
      .filter(t => t.change24h < 0)
      .sort((a, b) => a.change24h - b.change24h)
      .slice(0, 10); // Top 10 em baixa

    console.log(`✅ Análise concluída: ${bullishTokens.length} em alta, ${bearishTokens.length} em baixa`);

    return new Response(
      JSON.stringify({
        success: true,
        bullish: bullishTokens,
        bearish: bearishTokens,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function analyzeBinanceTrends(): Promise<TrendingToken[]> {
  try {
    console.log('📊 Buscando tendências Binance...');
    
    // Buscar ticker 24h para tokens principais
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const tickers = await response.json();

    if (!Array.isArray(tickers)) {
      console.error('Resposta inválida da Binance');
      return [];
    }

    // Filtrar apenas pares USDT de tokens relevantes
    const relevantTokens = ['BTC', 'ETH', 'SOL', 'BNB', 'USDC', 'ADA', 'XRP', 'DOGE', 'MATIC', 'DOT'];
    
    const trends: TrendingToken[] = tickers
      .filter((t: any) => {
        const symbol = t.symbol.replace('USDT', '');
        return t.symbol.endsWith('USDT') && relevantTokens.includes(symbol);
      })
      .map((t: any) => {
        const change24h = parseFloat(t.priceChangePercent);
        return {
          symbol: t.symbol.replace('USDT', ''),
          change24h,
          volume24h: parseFloat(t.quoteVolume),
          price: parseFloat(t.lastPrice),
          trend: change24h > 3 ? 'bullish' : change24h < -3 ? 'bearish' : 'neutral',
          exchange: 'binance'
        };
      });

    console.log(`✅ Binance: ${trends.length} tokens analisados`);
    return trends;

  } catch (error) {
    console.error('❌ Erro ao analisar Binance:', error);
    return [];
  }
}

async function analyzeOKXTrends(credentials: any): Promise<TrendingToken[]> {
  try {
    console.log('📊 Buscando tendências OKX...');
    
    const timestamp = new Date().toISOString();
    const method = 'GET';
    const path = '/api/v5/market/tickers?instType=SPOT';
    
    const signString = timestamp + method + path;
    
    // Criar signature HMAC SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(credentials.secret_key);
    const messageData = encoder.encode(signString);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    const response = await fetch(`https://www.okx.com${path}`, {
      headers: {
        'OK-ACCESS-KEY': credentials.api_key,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': credentials.passphrase,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.code !== '0') {
      console.error('Erro OKX:', result.msg);
      return [];
    }

    const relevantTokens = ['BTC', 'ETH', 'SOL', 'BNB', 'USDC', 'ADA', 'XRP', 'DOGE', 'MATIC', 'DOT'];
    
    const trends: TrendingToken[] = result.data
      .filter((t: any) => {
        const instId = t.instId || '';
        const symbol = instId.replace('-USDT', '');
        return instId.endsWith('-USDT') && relevantTokens.includes(symbol);
      })
      .map((t: any) => {
        const change24h = parseFloat(t.changePercent || '0') * 100;
        return {
          symbol: t.instId.replace('-USDT', ''),
          change24h,
          volume24h: parseFloat(t.volCcy24h || '0'),
          price: parseFloat(t.last || '0'),
          trend: change24h > 3 ? 'bullish' : change24h < -3 ? 'bearish' : 'neutral',
          exchange: 'okx'
        };
      });

    console.log(`✅ OKX: ${trends.length} tokens analisados`);
    return trends;

  } catch (error) {
    console.error('❌ Erro ao analisar OKX:', error);
    return [];
  }
}