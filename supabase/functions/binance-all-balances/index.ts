import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface WalletBalance {
  type: string
  asset: string
  free: string
  locked: string
  balance: number
  source: 'real' | 'simulated'
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando consulta de saldos Binance - CONEXÃO DIRETA');
    
    let body: any = {}
    if (req.method === 'POST') {
      body = await req.json()
    }

    const binanceApiKey = body.apiKey;
    const binanceSecretKey = body.secretKey;

    if (!binanceApiKey || !binanceSecretKey) {
      throw new Error('Credenciais da Binance são obrigatórias (apiKey e secretKey)');
    }

    if (!binanceApiKey || !binanceSecretKey) {
      console.log('⚠️ Credenciais da Binance não fornecidas - usando dados simulados');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais da Binance não fornecidas' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Função para criar assinatura HMAC-SHA256
    const createSignature = async (queryString: string): Promise<string> => {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(binanceSecretKey);
      const messageData = encoder.encode(queryString);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    };

    // Função simplificada para conexão DIRETA - SEM PROXIES
    const fetchBinanceEndpoint = async (endpoint: string) => {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = await createSignature(queryString);
      
      console.log(`🔗 CONEXÃO DIRETA: ${endpoint}`);
      
      const url = `https://api.binance.com${endpoint}?${queryString}&signature=${signature}`;
      
      console.log(`📡 Fazendo requisição DIRETA para: api.binance.com${endpoint}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 
          'X-MBX-APIKEY': binanceApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro direto: ${response.status} - ${errorText}`);
        throw new Error(`Binance API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.code && data.msg) {
        console.error(`❌ Erro da API Binance: ${data.code} - ${data.msg}`);
        throw new Error(`Binance API error: ${data.msg}`);
      }

      console.log(`✅ Sucesso DIRETO: ${endpoint}`);
      return data;
    };

    const wallets: WalletBalance[] = [];

    try {
      // 1. CARTEIRA SPOT (À VISTA)
      console.log('💰 Consultando carteira Spot...');
      const spotData = await fetchBinanceEndpoint('/api/v3/account');
      
      if (spotData && spotData.balances) {
        spotData.balances.forEach((balance: any) => {
          const free = parseFloat(balance.free);
          const locked = parseFloat(balance.locked);
          const total = free + locked;

          if (total > 0) {
            wallets.push({
              type: 'Spot',
              asset: balance.asset,
              free: balance.free,
              locked: balance.locked,
              balance: total,
              source: 'real'
            });
          }
        });
        console.log(`✅ Spot: ${wallets.filter(w => w.type === 'Spot').length} assets encontrados`);
      }

    } catch (error) {
      console.error('❌ Erro ao buscar saldos Spot:', error);
      throw error;
    }

    try {
      // 2. CARTEIRA FUTURES
      console.log('🚀 Consultando carteira Futures...');
      const futuresData = await fetchBinanceEndpoint('/fapi/v2/account');
      
      if (futuresData && futuresData.assets) {
        futuresData.assets.forEach((asset: any) => {
          const balance = parseFloat(asset.walletBalance);
          if (balance > 0) {
            wallets.push({
              type: 'Futures',
              asset: asset.asset,
              free: asset.availableBalance,
              locked: (balance - parseFloat(asset.availableBalance)).toString(),
              balance: balance,
              source: 'real'
            });
          }
        });
        console.log(`✅ Futures: ${wallets.filter(w => w.type === 'Futures').length} assets encontrados`);
      }

    } catch (error) {
      console.error('❌ Erro ao buscar saldos Futures (normal se não tiver acesso):', error);
      // Continuar sem Futures se der erro
    }

    try {
      // 3. CARTEIRA MARGIN
      console.log('📈 Consultando carteira Margin...');
      const marginData = await fetchBinanceEndpoint('/sapi/v1/margin/account');
      
      if (marginData && marginData.userAssets) {
        marginData.userAssets.forEach((asset: any) => {
          const free = parseFloat(asset.free);
          const locked = parseFloat(asset.locked);
          const borrowed = parseFloat(asset.borrowed);
          const total = free + locked - borrowed;

          if (total > 0) {
            wallets.push({
              type: 'Margin',
              asset: asset.asset,
              free: asset.free,
              locked: asset.locked,
              balance: total,
              source: 'real'
            });
          }
        });
        console.log(`✅ Margin: ${wallets.filter(w => w.type === 'Margin').length} assets encontrados`);
      }

    } catch (error) {
      console.error('❌ Erro ao buscar saldos Margin (normal se não tiver acesso):', error);
      // Continuar sem Margin se der erro
    }

    // Log final dos resultados
    console.log(`📊 Total de assets encontrados: ${wallets.length}`);
    console.log(`🎯 Distribuição: Spot(${wallets.filter(w => w.type === 'Spot').length}) Futures(${wallets.filter(w => w.type === 'Futures').length}) Margin(${wallets.filter(w => w.type === 'Margin').length})`);

    // Retornar os resultados
    return new Response(
      JSON.stringify({
        success: true,
        data: wallets,
        total_wallets: wallets.length,
        message: 'Dados obtidos com sucesso da Binance via conexão direta'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na função:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});