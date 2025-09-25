import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('🔄 Processando alertas e recomendações de transferência...')

    // Buscar apenas recomendações em modo 'alert' (não executar transferências reais)
    const { data: operations, error: operationsError } = await supabaseClient
      .from('wallet_rebalance_operations')
      .select('*')
      .eq('status', 'pending')
      .eq('mode', 'alert') // Apenas alertas, não transferências reais
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10)

    if (operationsError) {
      console.error('❌ Erro ao buscar operações:', operationsError)
      throw operationsError
    }

    if (!operations || operations.length === 0) {
      console.log('ℹ️ Nenhuma operação de rebalanceamento pendente encontrada')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma operação pendente',
          processed: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log(`📋 Encontradas ${operations.length} operações para executar`)

    const results = []
    let processed = 0
    let successful = 0

    for (const operation of operations) {
      console.log(`🔄 Processando alerta ${operation.id}: ${operation.from_exchange} → ${operation.to_exchange} ${operation.amount} ${operation.symbol}`)
      
      try {
        // Marcar como processado (apenas informativo)
        await supabaseClient
          .from('wallet_rebalance_operations')
          .update({ 
            status: 'completed',
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', operation.id)

        console.log(`✅ Alerta processado: ${operation.id} - Transferência deve ser feita manualmente`)
        
        results.push({
          operation_id: operation.id,
          success: true,
          message: 'Alerta processado - Transferência manual necessária'
        })

        successful++
        processed++

        // Aguardar um pouco entre operações
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (operationError) {
        console.error(`❌ Erro ao processar alerta ${operation.id}:`, operationError)
        
        const errorMessage = operationError instanceof Error ? operationError.message : 'Erro desconhecido'
        
        await supabaseClient
          .from('wallet_rebalance_operations')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error_message: `Erro ao processar alerta: ${errorMessage}`
          })
          .eq('id', operation.id)

        results.push({
          operation_id: operation.id,
          success: false,
          error: errorMessage
        })

        processed++
      }
    }

    console.log(`✅ Processamento de alertas concluído: ${processed} alertas processados, ${successful} bem-sucedidos`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: processed,
        successful: successful,
        failed: processed - successful,
        results: results,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Erro no sistema de rebalanceamento:', error)
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

async function executeRebalanceOperation(operation: any, supabaseClient: any) {
  try {
    // Buscar saldos atuais
    const { data: portfolios, error: portfolioError } = await supabaseClient
      .from('portfolios')
      .select('*')
      .eq('user_id', operation.user_id)
      .eq('symbol', operation.symbol)

    if (portfolioError) {
      return { success: false, error: `Erro ao buscar portfolios: ${portfolioError.message}` }
    }

    const fromPortfolio = portfolios?.find((p: any) => (p.exchange || 'default') === operation.from_exchange)
    const toPortfolio = portfolios?.find((p: any) => (p.exchange || 'default') === operation.to_exchange)

    // Verificar se há saldo suficiente na exchange origem
    const fromBalance = fromPortfolio?.balance || 0
    const fromLocked = fromPortfolio?.locked_balance || 0
    const fromAvailable = fromBalance - fromLocked

    if (fromAvailable < operation.amount) {
      return { 
        success: false, 
        error: `Saldo insuficiente na ${operation.from_exchange}: disponível ${fromAvailable}, necessário ${operation.amount}` 
      }
    }

    console.log(`💰 Saldos antes: ${operation.from_exchange}=${fromBalance}, ${operation.to_exchange}=${toPortfolio?.balance || 0}`)

    // Simular taxa de transferência (0.1% para transferências internas)
    const transferFee = operation.amount * 0.001
    const netAmount = operation.amount - transferFee

    // Se estiver em modo teste, apenas simular
    if (operation.mode === 'test') {
      return {
        success: true,
        simulated: true,
        balance_before_from: fromBalance,
        balance_before_to: toPortfolio?.balance || 0,
        balance_after_from: fromBalance - operation.amount,
        balance_after_to: (toPortfolio?.balance || 0) + netAmount,
        fees: transferFee,
        message: 'Simulação de transferência - modo teste'
      }
    }

    // Executar transferência real
    // Debitar da exchange origem
    if (fromPortfolio) {
      await supabaseClient
        .from('portfolios')
        .update({ 
          balance: fromBalance - operation.amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', fromPortfolio.id)
    }

    // Creditar na exchange destino
    if (toPortfolio) {
      await supabaseClient
        .from('portfolios')
        .update({ 
          balance: toPortfolio.balance + netAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', toPortfolio.id)
    } else {
      // Criar novo registro se não existir
      await supabaseClient
        .from('portfolios')
        .insert({
          user_id: operation.user_id,
          symbol: operation.symbol,
          balance: netAmount,
          locked_balance: 0,
          exchange: operation.to_exchange,
          application_title: 'Rebalanceamento Automático'
        })
    }

    console.log(`✅ Transferência executada: ${operation.amount} ${operation.symbol} (líquido: ${netAmount})`)

    return {
      success: true,
      simulated: false,
      balance_before_from: fromBalance,
      balance_before_to: toPortfolio?.balance || 0,
      balance_after_from: fromBalance - operation.amount,
      balance_after_to: (toPortfolio?.balance || 0) + netAmount,
      fees: transferFee,
      message: 'Transferência executada com sucesso'
    }

  } catch (error) {
    console.error('❌ Erro na execução do rebalanceamento:', error)
    return {
      success: false,
      error: `Erro na execução: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

// Função para otimizar horários de transferência
function isOptimalTransferTime() {
  const now = new Date()
  const hour = now.getUTCHours()
  
  // Evitar horários de alta volatilidade (0-2 UTC, 12-14 UTC)
  const avoidHours = [0, 1, 2, 12, 13, 14]
  
  return !avoidHours.includes(hour)
}

// Função para calcular custo de transferência baseado na rede
function calculateTransferCost(symbol: string, amount: number) {
  const networkFees: { [key: string]: number } = {
    'BTC': 0.0005,   // ~$25
    'ETH': 0.005,    // ~$15
    'USDT': 1,       // 1 USDT
    'BNB': 0.0005,   // ~$0.3
    'ADA': 1,        // 1 ADA  
    'XRP': 0.1       // 0.1 XRP
  }
  
  const fixedFee = networkFees[symbol] || 0.001
  const percentageFee = amount * 0.001 // 0.1%
  
  return Math.max(fixedFee, percentageFee)
}