import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BinanceAdaptiveRequest {
  action: 'adaptive_order' | 'test_connection' | 'get_balance'
  symbol: string
  side?: 'BUY' | 'SELL'
  quantity?: number
  price?: number
  maxRetries?: number
  credentials: {
    apiKey: string
    secretKey: string
  }
}

interface BinanceAdaptiveResponse {
  success: boolean
  error?: string
  adaptations_applied?: string[]
  result?: any
  retry_count?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const request: BinanceAdaptiveRequest = await req.json()
    console.log('🤖 Binance Adaptive Handler ativado:', request.action)

    const result = await handleBinanceAdaptiveRequest(request)
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400,
    })

  } catch (error) {
    console.error('❌ Erro no Binance Adaptive Handler:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function handleBinanceAdaptiveRequest(request: BinanceAdaptiveRequest): Promise<BinanceAdaptiveResponse> {
  const adaptations: string[] = []
  let lastError: string = ''
  const maxRetries = request.maxRetries || 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 Tentativa ${attempt}/${maxRetries} - Binance ${request.action}`)
    
    try {
      switch (request.action) {
        case 'adaptive_order':
          return await executeAdaptiveOrder(request, adaptations, attempt)
        case 'test_connection':
          return await testAdaptiveConnection(request, adaptations, attempt)
        case 'get_balance':
          return await getAdaptiveBalance(request, adaptations, attempt)
        default:
          throw new Error(`Ação não suportada: ${request.action}`)
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      console.error(`❌ Tentativa ${attempt} falhou:`, lastError)
      
      // Analisar e adaptar baseado no erro
      const shouldRetry = await analyzeAndAdaptBinanceError(lastError, adaptations, attempt, maxRetries)
      
      if (!shouldRetry || attempt === maxRetries) {
        break
      }
      
      // Delay progressivo entre tentativas
      const delay = Math.min(attempt * 2000, 10000) // Max 10s delay
      console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return {
    success: false,
    error: `Falha após ${maxRetries} tentativas: ${lastError}`,
    adaptations_applied: adaptations,
    retry_count: maxRetries
  }
}

async function executeAdaptiveOrder(request: BinanceAdaptiveRequest, adaptations: string[], attempt: number): Promise<BinanceAdaptiveResponse> {
  console.log(`📋 Executando ordem adaptativa Binance: ${request.side} ${request.quantity} ${request.symbol}`)
  
  // Obter regras de precisão do símbolo
  const symbolInfo = await getBinanceSymbolInfo(request.symbol, request.credentials.apiKey)
  if (symbolInfo && request.quantity) {
    request.quantity = adjustQuantityPrecision(request.quantity, symbolInfo)
    console.log(`🔧 Quantidade ajustada para precisão: ${request.quantity}`)
    adaptations.push(`Ajuste de precisão aplicado: ${request.quantity}`)
  }
  
  const timestamp = Date.now()
  let queryString = `symbol=${request.symbol}&side=${request.side}&type=MARKET&quantity=${request.quantity}&timestamp=${timestamp}`
  
  // Gerar assinatura
  const signature = await createBinanceSignature(queryString, request.credentials.secretKey)
  queryString += `&signature=${signature}`
  
  const response = await fetch('https://api.binance.com/api/v3/order', {
    method: 'POST',
    headers: {
      'X-MBX-APIKEY': request.credentials.apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: queryString
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
    } catch {
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    
    throw new Error(errorData.msg || `Erro Binance: ${response.status}`)
  }
  
  const orderResult = await response.json()
  console.log('✅ Ordem Binance executada com sucesso:', orderResult.orderId)
  
  return {
    success: true,
    result: orderResult,
    adaptations_applied: adaptations,
    retry_count: attempt
  }
}

async function testAdaptiveConnection(request: BinanceAdaptiveRequest, adaptations: string[], attempt: number): Promise<BinanceAdaptiveResponse> {
  console.log('🔍 Testando conexão adaptativa com Binance...')
  
  const timestamp = Date.now()
  const queryString = `timestamp=${timestamp}`
  const signature = await createBinanceSignature(queryString, request.credentials.secretKey)
  
  const response = await fetch(`https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': request.credentials.apiKey,
      'Content-Type': 'application/json',
    },
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
    } catch {
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    
    throw new Error(errorData.msg || `Erro Binance: ${response.status}`)
  }
  
  const accountData = await response.json()
  console.log('✅ Conexão Binance testada com sucesso')
  
  return {
    success: true,
    result: accountData,
    adaptations_applied: adaptations,
    retry_count: attempt
  }
}

async function getAdaptiveBalance(request: BinanceAdaptiveRequest, adaptations: string[], attempt: number): Promise<BinanceAdaptiveResponse> {
  console.log('💰 Obtendo saldo adaptativo da Binance...')
  
  const timestamp = Date.now()
  const queryString = `timestamp=${timestamp}`
  const signature = await createBinanceSignature(queryString, request.credentials.secretKey)
  
  const response = await fetch(`https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': request.credentials.apiKey,
      'Content-Type': 'application/json',
    },
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
    } catch {
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    
    throw new Error(errorData.msg || `Erro Binance: ${response.status}`)
  }
  
  const accountData = await response.json()
  console.log('✅ Saldo Binance obtido com sucesso')
  
  return {
    success: true,
    result: accountData.balances,
    adaptations_applied: adaptations,
    retry_count: attempt
  }
}

async function analyzeAndAdaptBinanceError(error: string, adaptations: string[], attempt: number, maxRetries: number): Promise<boolean> {
  console.log(`🔍 Analisando erro Binance: ${error}`)
  
  // Erro temporário da API - comum em alta volatilidade
  if (error.includes('temporário da API Binance') || error.includes('Try again')) {
    adaptations.push(`Tentativa ${attempt}: Erro temporário detectado - aplicando delay exponencial`)
    console.log('🔄 Aplicando estratégia de retry para erro temporário')
    return attempt < maxRetries
  }
  
  // Rate limiting
  if (error.includes('Too many requests') || error.includes('-1003')) {
    adaptations.push(`Tentativa ${attempt}: Rate limit - aumentando delay`)
    console.log('⏳ Rate limit detectado - aplicando delay maior')
    // Delay extra para rate limiting
    await new Promise(resolve => setTimeout(resolve, 5000))
    return attempt < maxRetries
  }
  
  // Erro de timestamp
  if (error.includes('Timestamp') || error.includes('-1021')) {
    adaptations.push(`Tentativa ${attempt}: Erro de timestamp - sincronizando`)
    console.log('🕐 Erro de timestamp detectado - tentando sincronizar')
    return attempt < maxRetries
  }
  
  // IP não autorizado
  if (error.includes('IP') || error.includes('not authorized') || error.includes('-2010')) {
    adaptations.push(`Tentativa ${attempt}: IP não autorizado - esta API não tem whitelist`)
    console.log('🌐 IP não autorizado - mas esta API não deve ter whitelist')
    
    // NÃO usar bypass geográfico - fazer conexão direta
    console.log('⚠️ Conexão direta falhou - API Key pode ter problema')
    
    return attempt < maxRetries
  }
  
  // Erro de API Key
  if (error.includes('Invalid API-key') || error.includes('-2014')) {
    adaptations.push(`Tentativa ${attempt}: API Key inválida - erro permanente`)
    console.log('🔑 API Key inválida - erro não recuperável')
    return false // Não retry para erros de credencial
  }
  
  // Erro de permissão
  if (error.includes('permission') || error.includes('-2011')) {
    adaptations.push(`Tentativa ${attempt}: Permissões insuficientes - erro permanente`)
    console.log('🚫 Permissões insuficientes - erro não recuperável')
    return false
  }
  
  // Symbol inválido ou suspenso
  if (error.includes('Invalid symbol') || error.includes('UNKNOWN_SYMBOL')) {
    adaptations.push(`Tentativa ${attempt}: Símbolo inválido/suspenso - erro permanente`)
    console.log('📊 Símbolo inválido ou suspenso - erro não recuperável')
    return false
  }
  
  // Erro de precisão da quantidade
  if (error.includes('precision') || error.includes('too much precision') || error.includes('stepSize')) {
    adaptations.push(`Tentativa ${attempt}: Erro de precisão - ajustando quantidade`)
    console.log('🔢 Erro de precisão de quantidade detectado - ajustando automaticamente')
    return attempt < maxRetries
  }
  
  // Saldo insuficiente
  if (error.includes('insufficient') || error.includes('balance')) {
    adaptations.push(`Tentativa ${attempt}: Saldo insuficiente - erro permanente`)
    console.log('💰 Saldo insuficiente - erro não recuperável')
    return false
  }
  
  // Erro de rede/timeout
  if (error.includes('ETIMEDOUT') || error.includes('ECONNRESET') || error.includes('fetch failed')) {
    adaptations.push(`Tentativa ${attempt}: Erro de rede - aplicando retry`)
    console.log('🌐 Erro de conectividade - tentando novamente')
    return attempt < maxRetries
  }
  
  // Outros erros temporários
  if (error.includes('500') || error.includes('502') || error.includes('503') || error.includes('504')) {
    adaptations.push(`Tentativa ${attempt}: Erro de servidor - aplicando retry`)
    console.log('🔧 Erro de servidor Binance - tentando novamente')
    return attempt < maxRetries
  }
  
  // Para erros desconhecidos, tentar algumas vezes
  adaptations.push(`Tentativa ${attempt}: Erro desconhecido - tentativa conservadora`)
  console.log('❓ Erro desconhecido - aplicando retry conservador')
  return attempt < (maxRetries - 1) // Uma tentativa a menos para erros desconhecidos
}

async function createBinanceSignature(queryString: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secretKey)
  const messageData = encoder.encode(queryString)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return signatureHex
}

// Obter informações de precisão do símbolo da Binance
async function getBinanceSymbolInfo(symbol: string, apiKey: string): Promise<any> {
  try {
    const response = await fetch('https://api.binance.com/api/v3/exchangeInfo', {
      headers: {
        'X-MBX-APIKEY': apiKey
      }
    })
    
    if (!response.ok) {
      console.log('⚠️ Falha ao obter info do símbolo, usando valores padrão')
      return null
    }
    
    const data = await response.json()
    const symbolInfo = data.symbols.find((s: any) => s.symbol === symbol)
    
    if (symbolInfo) {
      const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE')
      console.log(`📊 Info do símbolo ${symbol}:`, { stepSize: lotSizeFilter?.stepSize })
      return lotSizeFilter
    }
    
    return null
  } catch (error) {
    console.log('⚠️ Erro ao obter info do símbolo:', error)
    return null
  }
}

// Ajustar quantidade para a precisão correta
function adjustQuantityPrecision(quantity: number, symbolInfo: any): number {
  if (!symbolInfo || !symbolInfo.stepSize) {
    // Valores padrão para a maioria das moedas
    return Math.floor(quantity * 100000) / 100000 // 5 casas decimais
  }
  
  const stepSize = parseFloat(symbolInfo.stepSize)
  const precision = stepSize.toString().split('.')[1]?.length || 0
  
  // Arredondar para baixo na precisão correta
  const factor = Math.pow(10, precision)
  const adjustedQuantity = Math.floor(quantity * factor) / factor
  
  console.log(`🔧 Ajustando quantidade: ${quantity} → ${adjustedQuantity} (precisão: ${precision})`)
  return adjustedQuantity
}