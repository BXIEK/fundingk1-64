import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { apiKey, secretKey } = await req.json()

    if (!apiKey || !secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios')
    }

    // Criar query string com timestamp
    const timestamp = Date.now()
    const queryString = `timestamp=${timestamp}`

    // Gerar assinatura HMAC-SHA256
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

    // Fazer requisição para API da Binance
    const response = await fetch(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`,
      {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.msg) {
          errorMessage = errorData.msg
        }
      } catch {
        // Se não conseguir parsear, usa a mensagem padrão
      }
      
      throw new Error(errorMessage)
    }

    const accountData = await response.json()

    // Calcular informações úteis da conta
    const totalBalances = accountData.balances?.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0) || []
    const usdtBalance = accountData.balances?.find((b: any) => b.asset === 'USDT')
    const btcBalance = accountData.balances?.find((b: any) => b.asset === 'BTC')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conexão com Binance estabelecida com sucesso!',
        accountInfo: {
          totalAssets: totalBalances.length,
          usdtBalance: {
            free: usdtBalance?.free || '0',
            locked: usdtBalance?.locked || '0'
          },
          btcBalance: {
            free: btcBalance?.free || '0',
            locked: btcBalance?.locked || '0'
          },
          canTrade: accountData.canTrade || false,
          canWithdraw: accountData.canWithdraw || false,
          canDeposit: accountData.canDeposit || false
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Erro no teste da Binance:', error)
    
    let errorMessage = 'Erro desconhecido na conexão'
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }

    // Mapear erros comuns da Binance
    if (errorMessage.includes('Invalid API-key')) {
      errorMessage = 'API Key inválida. Verifique se a chave está correta.'
    } else if (errorMessage.includes('Signature for this request')) {
      errorMessage = 'Secret Key incorreta. Verifique se a chave secreta está correta.'
    } else if (errorMessage.includes('IP')) {
      errorMessage = 'IP não autorizado. Configure o IP na sua API Key da Binance.'
    } else if (errorMessage.includes('permission')) {
      errorMessage = 'Permissões insuficientes. Ative "Enable Reading" na sua API Key.'
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