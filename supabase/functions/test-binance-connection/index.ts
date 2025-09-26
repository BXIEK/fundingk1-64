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

    // Fazer requisição para API da Binance com retry
    let response: Response | undefined;
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔄 Tentativa ${attempt}/3 de conexão com Binance...`);
        
        response = await fetch(
          `https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`,
          {
            method: 'GET',
            headers: {
              'X-MBX-APIKEY': apiKey,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (response.ok) {
          console.log(`✅ Conexão Binance bem-sucedida na tentativa ${attempt}`);
          break;
        } else {
          lastError = `HTTP ${response.status}: ${response.statusText}`;
          console.warn(`⚠️ Tentativa ${attempt} falhou: ${lastError}`);
          
          if (attempt < 3) {
            const delay = attempt * 2000; // 2s, 4s
            console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error(`❌ Tentativa ${attempt} com erro: ${lastError}`);
        
        if (attempt < 3) {
          const delay = attempt * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!response || !response.ok) {
      if (response) {
        const errorText = await response.text()
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
      } else {
        throw new Error(lastError || 'Falha na conexão com Binance após múltiplas tentativas')
      }
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

    // Se for erro temporário, tentar sistema adaptativo
    if (errorMessage.includes('temporário da API Binance') || 
        errorMessage.includes('Try again') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('Request timeout') ||
        errorMessage.includes('fetch failed')) {
      
      console.log('🤖 Tentando sistema adaptativo Binance para erro temporário...')
      
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        
        const adaptiveResponse = await fetch(`${supabaseUrl}/functions/v1/binance-adaptive-handler`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            action: 'test_connection',
            symbol: 'BTC',
            maxRetries: 2,
            credentials: {
              apiKey,
              secretKey
            }
          })
        })
        
        const adaptiveResult = await adaptiveResponse.json()
        
        if (adaptiveResult.success) {
          console.log('✅ Sistema adaptativo Binance resolveu conexão!')
          
          // Extrair dados da conta do resultado adaptativo
          const accountData = adaptiveResult.result
          const totalBalances = accountData.balances?.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0) || []
          const usdtBalance = accountData.balances?.find((b: any) => b.asset === 'USDT')
          const btcBalance = accountData.balances?.find((b: any) => b.asset === 'BTC')

          return new Response(
            JSON.stringify({
              success: true,
              message: `Conexão Binance estabelecida via sistema adaptativo! Adaptações: ${adaptiveResult.adaptations_applied?.join(', ')}`,
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
                canDeposit: accountData.canDeposit || false,
                adaptationsApplied: adaptiveResult.adaptations_applied
              }
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
      } catch (adaptiveError) {
        console.error('❌ Falha no sistema adaptativo:', adaptiveError)
      }
    }

    // Mapear erros comuns da Binance para mensagens mais claras
    if (errorMessage.includes('Invalid API-key') || errorMessage.includes('API-key format invalid')) {
      errorMessage = '🔑 API Key inválida. Verifique se copiou corretamente sua chave da Binance.'
    } else if (errorMessage.includes('Signature for this request') || errorMessage.includes('Invalid signature')) {
      errorMessage = '🔐 Secret Key incorreta. Verifique se copiou corretamente sua chave secreta da Binance.'
    } else if (errorMessage.includes('IP') || errorMessage.includes('This API key does not have permission')) {
      errorMessage = '🌐 IP não autorizado ou permissões insuficientes. Configure o IP e ative "Enable Reading" na sua API Key da Binance.'
    } else if (errorMessage.includes('Timestamp for this request')) {
      errorMessage = '⏰ Erro de timestamp. Verifique se o horário do seu sistema está correto.'
    } else if (errorMessage.includes('Permission denied')) {
      errorMessage = '🚫 Permissões insuficientes. Ative "Enable Reading" na configuração da sua API Key na Binance.'
    } else if (errorMessage.includes('temporário da API Binance')) {
      errorMessage = '⏳ API Binance temporariamente indisponível. Sistema adaptativo tentou resolver automaticamente.'
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