import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BalanceMonitoringResult {
  user_id: string
  exchanges_checked: string[]
  balances_found: any[]
  rebalance_needed: boolean
  rebalance_recommendations: any[]
  next_check_at: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔍 Iniciando monitoramento de saldos e geração de alertas...')

    // Buscar todas as configurações ativas de usuários
    const { data: configs, error: configError } = await supabaseClient
      .from('auto_balance_configs')
      .select('*')
      .eq('is_enabled', true)
      .lte('last_check_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Não verificado há 1 hora

    if (configError) {
      console.error('❌ Erro ao buscar configurações:', configError)
      throw configError
    }

    console.log(`📊 Encontradas ${configs?.length || 0} configurações para monitorar`)

    const results: BalanceMonitoringResult[] = []

    for (const config of configs || []) {
      console.log(`👤 Monitorando usuário: ${config.user_id}`)
      
      try {
        // Buscar saldos atuais do usuário
        const { data: portfolios, error: portfolioError } = await supabaseClient
          .from('portfolios')
          .select('*')
          .eq('user_id', config.user_id)

        if (portfolioError) {
          console.error(`❌ Erro ao buscar portfolios do usuário ${config.user_id}:`, portfolioError)
          continue
        }

        // Agrupar saldos por exchange e símbolo
        const balancesByExchange = groupBalancesByExchange(portfolios || [])
        
        // Analisar necessidades de rebalanceamento
        const analysis = await analyzeRebalanceNeeds(
          config, 
          balancesByExchange, 
          supabaseClient
        )

        // Se precisa rebalancear, criar recomendações (não executar transferências reais)
        if (analysis.needs_rebalance) {
          console.log(`⚠️ Usuário ${config.user_id} precisa de rebalanceamento`)
          
          // Criar recomendações de rebalanceamento
          for (const recommendation of analysis.recommendations) {
            await createRebalanceRecommendation(
              config.user_id,
              recommendation,
              supabaseClient
            )
          }
        }

        // Atualizar timestamp da última verificação
        await supabaseClient
          .from('auto_balance_configs')
          .update({ 
            last_check_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', config.id)

        results.push({
          user_id: config.user_id,
          exchanges_checked: Object.keys(balancesByExchange),
          balances_found: portfolios || [],
          rebalance_needed: analysis.needs_rebalance,
          rebalance_recommendations: analysis.recommendations,
          next_check_at: new Date(Date.now() + config.rebalance_frequency_hours * 60 * 60 * 1000).toISOString()
        })

      } catch (userError) {
        console.error(`❌ Erro ao processar usuário ${config.user_id}:`, userError)
        continue
      }
    }

    console.log(`✅ Monitoramento concluído. ${results.length} usuários processados`)

    return new Response(
      JSON.stringify({
        success: true,
        processed_users: results.length,
        results: results,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Erro no monitoramento de saldos:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

function groupBalancesByExchange(portfolios: any[]) {
  const grouped: { [exchange: string]: { [symbol: string]: any } } = {}
  
  for (const portfolio of portfolios) {
    const exchange = portfolio.exchange || 'default'
    if (!grouped[exchange]) {
      grouped[exchange] = {}
    }
    grouped[exchange][portfolio.symbol] = portfolio
  }
  
  return grouped
}

async function analyzeRebalanceNeeds(
  config: any, 
  balancesByExchange: any, 
  supabaseClient: any
) {
  const recommendations = []
  let needs_rebalance = false

  // Analisar principais exchanges (Binance e OKX)
  const exchanges = ['binance', 'okx', 'default']
  const symbols = ['USDT', 'BTC', 'ETH', 'BNB', 'ADA', 'XRP']

  for (const symbol of symbols) {
    for (const exchange of exchanges) {
      const balance = balancesByExchange[exchange]?.[symbol]
      const availableBalance = balance ? (balance.balance - balance.locked_balance) : 0

      // Determinar thresholds baseados no símbolo
      const threshold = symbol === 'USDT' ? config.min_usdt_threshold : config.min_crypto_threshold
      const targetBuffer = symbol === 'USDT' ? config.target_usdt_buffer : config.target_crypto_buffer

      if (availableBalance < threshold) {
        console.log(`⚠️ Saldo baixo detectado: ${exchange} ${symbol} = ${availableBalance} (< ${threshold})`)
        
        // Encontrar exchange com saldo suficiente para transferir
        const sourceExchange = findSourceExchange(
          balancesByExchange, 
          symbol, 
          targetBuffer,
          exchange
        )

        if (sourceExchange) {
          recommendations.push({
            from_exchange: sourceExchange,
            to_exchange: exchange,
            symbol: symbol,
            amount: targetBuffer,
            reason: `Saldo baixo: ${availableBalance} < ${threshold}`,
            priority: availableBalance < (threshold * 0.5) ? 'high' : 'medium',
            trigger_type: 'auto_threshold'
          })
          needs_rebalance = true
        }
      }
    }
  }

  // Análise preditiva baseada em histórico
  const predictiveRecommendations = await analyzePredictiveNeeds(
    config.user_id,
    balancesByExchange,
    supabaseClient
  )

  recommendations.push(...predictiveRecommendations)
  if (predictiveRecommendations.length > 0) {
    needs_rebalance = true
  }

  return {
    needs_rebalance,
    recommendations
  }
}

function findSourceExchange(balancesByExchange: any, symbol: string, requiredAmount: number, excludeExchange: string) {
  const exchanges = Object.keys(balancesByExchange).filter(ex => ex !== excludeExchange)
  
  for (const exchange of exchanges) {
    const balance = balancesByExchange[exchange]?.[symbol]
    if (balance) {
      const available = balance.balance - balance.locked_balance
      if (available >= requiredAmount * 1.5) { // Manter margem de segurança
        return exchange
      }
    }
  }
  return null
}

async function analyzePredictiveNeeds(userId: string, balancesByExchange: any, supabaseClient: any) {
  const recommendations: any[] = []

  // Analisar padrões de arbitragem dos últimos 7 dias
  const { data: recentTrades } = await supabaseClient
    .from('arbitrage_trades')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })

  if (!recentTrades || recentTrades.length === 0) {
    return recommendations
  }

  // Analisar frequência por exchange e símbolo
  const usage = analyzeUsagePatterns(recentTrades)
  
  for (const pattern of usage) {
    // Se uma exchange está sendo muito usada, preparar saldo antecipadamente
    if (pattern.frequency > 0.3 && pattern.avg_amount > 0) {
      const currentBalance = balancesByExchange[pattern.exchange]?.[pattern.symbol]
      const available = currentBalance ? (currentBalance.balance - currentBalance.locked_balance) : 0
      
      const predictedNeed = pattern.avg_amount * 2 // Buffer para múltiplas operações
      
      if (available < predictedNeed) {
        recommendations.push({
          from_exchange: findSourceExchange(balancesByExchange, pattern.symbol, predictedNeed, pattern.exchange),
          to_exchange: pattern.exchange,
          symbol: pattern.symbol,
          amount: predictedNeed - available,
          reason: `Previsão baseada em padrões: ${pattern.frequency * 100}% de uso`,
          priority: 'medium',
          trigger_type: 'auto_predictive'
        })
      }
    }
  }

  return recommendations.filter(r => r.from_exchange) // Só incluir se encontrou fonte
}

function analyzeUsagePatterns(trades: any[]) {
  const patterns: { [key: string]: { count: number, total_amount: number, exchanges: string[] } } = {}
  
  for (const trade of trades) {
    const symbol = trade.symbol.replace('USDT', '')
    const key = `${symbol}`
    
    if (!patterns[key]) {
      patterns[key] = { count: 0, total_amount: 0, exchanges: [] }
    }
    
    patterns[key].count++
    patterns[key].total_amount += trade.investment_amount || 0
    
    if (!patterns[key].exchanges.includes(trade.buy_exchange)) {
      patterns[key].exchanges.push(trade.buy_exchange)
    }
    if (!patterns[key].exchanges.includes(trade.sell_exchange)) {
      patterns[key].exchanges.push(trade.sell_exchange)
    }
  }

  return Object.entries(patterns).map(([symbol, data]) => ({
    symbol,
    frequency: data.count / trades.length,
    avg_amount: data.total_amount / data.count,
    exchange: data.exchanges[0] // Simplificado - pegar primeira exchange
  }))
}

async function createRebalanceRecommendation(userId: string, recommendation: any, supabaseClient: any) {
  if (!recommendation.from_exchange || !recommendation.to_exchange) {
    console.log('⚠️ Recomendação ignorada: exchange origem ou destino não encontrada')
    return
  }

  const { error } = await supabaseClient
    .from('wallet_rebalance_operations')
    .insert({
      user_id: userId,
      from_exchange: recommendation.from_exchange,
      to_exchange: recommendation.to_exchange,
      symbol: recommendation.symbol,
      amount: recommendation.amount,
      status: 'pending',
      reason: recommendation.reason,
      mode: 'alert', // Modo alerta - não executar transferência real
      priority: recommendation.priority,
      trigger_type: recommendation.trigger_type
    })

  if (error) {
    console.error('❌ Erro ao criar recomendação de transferência:', error)
  } else {
    console.log(`✅ Recomendação criada: ${recommendation.from_exchange} → ${recommendation.to_exchange} ${recommendation.amount} ${recommendation.symbol}`)
  }
}