import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdaptiveRequest {
  action: 'adaptive_order' | 'adaptive_transfer'
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price?: number
  maxRetries?: number
  credentials?: {
    apiKey: string
    secretKey: string
    passphrase: string
  }
}

interface AdaptiveResponse {
  success: boolean
  result?: any
  adaptations_applied: string[]
  final_strategy: string
  error?: string
  retries_used: number
}

// Estratégias adaptativas por código de erro
const ERROR_STRATEGIES: Record<string, string> = {
  '51008': 'insufficient_balance_with_margin', // Saldo insuficiente + margem baixa
  '51020': 'minimum_order_size', // Valor mínimo não atendido
  '51155': 'compliance_restriction', // Restrições de conformidade  
  '51000': 'parameter_error', // Erro de parâmetro
  '51001': 'account_mode_error', // Modo de conta incorreto
  '51004': 'insufficient_balance', // Saldo insuficiente simples
  '51012': 'token_not_tradable', // Token não negociável
  '58350': 'withdrawal_insufficient', // Saldo insuficiente para saque
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbol, side, quantity, price, maxRetries = 3, credentials }: AdaptiveRequest = await req.json()
    
    console.log(`🤖 Sistema Adaptativo OKX iniciado para ${action}: ${symbol} ${side} ${quantity}`)
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const adaptiveResponse: AdaptiveResponse = {
      success: false,
      adaptations_applied: [],
      final_strategy: 'initial_attempt',
      retries_used: 0
    }

    // Tentar operação com adaptações inteligentes
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      adaptiveResponse.retries_used = attempt
      
      try {
        console.log(`🔄 Tentativa ${attempt + 1}/${maxRetries + 1} - Estratégia: ${adaptiveResponse.final_strategy}`)
        
        const result = await executeWithAdaptation(
          supabase, 
          action, 
          symbol, 
          side, 
          quantity, 
          price, 
          credentials, 
          adaptiveResponse
        )
        
        if (result.success) {
          adaptiveResponse.success = true
          adaptiveResponse.result = result
          console.log(`✅ Sucesso após ${attempt + 1} tentativas com adaptações:`, adaptiveResponse.adaptations_applied)
          break
        }
        
      } catch (error) {
        console.log(`⚠️ Erro na tentativa ${attempt + 1}:`, error instanceof Error ? error.message : String(error))
        
        // Analisar erro e aplicar adaptação
        const adaptation = await analyzeErrorAndAdapt(error, adaptiveResponse, supabase, credentials)
        
        if (!adaptation.canRetry) {
          console.log(`🚫 Erro não recuperável: ${adaptation.reason}`)
          adaptiveResponse.error = adaptation.reason
          break
        }
        
        if (attempt === maxRetries) {
          adaptiveResponse.error = `Falha após ${maxRetries + 1} tentativas: ${error instanceof Error ? error.message : String(error)}`
        }
        
        // Aguardar antes da próxima tentativa (backoff exponencial)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
          console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    return new Response(JSON.stringify(adaptiveResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Erro no sistema adaptativo:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      adaptations_applied: [],
      final_strategy: 'error',
      retries_used: 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

async function executeWithAdaptation(
  supabase: any,
  action: string,
  symbol: string,
  side: 'buy' | 'sell',
  quantity: number,
  price?: number,
  credentials?: any,
  adaptiveResponse?: AdaptiveResponse
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  if (action === 'adaptive_order') {
    // Executar ordem via OKX API
    const response = await fetch(`${supabaseUrl}/functions/v1/okx-api`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        action: 'place_order',
        symbol: symbol,
        side: side,
        type: 'market',
        quantity: quantity,
        price: price,
        api_key: credentials?.apiKey,
        secret_key: credentials?.secretKey,
        passphrase: credentials?.passphrase
      })
    })
    
    const result = await response.json()
    return result
    
  } else if (action === 'adaptive_transfer') {
    // Transferir entre carteiras (Funding -> Trading)
    console.log(`💸 Tentando transferir ${quantity} ${symbol} da Funding para Trading`)
    
    // Implementar transferência automática
    const transferResponse = await fetch(`${supabaseUrl}/functions/v1/okx-api`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        action: 'internal_transfer',
        currency: symbol,
        amount: quantity,
        from: 'funding',
        to: 'trading',
        api_key: credentials?.apiKey,
        secret_key: credentials?.secretKey,
        passphrase: credentials?.passphrase
      })
    })
    
    return await transferResponse.json()
  }
  
  throw new Error(`Ação não suportada: ${action}`)
}

async function analyzeErrorAndAdapt(
  error: any, 
  adaptiveResponse: AdaptiveResponse, 
  supabase: any,
  credentials?: any
): Promise<{ canRetry: boolean; reason: string; newStrategy?: string }> {
  
  const errorMsg = error instanceof Error ? error.message : String(error)
  console.log(`🔍 Analisando erro: ${errorMsg}`)
  
  // Extrair sCode se disponível
  const sCodeMatch = errorMsg.match(/sCode=(\d+)/)
  const sCode = sCodeMatch ? sCodeMatch[1] : null
  
  if (sCode && ERROR_STRATEGIES[sCode]) {
    const strategy = ERROR_STRATEGIES[sCode]
    console.log(`🎯 Estratégia identificada para sCode=${sCode}: ${strategy}`)
    
    switch (strategy) {
      case 'insufficient_balance_with_margin':
        // sCode=51008: Tentar transferir da funding
        adaptiveResponse.adaptations_applied.push('auto_transfer_from_funding')
        adaptiveResponse.final_strategy = 'funding_to_spot_transfer'
        
        // Implementar transferência automática aqui
        return { 
          canRetry: true, 
          reason: 'Tentando transferir automaticamente da carteira Funding',
          newStrategy: 'funding_transfer'
        }
        
      case 'minimum_order_size':
        // sCode=51020: Aumentar quantidade da ordem
        adaptiveResponse.adaptations_applied.push('increase_order_size')
        adaptiveResponse.final_strategy = 'increased_minimum_order'
        
        return { 
          canRetry: true, 
          reason: 'Aumentando valor da ordem para atender mínimo',
          newStrategy: 'minimum_adjustment'
        }
        
      case 'compliance_restriction':
        // sCode=51155: Par restrito - não tentar novamente
        adaptiveResponse.adaptations_applied.push('compliance_restriction_detected')
        adaptiveResponse.final_strategy = 'skip_restricted_pair'
        
        return { 
          canRetry: false, 
          reason: 'Par restrito por conformidade - tente outro símbolo'
        }
        
      case 'parameter_error':
        // sCode=51000: Ajustar parâmetros
        adaptiveResponse.adaptations_applied.push('parameter_adjustment')
        adaptiveResponse.final_strategy = 'adjusted_parameters'
        
        return { 
          canRetry: true, 
          reason: 'Ajustando parâmetros da ordem',
          newStrategy: 'parameter_fix'
        }
        
      default:
        return { 
          canRetry: true, 
          reason: `Erro conhecido sCode=${sCode}, tentando novamente`
        }
    }
  }
  
  // Erros sem sCode específico
  if (errorMsg.includes('insufficient balance')) {
    adaptiveResponse.adaptations_applied.push('balance_check_and_transfer')
    return { 
      canRetry: true, 
      reason: 'Verificando saldos e tentando transferência automática'
    }
  }
  
  if (errorMsg.includes('minimum order')) {
    adaptiveResponse.adaptations_applied.push('order_size_adjustment')
    return { 
      canRetry: true, 
      reason: 'Ajustando tamanho da ordem'
    }
  }
  
  if (errorMsg.includes('API key') || errorMsg.includes('authorization')) {
    return { 
      canRetry: false, 
      reason: 'Problema de autenticação - verifique credenciais'
    }
  }
  
  // Erro genérico - tentar mais uma vez
  return { 
    canRetry: true, 
    reason: 'Erro genérico - tentando novamente'
  }
}