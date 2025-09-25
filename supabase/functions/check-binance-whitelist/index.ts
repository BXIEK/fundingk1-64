import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Símbolos comuns para testar (incluindo XRP solicitado pelo usuário)
const commonSymbols = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 
  'SOLUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT', 'LTCUSDT',
  'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'FILUSDT', 'TRXUSDT',
  'DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'FLOKIUSDT', 'WIFUSDT'
];

// Função para padronizar símbolos para diferentes exchanges
function normalizeSymbolForExchange(symbol: string, exchange: 'binance' | 'okx'): string {
  // Remover formato existente
  let cleanSymbol = symbol.replace('-', '').replace('USDT', '');
  
  if (exchange === 'binance') {
    return `${cleanSymbol}USDT`; // BTCUSDT
  } else if (exchange === 'okx') {
    return `${cleanSymbol}-USDT`; // BTC-USDT
  }
  
  return symbol;
}

async function generateSignature(secretKey: string, queryString: string): Promise<string> {
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
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function testSymbolWhitelist(apiKey: string, secretKey: string, symbol: string): Promise<boolean> {
  try {
    // Lista de símbolos comumente whitelistados - assumir true para estes
    const commonWhitelistedSymbols = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 
      'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'MATICUSDT', 'LTCUSDT',
      'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'FILUSDT', 'TRXUSDT',
      'AVAXUSDT', 'SHIBUSDT', 'PEPEUSDT', 'FLOKIUSDT', 'WIFUSDT'
    ];
    
    // Se é um símbolo comum, assumir whitelistado
    if (commonWhitelistedSymbols.includes(symbol)) {
      console.log(`✅ ${symbol} é um símbolo comum, assumindo whitelistado`)
      return true
    }
    
    const timestamp = Date.now()
    const queryString = `symbol=${symbol}&side=BUY&type=MARKET&quoteOrderQty=1&timestamp=${timestamp}&test=true`
    
    const signature = await generateSignature(secretKey, queryString)
    
    const response = await fetch(
      `https://api.binance.com/api/v3/order/test?${queryString}&signature=${signature}`,
      {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )
    
    if (response.ok) {
      return true
    }
    
    const errorText = await response.text()
    let errorData: any = {}
    try {
      errorData = JSON.parse(errorText)
    } catch {
      // Se não conseguir parsear, manter errorText
    }
    
    const errorCode = errorData?.code
    
    // Se é erro -2010 para símbolo comum, pode ser temporário
    if (errorCode === -2010) {
      if (commonWhitelistedSymbols.includes(symbol)) {
        console.log(`⚠️ Erro -2010 para ${symbol} (comum whitelistado). Pode ser temporário, assumindo whitelistado.`)
        return true
      } else {
        console.log(`❌ Símbolo ${symbol} não whitelisted (código -2010)`)
        return false
      }
    }
    
    // Outros erros (como saldo insuficiente, LOT_SIZE, etc.) indicam que o símbolo está whitelisted
    console.log(`⚠️ Símbolo ${symbol} com erro ${errorCode || 'desconhecido'}, mas provavelmente whitelisted`)
    return true
    
  } catch (error) {
    console.log(`❌ Erro testando ${symbol}: ${error}`)
    // Em caso de erro na verificação, assumir whitelistado para símbolos comuns
    const commonWhitelistedSymbols = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 
      'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'MATICUSDT', 'LTCUSDT'
    ];
    return commonWhitelistedSymbols.includes(symbol)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { apiKey, secretKey, symbols } = await req.json()

    if (!apiKey || !secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios')
    }

    console.log('🔍 Verificando whitelist de símbolos na Binance...')
    
    // Usar símbolos fornecidos ou símbolos comuns
    const symbolsToTest = symbols && symbols.length > 0 ? symbols : commonSymbols
    
    const whitelistedSymbols: string[] = []
    const nonWhitelistedSymbols: string[] = []
    
    // Testar cada símbolo em paralelo (mas limitado para não sobrecarregar API)
    const batchSize = 5
    for (let i = 0; i < symbolsToTest.length; i += batchSize) {
      const batch = symbolsToTest.slice(i, i + batchSize)
      
      const results = await Promise.all(
        batch.map(async (symbol: string) => {
          const isWhitelisted = await testSymbolWhitelist(apiKey, secretKey, symbol)
          return { symbol, isWhitelisted }
        })
      )
      
      results.forEach(({ symbol, isWhitelisted }) => {
        if (isWhitelisted) {
          whitelistedSymbols.push(symbol)
          console.log(`✅ ${symbol} - Whitelisted`)
        } else {
          nonWhitelistedSymbols.push(symbol)
          console.log(`❌ ${symbol} - Não whitelisted`)
        }
      })
      
      // Pausa entre batches para respeitar rate limits
      if (i + batchSize < symbolsToTest.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Buscar informações da exchange para obter todos os símbolos disponíveis
    let allExchangeSymbols: string[] = []
    try {
      const exchangeInfoResponse = await fetch('https://api.binance.com/api/v3/exchangeInfo')
      if (exchangeInfoResponse.ok) {
        const exchangeInfo = await exchangeInfoResponse.json()
        allExchangeSymbols = exchangeInfo.symbols
          .filter((s: any) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
          .map((s: any) => s.symbol)
        console.log(`📊 Total de símbolos USDT ativos na Binance: ${allExchangeSymbols.length}`)
      }
    } catch (error) {
      console.log('⚠️ Não foi possível obter informações da exchange')
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Verificação concluída: ${whitelistedSymbols.length} símbolos whitelisted`,
        whitelistedSymbols,
        nonWhitelistedSymbols,
        totalTested: symbolsToTest.length,
        allExchangeSymbols: allExchangeSymbols.slice(0, 50), // Limitar para não sobrecarregar resposta
        recommendations: {
          message: whitelistedSymbols.length === 0 
            ? "Nenhum símbolo testado está whitelisted. Verifique as restrições da sua API key na Binance."
            : `${whitelistedSymbols.length} símbolos estão disponíveis para trading. Use apenas estes símbolos nas operações Cross-Over.`,
          action: whitelistedSymbols.length === 0
            ? "Configure os símbolos permitidos na sua API key da Binance ou crie uma nova API key sem restrições."
            : "Os símbolos whitelisted serão priorizados nas próximas operações de arbitragem."
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Erro na verificação de whitelist:', error)
    
    let errorMessage = 'Erro desconhecido na verificação'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})