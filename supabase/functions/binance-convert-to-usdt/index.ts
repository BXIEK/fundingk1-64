import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConversionResult {
  symbol: string;
  amount: string;
  success: boolean;
  usdtReceived?: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Edge Function binance-convert-to-usdt iniciada');
    
    const { apiKey, secretKey, minUsdValue = 10 } = await req.json()

    if (!apiKey || !secretKey) {
      console.log('❌ Credenciais ausentes');
      return new Response(
        JSON.stringify({ success: false, error: 'API Key e Secret Key obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('🔄 Iniciando conversão de tokens para USDT...');

    // 1. Buscar saldos da conta
    const accountTimestamp = Date.now()
    const accountQuery = `timestamp=${accountTimestamp}`
    const accountSignature = await createSignature(accountQuery, secretKey)
    
    const accountResponse = await fetch(
      `https://api.binance.com/api/v3/account?${accountQuery}&signature=${accountSignature}`,
      { headers: { 'X-MBX-APIKEY': apiKey } }
    )

    if (!accountResponse.ok) {
      throw new Error('Falha ao buscar saldos da conta')
    }

    const accountData = await accountResponse.json()
    
    // Filtrar tokens com saldo > 0 (exceto USDT, BNB para taxas)
    const tokensToConvert = accountData.balances
      .filter((b: any) => {
        const balance = parseFloat(b.free)
        return balance > 0 && b.asset !== 'USDT' && b.asset !== 'BNB'
      })
      .map((b: any) => ({ asset: b.asset, balance: parseFloat(b.free) }))

    console.log(`📊 Encontrados ${tokensToConvert.length} tokens para converter:`, 
      tokensToConvert.map((t: any) => t.asset).join(', '))

    if (tokensToConvert.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum token para converter',
          conversions: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Buscar preços atuais
    const pricesResponse = await fetch('https://api.binance.com/api/v3/ticker/price')
    const prices = await pricesResponse.json()
    const priceMap = new Map(prices.map((p: any) => [p.symbol, parseFloat(p.price)]))

    // 3. Converter cada token
    const conversions: ConversionResult[] = []

    for (const token of tokensToConvert) {
      try {
        const symbol = `${token.asset}USDT`
        const price = priceMap.get(symbol)
        
        if (!price) {
          console.warn(`⚠️ Par ${symbol} não encontrado, tentando via BTC...`)
          conversions.push({
            symbol: token.asset,
            amount: token.balance.toString(),
            success: false,
            error: 'Par de trading não disponível'
          })
          continue
        }

        const estimatedUsdValue = token.balance * Number(price)
        
        // Verificar valor mínimo (evitar taxas altas em valores baixos)
        if (estimatedUsdValue < minUsdValue) {
          console.log(`⏭️ Pulando ${token.asset}: valor muito baixo ($${estimatedUsdValue.toFixed(2)})`)
          conversions.push({
            symbol: token.asset,
            amount: token.balance.toString(),
            success: false,
            error: `Valor muito baixo ($${estimatedUsdValue.toFixed(2)} < $${minUsdValue})`
          })
          continue
        }

        // Buscar info do símbolo para ajustar quantidade
        const exchangeInfoResp = await fetch(`https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}`)
        const exchangeInfo = await exchangeInfoResp.json()
        
        if (!exchangeInfo.symbols || exchangeInfo.symbols.length === 0) {
          console.warn(`⚠️ Info do símbolo ${symbol} não encontrada`)
          conversions.push({
            symbol: token.asset,
            amount: token.balance.toString(),
            success: false,
            error: 'Informações do par de trading não disponíveis'
          })
          continue
        }
        
        const symbolInfo = exchangeInfo.symbols[0]
        const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE')
        
        if (!lotSizeFilter) {
          console.warn(`⚠️ LOT_SIZE não encontrado para ${symbol}`)
          conversions.push({
            symbol: token.asset,
            amount: token.balance.toString(),
            success: false,
            error: 'Configuração de trading não disponível'
          })
          continue
        }
        
        const stepSize = parseFloat(lotSizeFilter.stepSize)
        
        // Arredondar quantidade para o stepSize
        const quantity = Math.floor(token.balance / stepSize) * stepSize
        
        if (quantity <= 0) {
          conversions.push({
            symbol: token.asset,
            amount: token.balance.toString(),
            success: false,
            error: 'Quantidade menor que o mínimo permitido'
          })
          continue
        }

        console.log(`💱 Convertendo ${quantity} ${token.asset} → USDT`)

        // Executar ordem de venda (MARKET)
        const orderTimestamp = Date.now()
        const orderParams = `symbol=${symbol}&side=SELL&type=MARKET&quantity=${quantity}&timestamp=${orderTimestamp}`
        const orderSignature = await createSignature(orderParams, secretKey)

        const orderResponse = await fetch(
          `https://api.binance.com/api/v3/order?${orderParams}&signature=${orderSignature}`,
          {
            method: 'POST',
            headers: { 'X-MBX-APIKEY': apiKey }
          }
        )

        if (!orderResponse.ok) {
          const errorData = await orderResponse.json()
          throw new Error(errorData.msg || 'Falha na ordem')
        }

        const orderData = await orderResponse.json()
        const usdtReceived = parseFloat(orderData.cummulativeQuoteQty || '0')

        console.log(`✅ ${token.asset} convertido: ${usdtReceived.toFixed(2)} USDT recebidos`)

        conversions.push({
          symbol: token.asset,
          amount: quantity.toString(),
          success: true,
          usdtReceived
        })

        // Delay entre ordens para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error: any) {
        console.error(`❌ Erro ao converter ${token.asset}:`, error.message)
        conversions.push({
          symbol: token.asset,
          amount: token.balance.toString(),
          success: false,
          error: error.message
        })
      }
    }

    const successCount = conversions.filter(c => c.success).length
    const totalUsdtReceived = conversions
      .filter(c => c.success)
      .reduce((sum, c) => sum + (c.usdtReceived || 0), 0)

    console.log(`✅ Conversão concluída: ${successCount}/${conversions.length} tokens`)
    console.log(`💰 Total recebido: ${totalUsdtReceived.toFixed(2)} USDT`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `${successCount} tokens convertidos com sucesso`,
        totalUsdtReceived,
        conversions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Erro na conversão:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function createSignature(queryString: string, secretKey: string): Promise<string> {
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
