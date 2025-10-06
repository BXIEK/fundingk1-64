import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RebalanceRequest {
  userId: string;
  targetAllocations: Record<string, number>;
  maxDeviation: number;
  minTradeValue: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      userId, 
      targetAllocations,
      maxDeviation = 10,
      minTradeValue = 10
    }: RebalanceRequest = await req.json();

    console.log(`🔄 REBALANCEAMENTO INICIADO - User: ${userId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar credenciais
    const { data: credentials } = await supabase
      .from('exchange_api_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!credentials || credentials.length === 0) {
      throw new Error('Credenciais não configuradas');
    }

    const binanceCred = credentials.find(c => c.exchange === 'binance');
    const okxCred = credentials.find(c => c.exchange === 'okx');

    // Buscar saldos
    const { data: portfolioData } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .gt('balance', 0);

    if (!portfolioData) {
      throw new Error('Sem saldos encontrados');
    }

    // Agrupar por exchange
    const byExchange = portfolioData.reduce((acc: any, item) => {
      const exchange = item.exchange || 'GLOBAL';
      if (!acc[exchange]) acc[exchange] = [];
      acc[exchange].push(item);
      return acc;
    }, {});

    let totalConversions = 0;
    const executionResults: any[] = [];

    // Processar cada exchange
    for (const [exchange, tokens] of Object.entries(byExchange)) {
      console.log(`\n📊 Processando ${exchange}...`);
      
      const tokenArray = tokens as any[];
      const totalValue = tokenArray.reduce((sum: number, t: any) => sum + (t.value_usd_calculated || 0), 0);
      
      if (totalValue < minTradeValue) {
        console.log(`⚠️ Valor total muito baixo: $${totalValue}`);
        continue;
      }

      const allocations = tokenArray.map((token: any) => ({
        symbol: token.symbol,
        currentValue: token.value_usd_calculated || 0,
        currentPercent: (token.value_usd_calculated / totalValue) * 100,
        targetPercent: targetAllocations[token.symbol] || 0,
        targetValue: (totalValue * (targetAllocations[token.symbol] || 0)) / 100,
        balance: token.balance
      }));

      console.log('📈 Alocações:', allocations.map((a: any) =>
        `${a.symbol}: ${a.currentPercent.toFixed(1)}% → ${a.targetPercent}%`
      ));

      for (const alloc of allocations) {
        const deviation = Math.abs(alloc.currentPercent - alloc.targetPercent);
        
        if (deviation > maxDeviation) {
          const needsToSell = alloc.currentPercent > alloc.targetPercent;
          const deltaValue = Math.abs(alloc.currentValue - alloc.targetValue);
          
          if (deltaValue < minTradeValue) continue;

          console.log(`🔄 ${alloc.symbol}: ${needsToSell ? 'VENDER' : 'COMPRAR'} ~$${deltaValue.toFixed(2)}`);

          try {
            const result = await executeConversion(
              exchange,
              needsToSell ? alloc.symbol : 'USDT',
              needsToSell ? 'USDT' : alloc.symbol,
              deltaValue,
              binanceCred,
              okxCred
            );

            if (result.success) {
              totalConversions++;
              executionResults.push({
                exchange,
                from: needsToSell ? alloc.symbol : 'USDT',
                to: needsToSell ? 'USDT' : alloc.symbol,
                value: deltaValue,
                status: 'success'
              });
            }

          } catch (error) {
            console.error(`❌ Erro na conversão:`, error);
            executionResults.push({
              exchange,
              error: error instanceof Error ? error.message : String(error),
              status: 'failed'
            });
          }
        }
      }
    }

    await supabase
      .from('smart_rebalance_configs')
      .update({ last_rebalance_at: new Date().toISOString() })
      .eq('user_id', userId);

    console.log(`\n✅ CONCLUÍDO: ${totalConversions} conversões`);

    return new Response(
      JSON.stringify({
        success: true,
        conversions: totalConversions,
        details: executionResults
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

async function executeConversion(
  exchange: string,
  fromToken: string,
  toToken: string,
  valueUsd: number,
  binanceCred: any,
  okxCred: any
): Promise<{ success: boolean }> {
  
  console.log(`🔄 Conversão: ${fromToken} → ${toToken} ($${valueUsd.toFixed(2)})`);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    if (exchange.toLowerCase() === 'binance') {
      const response = await fetch(`${supabaseUrl}/functions/v1/binance-swap-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          apiKey: binanceCred?.api_key,
          secretKey: binanceCred?.secret_key,
          fromToken,
          toToken,
          amount: 'all',
          orderType: 'market'
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return { success: true };

    } else if (exchange.toLowerCase() === 'okx') {
      const response = await fetch(`${supabaseUrl}/functions/v1/okx-swap-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          apiKey: okxCred?.api_key,
          secretKey: okxCred?.secret_key,
          passphrase: okxCred?.passphrase,
          fromToken,
          toToken,
          amount: 'all'
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return { success: true };

    } else {
      throw new Error(`Exchange ${exchange} não suportada`);
    }

  } catch (error) {
    console.error(`❌ Erro:`, error);
    return { success: false };
  }
}
