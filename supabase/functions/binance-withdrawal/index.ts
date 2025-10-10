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
    const { apiKey, secretKey, coin, address, amount, network } = await req.json()

    if (!apiKey || !secretKey || !coin || !address || !amount) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Parâmetros obrigatórios: apiKey, secretKey, coin, address, amount'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('💸 Binance Withdrawal Request');
    console.log('Coin:', coin, 'Amount:', amount, 'Network:', network || 'default');

    // Criar query string
    const timestamp = Date.now()
    const params: Record<string, string> = {
      coin,
      address,
      amount: amount.toString(),
      timestamp: timestamp.toString(),
    }

    if (network) {
      params.network = network
    }

    const queryString = new URLSearchParams(params).toString()

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

    console.log('📡 Fazendo requisição de saque para api.binance.com...');
    
    const response = await fetch(
      `https://api.binance.com/sapi/v1/capital/withdraw/apply?${queryString}&signature=${signatureHex}`,
      {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro da Binance:', response.status, errorText);
      
      let errorMessage = `Erro HTTP ${response.status}`
      let errorCode = null
      
      try {
        const errorData = JSON.parse(errorText)
        errorCode = errorData.code
        errorMessage = errorData.msg || errorMessage
      } catch {}
      
      // Tratamento específico de erros comuns
      if (errorCode === -1002) {
        throw new Error(
          `❌ ERRO -1002: PERMISSÃO NEGADA\n\n` +
          `🔑 PROBLEMA: API Key sem permissão de saque (withdrawal)\n\n` +
          `📋 COMO CORRIGIR:\n` +
          `   1. Acesse: https://www.binance.com/en/my/settings/api-management\n` +
          `   2. Edite sua API Key\n` +
          `   3. Marque "Enable Withdrawals" ✅\n` +
          `   4. Configure whitelist de IPs (ou desative restrição)\n` +
          `   5. Salve as mudanças\n\n` +
          `⚠️ IMPORTANTE: Você também pode estar bloqueado por IP.\n` +
          `   Adicione os IPs do Supabase na whitelist ou desative a restrição.`
        )
      }
      
      if (errorCode === -1013) {
        throw new Error(
          `❌ ERRO -1013: VALOR MÍNIMO NÃO ATINGIDO (NOTIONAL)\n\n` +
          `💰 Seu valor está abaixo do mínimo exigido pela Binance\n` +
          `📊 Mínimo: $10 USDT para a maioria dos pares\n\n` +
          `💡 SOLUÇÕES:\n` +
          `   • Aumente o valor da operação\n` +
          `   • Use um par com valor maior acumulado\n` +
          `   • Deposite mais USDT na Binance`
        )
      }
      
      throw new Error(`Erro Binance (${errorCode || response.status}): ${errorMessage}`)
    }

    const data = await response.json()
    console.log('✅ Saque realizado com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Erro no saque da Binance:', error)
    
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
