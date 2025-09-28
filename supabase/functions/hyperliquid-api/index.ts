import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log(`🎯 Ação solicitada: ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const action = requestData.action || 'test_connection';
    
    console.log(`📈 Obtendo dados de mercado da Hyperliquid...`);
    
    // Sempre usar endpoint público para teste de conexão
    const url = 'https://api.hyperliquid.xyz/info';
    console.log(`🌐 Fazendo requisição para Hyperliquid: POST /info`);
    console.log(`🔗 URL completa: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: "allMids"
      })
    });

    if (!response.ok) {
      console.error(`❌ Erro HTTP ${response.status}: ${response.statusText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Resposta da Hyperliquid recebida com sucesso:`, data);
    console.log(`✅ Dados de mercado obtidos:`, data);

    if (action === 'test_connection') {
      return new Response(
        JSON.stringify({
          success: true,
          exchange: 'Hyperliquid',
          status: 'connected',
          message: '✅ Conexão com Hyperliquid estabelecida com sucesso',
          latency: Date.now(),
          data: data,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Para outras ações que requerem autenticação
    const privateKey = Deno.env.get('HYPERLIQUID_PRIVATE_KEY');
    const walletAddress = Deno.env.get('HYPERLIQUID_WALLET_ADDRESS');

    if (!privateKey || !walletAddress) {
      console.warn('⚠️ Credenciais da Hyperliquid não encontradas nos secrets');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Credenciais da Hyperliquid não configuradas',
          message: 'Configure HYPERLIQUID_PRIVATE_KEY e HYPERLIQUID_WALLET_ADDRESS nos secrets',
          details: {
            privateKeyExists: !!privateKey,
            walletAddressExists: !!walletAddress
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Implementar busca de saldos usando API privada da Hyperliquid
    if (action === 'get_balance') {
      const { wallet_address, private_key } = requestData;
      
      if (!private_key || !wallet_address) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Wallet address e private key são obrigatórios para buscar saldos',
            message: 'Forneça wallet_address e private_key'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      console.log(`💰 Buscando saldos para wallet: ${wallet_address}`);
      
      try {
        // Fazer requisição para obter saldos da Hyperliquid
        const balanceUrl = 'https://api.hyperliquid.xyz/info';
        const balanceResponse = await fetch(balanceUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: "clearinghouseState",
            user: wallet_address
          })
        });

        if (!balanceResponse.ok) {
          console.error(`❌ Erro HTTP ${balanceResponse.status} ao obter saldos`);
          throw new Error(`HTTP error! status: ${balanceResponse.status}`);
        }

        const balanceData = await balanceResponse.json();
        console.log('✅ Dados de saldo obtidos da Hyperliquid:', balanceData);

        // Processar saldos
        const balances = [];
        
        if (balanceData && balanceData.marginSummary) {
          const accountValue = parseFloat(balanceData.marginSummary.accountValue || '0');
          if (accountValue > 0) {
            balances.push({
              asset: 'USD',
              free: accountValue,
              locked: 0,
              balance: accountValue
            });
          }
        }

        // Processar posições abertas se houver
        if (balanceData && balanceData.assetPositions) {
          balanceData.assetPositions.forEach((pos: any) => {
            if (pos.position && parseFloat(pos.position.szi) !== 0) {
              balances.push({
                asset: pos.position.coin,
                free: parseFloat(pos.position.szi),
                locked: 0,
                balance: parseFloat(pos.position.szi)
              });
            }
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: balances,
            balances: balances,
            wallet: wallet_address,
            timestamp: new Date().toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );

      } catch (error) {
        console.error('❌ Erro ao buscar saldos:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao buscar saldos',
            timestamp: new Date().toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }
    }

    // Simular execução de ordem (desenvolvimento)
    if (action === 'place_order') {
      const { symbol, side, quantity, price } = requestData;
      
      console.log(`🔄 Simulando ordem Hyperliquid: ${side} ${quantity} ${symbol} a $${price}`);
      
      // Simular ordem bem-sucedida
      const simulatedOrder = {
        orderId: `HL_${Date.now()}`,
        symbol: symbol,
        side: side,
        quantity: quantity,
        price: price,
        status: 'filled',
        executedQty: quantity,
        avgPrice: price,
        timestamp: Date.now()
      };

      console.log(`✅ Ordem Hyperliquid simulada executada:`, simulatedOrder);

      return new Response(
        JSON.stringify({
          success: true,
          order: simulatedOrder,
          message: `🧪 Ordem ${side} simulada: ${quantity} ${symbol} a $${price}`,
          simulated: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro na API Hyperliquid:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na API Hyperliquid';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});