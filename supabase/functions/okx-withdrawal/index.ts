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
    const { apiKey, secretKey, passphrase, ccy, amt, dest, toAddr, fee, chain } = await req.json()

    if (!apiKey || !secretKey || !passphrase || !ccy || !amt || !dest || !toAddr || !fee) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Parâmetros obrigatórios: apiKey, secretKey, passphrase, ccy, amt, dest, toAddr, fee'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('💸 OKX Withdrawal Request');
    console.log('Currency:', ccy, 'Amount:', amt, 'Destination:', dest);

    const endpoint = '/api/v5/asset/withdrawal'
    const method = 'POST'
    const timestamp = new Date().toISOString()
    
    const body: any = { ccy, amt, dest, toAddr, fee }
    if (chain) body.chain = chain
    
    const bodyStr = JSON.stringify(body)
    const preHash = timestamp + method + endpoint + bodyStr

    // Gerar assinatura HMAC SHA256 para OKX
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secretKey)
    const messageData = encoder.encode(preHash)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))

    console.log('📡 Fazendo requisição de saque para www.okx.com...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

    try {
      const response = await fetch(`https://www.okx.com${endpoint}`, {
        method,
        headers: {
          'OK-ACCESS-KEY': apiKey,
          'OK-ACCESS-SIGN': signatureBase64,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': passphrase,
          'Content-Type': 'application/json',
        },
        body: bodyStr,
        signal: controller.signal
      })

      clearTimeout(timeoutId);

      const data = await response.json()

      if (!response.ok || data.code !== '0') {
        console.error('❌ Erro da OKX:', data);
        
        // Tratamento específico de erros
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `❌ ERRO DE AUTENTICAÇÃO (${response.status})\n` +
            `${data.msg || 'Credenciais inválidas'}\n` +
            `Verifique API Key, Secret e Passphrase`
          )
        }
        
        if (response.status === 504) {
          throw new Error(
            `⏱️ TIMEOUT (504)\n` +
            `O servidor da OKX não respondeu a tempo.\n` +
            `Tente novamente em alguns segundos.`
          )
        }
        
        throw new Error(data.msg || `OKX Error Code: ${data.code}`)
      }

      console.log('✅ Saque OKX realizado com sucesso!');

      return new Response(
        JSON.stringify({
          success: true,
          data: data.data
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('❌ Timeout após 45 segundos');
        return new Response(
          JSON.stringify({
            success: false,
            error: '⏱️ Timeout: A OKX não respondeu em 45 segundos. Tente novamente.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 504 }
        )
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('Erro no saque da OKX:', error)
    
    let errorMessage = 'Erro desconhecido'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
