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
  specificExchange?: string;
  mode?: string; // 'real' ou 'test'
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
      mode = 'real', // Padrão: modo real
      marketTrends
    }: RebalanceRequest = await req.json();

    const isRealMode = mode === 'real';
    console.log(`🎯 MODO DE EXECUÇÃO: ${isRealMode ? '⚡ REAL TRADING' : '🧪 SIMULAÇÃO'}`);

    console.log(`📊 Tendências recebidas:`, {
      bullish: marketTrends?.bullish?.length || 0,
      bearish: marketTrends?.bearish?.length || 0
    });

    if (specificExchange) {
      console.log(`🔄 REBALANCEAMENTO INICIADO - User: ${userId} - Exchange: ${specificExchange} - Modo: ${mode.toUpperCase()}`);
    } else {
      console.log(`🔄 REBALANCEAMENTO INICIADO - User: ${userId} - Todas exchanges - Modo: ${mode.toUpperCase()}`);
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
    const MIN_TRADING_VALUE = 10; // Valor mínimo para rebalancear ($10 = mínimo das exchanges)

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

      // LÓGICA DE DISTRIBUIÇÃO SEQUENCIAL
      // Ao invés de dividir igualmente, distribui $10 por vez seguindo a ordem: BTC, BNB, SOL, ETH, ENA
      // Para até esgotar o saldo disponível
      
      // Buscar preços de mercado para tokens sem saldo
      const marketPrices: { [key: string]: number } = {};
      for (const symbol of REBALANCE_TOKENS) {
        const token = tokenArray.find((t: any) => t.symbol === symbol);
        if (!token || !token.price_usd || token.price_usd === 0) {
          // Buscar preço do mercado Binance
          try {
            const priceResponse = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`);
            if (priceResponse.ok) {
              const priceData = await priceResponse.json();
              marketPrices[symbol] = parseFloat(priceData.price);
              console.log(`💵 Preço do token ${symbol}: $${marketPrices[symbol]}`);
            }
          } catch (error) {
            console.log(`⚠️ Não foi possível obter preço de mercado para ${symbol}`);
          }
        }
      }

      const allocations = REBALANCE_TOKENS.map((symbol: string) => {
        const token = tokenArray.find((t: any) => t.symbol === symbol);
        const currentValue = token?.value_usd_calculated || 0;
        const priceUsd = token?.price_usd || marketPrices[symbol] || 0;
        
        return {
          symbol,
          currentValue,
          currentPercent: (currentValue / totalRebalanceValue) * 100,
          targetValue: 10, // Sempre tentar alocar $10 (mínimo das exchanges)
          balance: token?.balance || 0,
          price_usd: priceUsd
        };
      });
      
      console.log('📈 Alocações sequenciais (ordem: BTC→BNB→SOL→ETH→ENA):', allocations.map((a: any) =>
        `${a.symbol}: atual $${a.currentValue.toFixed(2)} → alvo $10`
      ).join(' | '));

      // Processar conversões sequencialmente seguindo a ordem definida
      // Cada token tenta alocar $10, até esgotar o saldo disponível
      let remainingUsdt = tradingValue; // USDT disponível para distribuir
      
      for (const alloc of allocations) {
        console.log(`\n🔍 Analisando ${alloc.symbol} em ${exchange}:`);
        console.log(`  💰 Saldo atual: $${alloc.currentValue.toFixed(2)}`);
        console.log(`  🎯 Alvo: $${alloc.targetValue}`);
        console.log(`  💵 USDT disponível: $${remainingUsdt.toFixed(2)}`);
        
        // Verificar se precisa comprar (saldo atual < $10)
        const needsToBuy = alloc.currentValue < alloc.targetValue;
        const deltaValue = alloc.targetValue - alloc.currentValue;
        
        console.log(`  📊 Precisa comprar? ${needsToBuy ? 'SIM' : 'NÃO'} (delta: $${deltaValue.toFixed(2)})`);
        
        // Verificar se há USDT suficiente para converter $10
        const shouldProcess = needsToBuy && remainingUsdt >= minTradeValue;
        
        if (shouldProcess) {
          console.log(`  ⚡ COMPRANDO: $${alloc.targetValue} de ${alloc.symbol} em ${exchange}`);

          try {
            if (!isRealMode) {
              console.log(`  🧪 MODO SIMULAÇÃO - Conversão não executada`);
              executionResults.push({
                exchange,
                from: needsToBuy ? 'USDT' : alloc.symbol,
                to: needsToBuy ? alloc.symbol : 'USDT',
                value: deltaValue,
                status: 'simulated',
                message: 'Modo simulação ativo'
              });
              remainingUsdt -= alloc.targetValue; // Atualizar mesmo em simulação
              continue;
            }

            console.log(`  ⚡ EXECUTANDO CONVERSÃO REAL em ${exchange}...`);
            
            const result = await executeConversion(
              exchange,
              'USDT',
              alloc.symbol,
              alloc.targetValue, // Sempre $10
              binanceCred,
              okxCred,
              alloc.price_usd
            );

            if (result.success) {
              totalConversions++;
              remainingUsdt -= alloc.targetValue;
              console.log(`  ✅ ${exchange} - ${alloc.symbol} convertido! USDT restante: $${remainingUsdt.toFixed(2)}`);
              
              executionResults.push({
                exchange,
                from: 'USDT',
                to: alloc.symbol,
                value: alloc.targetValue,
                status: 'success'
              });
            } else {
              console.log(`  ⚠️ ${exchange} - Conversão de ${alloc.symbol} falhou: ${result.error}`);
              executionResults.push({
                exchange,
                from: 'USDT',
                to: alloc.symbol,
                value: alloc.targetValue,
                error: result.error,
                status: 'failed'
              });
              console.log(`  ⚠️ ${exchange} - Parando conversões devido a erro`);
              break;
            }

          } catch (error) {
            console.error(`  ❌ ${exchange} - Erro na conversão de ${alloc.symbol}:`, error);
            executionResults.push({
              exchange,
              from: 'USDT',
              to: alloc.symbol,
              error: error instanceof Error ? error.message : String(error),
              status: 'failed'
            });
            console.log(`  ⚠️ ${exchange} - Parando conversões devido a exceção`);
            break;
          }
        } else {
          if (!needsToBuy) {
            console.log(`  ✅ ${alloc.symbol} já tem saldo suficiente ($${alloc.currentValue.toFixed(2)} >= $${alloc.targetValue})`);
          } else {
            console.log(`  ⏭️ ${alloc.symbol} - USDT insuficiente ($${remainingUsdt.toFixed(2)} < $${minTradeValue})`);
            console.log(`  🛑 ${exchange} - Encerrando rebalanceamento (saldo esgotado)`);
            break; // Parar se não há mais saldo
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
  okxCred: any,
  tokenPrice?: number
): Promise<{ success: boolean; error?: string }> {
  
  console.log(`🔄 Executando conversão: ${fromToken} → ${toToken} ($${valueUsd.toFixed(2)}) em ${exchange}`);
  console.log(`💵 Preço do token: $${tokenPrice || 'não fornecido'}`);

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

      // Preparar body com amount para compras
      let requestBody: any = {
        apiKey: binanceCred.api_key,
        secretKey: binanceCred.secret_key,
        symbol: symbol,
        direction: direction,
        orderType: 'limit' // Usar limit para taxas menores (~0.02%)
      };
      
      // Passar valor em USDT como 'amount' para compras
      if (direction === 'toToken' && valueUsd > 0) {
        requestBody.amount = valueUsd;
        console.log(`  💰 Valor USDT a gastar: $${valueUsd.toFixed(2)}`);
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/binance-swap-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(requestBody)
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

      // Calcular quantidade se estiver comprando
      let requestBody: any = {
        apiKey: okxCred.api_key,
        secretKey: okxCred.secret_key,
        passphrase: okxCred.passphrase,
        symbol: symbol,
        direction: direction,
        orderType: 'limit' // Usar limit para taxas menores (~0.02%)
      };
      
      // Passar valor em USDT como 'amount' para compras
      if (direction === 'toToken' && valueUsd > 0) {
        requestBody.amount = valueUsd;
        console.log(`  💰 Valor USDT a gastar: $${valueUsd.toFixed(2)}`);
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/okx-swap-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(requestBody)
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
