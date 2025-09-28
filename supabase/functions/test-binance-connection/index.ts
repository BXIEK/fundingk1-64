import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let apiKey = ''
  let secretKey = ''
  
  try {
    const requestData = await req.json()
    apiKey = requestData.apiKey
    secretKey = requestData.secretKey

    if (!apiKey || !secretKey || apiKey === 'null' || secretKey === 'null') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Credenciais da Binance não configuradas. Vá para "Configuração de APIs" e insira suas chaves da Binance.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log('🔗 TESTE CONEXÃO DIRETA BINANCE - SEM PROXIES/BYPASS');

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

    console.log('📡 Fazendo requisição DIRETA para api.binance.com...');
    
    const response = await fetch(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`,
      {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro direto da API Binance:', response.status, errorText);
      
      let errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`
      
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
    console.log('✅ Conexão DIRETA Binance bem-sucedida!');

    // Calcular informações úteis da conta
    const totalBalances = accountData.balances?.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0) || []
    const usdtBalance = accountData.balances?.find((b: any) => b.asset === 'USDT')
    const btcBalance = accountData.balances?.find((b: any) => b.asset === 'BTC')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conexão DIRETA com Binance estabelecida com sucesso!',
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

    // Mapear erros comuns da Binance para mensagens mais claras
    if (errorMessage.includes('Invalid API-key') || errorMessage.includes('API-key format invalid')) {
      errorMessage = '🔑 API Key inválida. Verifique se copiou corretamente sua chave da Binance.'
    } else if (errorMessage.includes('Signature for this request') || errorMessage.includes('Invalid signature')) {
      errorMessage = '🔐 Secret Key incorreta. Verifique se copiou corretamente sua chave secreta da Binance.'
    } else if (errorMessage.includes('IP') || errorMessage.includes('This API key does not have permission')) {
      errorMessage = '🌐 IP não autorizado ou permissões insuficientes. Esta API não tem whitelist, então deve ser um problema de permissões.'
    } else if (errorMessage.includes('Timestamp for this request')) {
      errorMessage = '⏰ Erro de timestamp. Verifique se o horário do seu sistema está correto.'
    } else if (errorMessage.includes('Permission denied')) {
      errorMessage = '🚫 Permissões insuficientes. Ative "Enable Reading" na configuração da sua API Key na Binance.'
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