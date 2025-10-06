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

    // Lista de tokens válidos para rebalanceamento
    const VALID_TOKENS = ['USDT', 'BTC', 'ETH', 'SOL', 'USDC', 'BNB'];
    const MIN_TOKEN_VALUE = 1; // Mínimo $1 USD por token

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

    let totalConversions = 0;
    const executionResults: any[] = [];

    // Processar cada exchange
    for (const [exchange, tokens] of Object.entries(byExchange)) {
      console.log(`\n📊 Processando ${exchange}...`);
      
      const tokenArray = tokens as any[];
      const totalValue = tokenArray.reduce((sum: number, t: any) => sum + (t.value_usd_calculated || 0), 0);
      
      console.log(`💰 Valor total: $${totalValue.toFixed(2)}`);
      
      if (totalValue < minTradeValue * 2) {
        console.log(`⏭️ Valor total muito baixo para rebalancear ($${totalValue.toFixed(2)} < $${minTradeValue * 2})`);
        continue;
      }

      // Obter apenas os tokens que existem no portfolio
      const availableTokens = tokenArray.map((t: any) => t.symbol);
      console.log(`📋 Tokens disponíveis: ${availableTokens.join(', ')}`);

      const allocations = tokenArray.map((token: any) => ({
        symbol: token.symbol,
        currentValue: token.value_usd_calculated || 0,
        currentPercent: (token.value_usd_calculated / totalValue) * 100,
        targetPercent: targetAllocations[token.symbol] || 0,
        targetValue: (totalValue * (targetAllocations[token.symbol] || 0)) / 100,
        balance: token.balance,
        price_usd: token.price_usd || 0
      }));

      console.log('📈 Alocações atuais:', allocations.map((a: any) =>
        `${a.symbol}: ${a.currentPercent.toFixed(1)}% (alvo ${a.targetPercent}%)`
      ).join(' | '));

      for (const alloc of allocations) {
        const deviation = Math.abs(alloc.currentPercent - alloc.targetPercent);
        const deltaValue = Math.abs(alloc.currentValue - alloc.targetValue);
        
        if (deviation > maxDeviation && deltaValue >= minTradeValue) {
          const needsToSell = alloc.currentPercent > alloc.targetPercent;
          
          console.log(`\n🔄 ${alloc.symbol}:`);
          console.log(`  Desvio: ${deviation.toFixed(1)}% | Delta: $${deltaValue.toFixed(2)}`);
          console.log(`  Ação: ${needsToSell ? 'VENDER' : 'COMPRAR'}`);

          // Validações adicionais
          if (needsToSell) {
            // Vender token → USDT
            const minSellValue = 5; // Mínimo $5 para vender
            if (deltaValue < minSellValue) {
              console.log(`  ⏭️ Valor de venda muito baixo: $${deltaValue.toFixed(2)} < $${minSellValue}`);
              continue;
            }
            
            if (alloc.balance <= 0) {
              console.log(`  ⏭️ Saldo zero para venda`);
              continue;
            }
          } else {
            // Comprar token com USDT
            const usdtAlloc = allocations.find((a: any) => a.symbol === 'USDT');
            const availableUsdt = usdtAlloc?.currentValue || 0;
            const minBuyValue = 5; // Mínimo $5 para comprar
            
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
