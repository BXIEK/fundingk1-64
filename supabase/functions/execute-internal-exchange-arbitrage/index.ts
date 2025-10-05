import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArbitrageRequest {
  userId: string;
  symbol: string;
  buyExchange: 'binance' | 'okx';
  sellExchange: 'binance' | 'okx';
  amount: number;
  buyPrice: number;
  sellPrice: number;
  spreadPercent: number;
}

serve(async (req) => {
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
      symbol,
      buyExchange,
      sellExchange,
      amount,
      buyPrice,
      sellPrice,
      spreadPercent
    } = await req.json() as ArbitrageRequest;

    console.log(`🎯 Arbitragem Interna: ${symbol}`);
    console.log(`📊 Comprar ${amount} ${symbol} na ${buyExchange} a $${buyPrice}`);
    console.log(`📊 Vender ${amount} ${symbol} na ${sellExchange} a $${sellPrice}`);
    console.log(`💰 Spread: ${spreadPercent.toFixed(3)}%`);

    // Buscar credenciais do banco de dados
    const { data: credentials, error: credError } = await supabase
      .from('exchange_api_configs')
      .select('exchange, api_key, secret_key, passphrase')
      .eq('user_id', userId)
      .in('exchange', [buyExchange, sellExchange]);

    if (credError || !credentials || credentials.length < 2) {
      throw new Error('Credenciais não configuradas para ambas as exchanges');
    }

    const buyExchangeCreds = credentials.find(c => c.exchange === buyExchange);
    const sellExchangeCreds = credentials.find(c => c.exchange === sellExchange);

    if (!buyExchangeCreds || !sellExchangeCreds) {
      throw new Error('Credenciais incompletas');
    }

    // Executar operações em paralelo
    console.log(`🔄 Executando operações simultâneas...`);

    const [buyResult, sellResult] = await Promise.allSettled([
      // Comprar na exchange com preço menor (USDT → Token)
      executeSwap(buyExchange, buyExchangeCreds, symbol, 'toToken', amount, buyPrice),
      // Vender na exchange com preço maior (Token → USDT)
      executeSwap(sellExchange, sellExchangeCreds, symbol, 'toUsdt', amount, sellPrice)
    ]);

    const buySuccess = buyResult.status === 'fulfilled';
    const sellSuccess = sellResult.status === 'fulfilled';

    console.log(`📈 Compra na ${buyExchange}: ${buySuccess ? '✅' : '❌'}`);
    console.log(`📉 Venda na ${sellExchange}: ${sellSuccess ? '✅' : '❌'}`);

    // Calcular lucro
    const totalCost = amount * buyPrice;
    const totalRevenue = amount * sellPrice;
    const grossProfit = totalRevenue - totalCost;
    const estimatedFees = (totalCost + totalRevenue) * 0.001; // 0.1% em cada lado
    const netProfit = grossProfit - estimatedFees;

    // Registrar no banco de dados
    const { error: insertError } = await supabase
      .from('arbitrage_executions')
      .insert({
        user_id: userId,
        symbol: symbol,
        buy_exchange: buyExchange,
        sell_exchange: sellExchange,
        buy_price: buyPrice,
        sell_price: sellPrice,
        amount: amount,
        spread_percent: spreadPercent,
        gross_profit: grossProfit,
        net_profit: netProfit,
        estimated_fees: estimatedFees,
        buy_success: buySuccess,
        sell_success: sellSuccess,
        status: (buySuccess && sellSuccess) ? 'completed' : 'partial',
        execution_type: 'internal_arbitrage'
      });

    if (insertError) {
      console.error('Erro ao registrar execução:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: buySuccess && sellSuccess,
        buySuccess,
        sellSuccess,
        buyResult: buySuccess ? (buyResult as PromiseFulfilledResult<any>).value : null,
        sellResult: sellSuccess ? (sellResult as PromiseFulfilledResult<any>).value : null,
        buyError: !buySuccess ? (buyResult as PromiseRejectedResult).reason : null,
        sellError: !sellSuccess ? (sellResult as PromiseRejectedResult).reason : null,
        profit: {
          gross: grossProfit,
          net: netProfit,
          fees: estimatedFees,
          roi: (netProfit / totalCost) * 100
        },
        message: buySuccess && sellSuccess 
          ? `Arbitragem executada com sucesso! Lucro líquido: $${netProfit.toFixed(2)}`
          : 'Arbitragem parcialmente executada'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na arbitragem interna:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function executeSwap(
  exchange: string,
  credentials: any,
  symbol: string,
  direction: 'toUsdt' | 'toToken',
  amount: number,
  price: number
): Promise<any> {
  const functionName = exchange === 'binance' ? 'binance-swap-token' : 'okx-swap-token';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  const body = exchange === 'okx' 
    ? {
        apiKey: credentials.api_key,
        secretKey: credentials.secret_key,
        passphrase: credentials.passphrase,
        symbol: symbol.replace('USDT', ''),
        direction: direction,
        customAmount: direction === 'toToken' ? amount * price : amount
      }
    : {
        apiKey: credentials.api_key,
        secretKey: credentials.secret_key,
        symbol: symbol.replace('USDT', ''),
        direction: direction,
        customAmount: direction === 'toToken' ? amount * price : amount
      };

  console.log(`🔄 Chamando ${functionName} para ${direction === 'toToken' ? 'comprar' : 'vender'} ${symbol}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${exchange} swap failed: ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || `${exchange} swap failed`);
  }

  return result;
}
