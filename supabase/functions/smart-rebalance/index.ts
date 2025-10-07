import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrendingToken {
  symbol: string;
  change24h: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  exchange: string;
}

interface RebalanceRequest {
  userId: string;
  targetAllocations: Record<string, number>;
  maxDeviation: number;
  minTradeValue: number;
  specificExchange?: string; // Opcional: rebalancear apenas uma exchange específica
  marketTrends?: {
    bullish: TrendingToken[];
    bearish: TrendingToken[];
  };
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
      minTradeValue = 10,
      specificExchange,
      marketTrends
    }: RebalanceRequest = await req.json();

    console.log(`📊 Tendências recebidas:`, {
      bullish: marketTrends?.bullish?.length || 0,
      bearish: marketTrends?.bearish?.length || 0
    });

    if (specificExchange) {
      console.log(`🔄 REBALANCEAMENTO INICIADO - User: ${userId} - Exchange: ${specificExchange}`);
    } else {
      console.log(`🔄 REBALANCEAMENTO INICIADO - User: ${userId} - Todas exchanges`);
    }

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

    // Lista de tokens para rebalanceamento em ordem de prioridade
    const REBALANCE_TOKENS = ['BTC', 'BNB', 'SOL', 'ETH', 'ENA']; // Ordem sequencial
    const VALID_TOKENS = ['USDT', ...REBALANCE_TOKENS, 'USDC', 'ATOM', 'NFT'];
    const MIN_TOKEN_VALUE = 0.1; // Mínimo $0.10 USD por token
    const TRADING_BASE_UNIT = 10; // Múltiplos de 10 ($10, $20, $30...)
    const MIN_TRADING_VALUE = 10; // Valor mínimo para rebalancear

    // Filtrar tokens válidos e com valor mínimo
    const validPortfolioData = portfolioData.filter((item: any) => {
      const isValidToken = VALID_TOKENS.includes(item.symbol);
      const hasMinValue = (item.value_usd_calculated || 0) >= MIN_TOKEN_VALUE;
      
      if (!isValidToken) {
        console.log(`⏭️ ${item.symbol} não suportado para rebalanceamento`);
      } else if (!hasMinValue) {
        console.log(`⏭️ ${item.symbol} com valor muito baixo: $${(item.value_usd_calculated || 0).toFixed(4)}`);
      }
      
      return isValidToken && hasMinValue;
    });

    if (validPortfolioData.length === 0) {
      console.log('⚠️ Nenhum ativo válido com saldo suficiente');
      return new Response(
        JSON.stringify({
          success: true,
          conversions: 0,
          message: 'Nenhum ativo válido com saldo suficiente para rebalanceamento',
          details: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ ${validPortfolioData.length} ativos válidos encontrados`);

    // Agrupar por exchange
    const byExchange = validPortfolioData.reduce((acc: any, item) => {
      const exchange = item.exchange || 'GLOBAL';
      if (!acc[exchange]) acc[exchange] = [];
      acc[exchange].push(item);
      return acc;
    }, {});

    // Filtrar por exchange específica se solicitado
    let exchangesToProcess = Object.entries(byExchange);
    if (specificExchange) {
      exchangesToProcess = exchangesToProcess.filter(([exchange]) => 
        exchange.toLowerCase() === specificExchange.toLowerCase()
      );
      
      if (exchangesToProcess.length === 0) {
        console.log(`⚠️ Exchange "${specificExchange}" não encontrada ou sem saldos`);
        return new Response(
          JSON.stringify({
            success: false,
            conversions: 0,
            message: `Exchange "${specificExchange}" não encontrada ou sem saldos`,
            details: []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let totalConversions = 0;
    const executionResults: any[] = [];

    // Processar cada exchange
    for (const [exchange, tokens] of exchangesToProcess) {
      console.log(`\n📊 Processando ${exchange}...`);
      
      const tokenArray = tokens as any[];
      const totalValue = tokenArray.reduce((sum: number, t: any) => sum + (t.value_usd_calculated || 0), 0);
      
      console.log(`💰 Valor total: $${totalValue.toFixed(2)}`);
      
      // Verificar se há valor mínimo para rebalancear
      if (totalValue < MIN_TRADING_VALUE) {
        console.log(`⏭️ Valor total muito baixo para rebalancear ($${totalValue.toFixed(2)} < $${MIN_TRADING_VALUE})`);
        continue;
      }

      // Calcular USDT disponível
      const usdtToken = tokenArray.find((t: any) => t.symbol === 'USDT');
      const currentUsdt = usdtToken?.value_usd_calculated || 0;
      
      // Calcular o valor base de trading como múltiplo de $40
      // Ex: $53 → $40, $100 → $80, $150 → $120
      const tradingValue = Math.floor(currentUsdt / TRADING_BASE_UNIT) * TRADING_BASE_UNIT;
      const usdtReserve = currentUsdt - tradingValue;
      
      if (tradingValue < MIN_TRADING_VALUE) {
        console.log(`⏭️ USDT insuficiente para rebalancear: $${currentUsdt.toFixed(2)} (mínimo $${MIN_TRADING_VALUE})`);
        continue;
      }
      
      console.log(`💵 USDT total: $${currentUsdt.toFixed(2)} | Reserva fees: $${usdtReserve.toFixed(2)} | Trading: $${tradingValue.toFixed(2)}`);

      // Filtrar apenas tokens de rebalanceamento (BTC, ETH, SOL, BNB)
      const rebalanceTokens = tokenArray.filter((t: any) => REBALANCE_TOKENS.includes(t.symbol));
      const currentRebalanceValue = rebalanceTokens.reduce((sum: number, t: any) => sum + (t.value_usd_calculated || 0), 0);
      
      // Valor total para distribuir entre os tokens de rebalanceamento
      const totalRebalanceValue = tradingValue + currentRebalanceValue;
      
      console.log(`📊 Valor para rebalancear: $${totalRebalanceValue.toFixed(2)} (USDT: $${tradingValue.toFixed(2)} + Tokens: $${currentRebalanceValue.toFixed(2)})`);
      
      if (totalRebalanceValue < 5) {
        console.log(`⏭️ Valor insuficiente para rebalancear`);
        continue;
      }

      // Calcular alocações ideais mantendo a ordem sequencial: BTC, BNB, SOL, ETH, ENA
      const targetPercentPerToken = 100 / REBALANCE_TOKENS.length;
      
      const allocations = REBALANCE_TOKENS.map((symbol: string) => {
        const token = tokenArray.find((t: any) => t.symbol === symbol);
        const currentValue = token?.value_usd_calculated || 0;
        
        return {
          symbol,
          currentValue,
          currentPercent: (currentValue / totalRebalanceValue) * 100,
          targetPercent: targetPercentPerToken,
          targetValue: (totalRebalanceValue * targetPercentPerToken) / 100,
          balance: token?.balance || 0,
          price_usd: token?.price_usd || 0
        };
      });

      console.log('📈 Alocações atuais (ordem sequencial: USDT→BTC, USDT→BNB, USDT→SOL, USDT→ETH, USDT→ENA):', allocations.map((a: any) =>
        `${a.symbol}: ${a.currentPercent.toFixed(1)}% ($${a.currentValue.toFixed(2)}) → alvo ${a.targetPercent.toFixed(1)}% ($${a.targetValue.toFixed(2)})`
      ).join(' | '));

      // Processar conversões na ordem sequencial definida
      for (const alloc of allocations) {
        const deviation = Math.abs(alloc.currentPercent - alloc.targetPercent);
        const deltaValue = Math.abs(alloc.currentValue - alloc.targetValue);
        
        // Verificar se token está em tendência forte
        const isBullish = marketTrends?.bullish?.some(t => 
          t.symbol === alloc.symbol && t.exchange.toLowerCase() === exchange.toLowerCase()
        );
        const isBearish = marketTrends?.bearish?.some(t => 
          t.symbol === alloc.symbol && t.exchange.toLowerCase() === exchange.toLowerCase()
        );

        // Ajustar decisão baseado em tendências
        let shouldProcess = deviation > maxDeviation && deltaValue >= minTradeValue;
        
        // Se token está em alta forte, priorizar compra mesmo com desvio menor
        if (isBullish && alloc.currentPercent < alloc.targetPercent && deltaValue >= minTradeValue) {
          shouldProcess = true;
          console.log(`  🚀 ${alloc.symbol} em forte alta - priorizando compra`);
        }
        
        // Se token está em baixa forte, priorizar venda mesmo com desvio menor
        if (isBearish && alloc.currentPercent > alloc.targetPercent && deltaValue >= minTradeValue) {
          shouldProcess = true;
          console.log(`  📉 ${alloc.symbol} em forte baixa - priorizando venda`);
        }
        
        if (shouldProcess) {
          const needsToSell = alloc.currentPercent > alloc.targetPercent || isBearish;
          
          console.log(`\n🔄 USDT → ${alloc.symbol}:`);
          console.log(`  Desvio: ${deviation.toFixed(1)}% | Delta: $${deltaValue.toFixed(2)}`);
          console.log(`  Ação: ${needsToSell ? 'VENDER' : 'COMPRAR'}`);

          // Validações adicionais - valores mínimos reduzidos
          if (needsToSell) {
            // Vender token → USDT (conversão reversa)
            const minSellValue = 1; // Reduzido de $5 para $1
            if (deltaValue < minSellValue) {
              console.log(`  ⏭️ Valor de venda muito baixo: $${deltaValue.toFixed(2)} < $${minSellValue}`);
              continue;
            }
            
            if (alloc.balance <= 0) {
              console.log(`  ⏭️ Saldo zero para venda`);
              continue;
            }
          } else {
            // Comprar token com USDT (conversão sequencial USDT → Token)
            const usdtAlloc = tokenArray.find((t: any) => t.symbol === 'USDT');
            const availableUsdt = usdtAlloc?.value_usd_calculated || 0;
            const minBuyValue = 1; // Reduzido de $5 para $1
            
            if (availableUsdt < minBuyValue) {
              console.log(`  ⏭️ USDT insuficiente: $${availableUsdt.toFixed(2)} < $${minBuyValue}`);
              continue;
            }
            
            if (deltaValue < minBuyValue) {
              console.log(`  ⏭️ Valor de compra muito baixo: $${deltaValue.toFixed(2)} < $${minBuyValue}`);
              continue;
            }
          }

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
            } else {
              console.log(`  ⚠️ Conversão não executada: ${result.error}`);
              executionResults.push({
                exchange,
                from: needsToSell ? alloc.symbol : 'USDT',
                to: needsToSell ? 'USDT' : alloc.symbol,
                value: deltaValue,
                error: result.error,
                status: 'skipped'
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
): Promise<{ success: boolean; error?: string }> {
  
  console.log(`🔄 Executando conversão: ${fromToken} → ${toToken} ($${valueUsd.toFixed(2)}) em ${exchange}`);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // As funções swap esperam: symbol e direction ('toUsdt' ou 'toToken')
    let symbol: string;
    let direction: string;
    
    if (toToken === 'USDT') {
      // Vendendo fromToken para USDT
      symbol = fromToken;
      direction = 'toUsdt';
    } else {
      // Comprando toToken com USDT
      symbol = toToken;
      direction = 'toToken';
    }

    console.log(`  📝 Parâmetros: symbol=${symbol}, direction=${direction}`);

    if (exchange.toLowerCase() === 'binance') {
      if (!binanceCred) {
        console.log('  ⚠️ Credenciais Binance não encontradas');
        return { success: false, error: 'Credenciais Binance não encontradas' };
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/binance-swap-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          apiKey: binanceCred.api_key,
          secretKey: binanceCred.secret_key,
          symbol: symbol,
          direction: direction,
          orderType: 'market'
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        console.log(`  ❌ Binance swap falhou: ${result.error}`);
        return { success: false, error: result.error };
      }
      
      console.log(`  ✅ Binance swap executado com sucesso`);
      return { success: true };

    } else if (exchange.toLowerCase() === 'okx') {
      if (!okxCred) {
        console.log('  ⚠️ Credenciais OKX não encontradas');
        return { success: false, error: 'Credenciais OKX não encontradas' };
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/okx-swap-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          apiKey: okxCred.api_key,
          secretKey: okxCred.secret_key,
          passphrase: okxCred.passphrase,
          symbol: symbol,
          direction: direction,
          orderType: 'market'
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        console.log(`  ❌ OKX swap falhou: ${result.error}`);
        return { success: false, error: result.error };
      }
      
      console.log(`  ✅ OKX swap executado com sucesso`);
      return { success: true };

    } else {
      const error = `Exchange ${exchange} não suportada`;
      console.log(`  ❌ ${error}`);
      return { success: false, error };
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Erro na conversão:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}
