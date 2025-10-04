// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper functions for API calls - CONEXÃO DIRETA SEM PROXIES
async function getBinanceBalances(apiKey: string, secretKey: string) {
  console.log('🔗 CONEXÃO DIRETA BINANCE - SEM PROXIES/BYPASS');
  console.log('API Key fornecida:', apiKey ? `${apiKey.substring(0, 8)}...` : 'VAZIA');
  console.log('Secret Key fornecida:', secretKey ? `${secretKey.substring(0, 8)}...` : 'VAZIA');
  
  // Validar se as credenciais foram fornecidas
  if (!apiKey || !secretKey) {
    throw new Error('Credenciais da Binance não fornecidas (API Key ou Secret Key ausentes)');
  }

  // Validar formato básico das credenciais
  if (apiKey.length < 32) {
    throw new Error('Formato inválido da API Key da Binance (muito curta)');
  }

  if (secretKey.length < 32) {
    throw new Error('Formato inválido da Secret Key da Binance (muito curta)');
  }
  
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  
  console.log('📝 Query string gerada:', queryString);
  
  try {
    // Generate signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('🔐 Assinatura gerada:', signatureHex.substring(0, 16) + '...');
    console.log('📡 Fazendo requisição DIRETA para api.binance.com...');
    
    const url = `https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`;
    console.log('🌐 URL completa:', url.replace(signatureHex, '***SIGNATURE***'));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 Resposta da Binance:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro detalhado da API Binance:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      let errorMessage = `Binance API error ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.msg) {
          errorMessage += ` - ${errorData.msg}`;
          
          // Dar dicas específicas baseadas no erro
          if (errorData.code === -2014) {
            errorMessage += ' (Verifique se a API Key está correta)';
          } else if (errorData.code === -1021) {
            errorMessage += ' (Erro de timestamp - sincronização de horário)';
          } else if (errorData.code === -2015) {
            errorMessage += ' (Assinatura inválida - verifique a Secret Key)';
          }
        }
      } catch {
        // Ignorar se não conseguir parsear o JSON do erro
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ Binance API conectada diretamente com sucesso!');
    console.log(`📊 Dados recebidos: ${data.balances ? data.balances.length : 0} saldos`);
    
    return data.balances.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);

  } catch (error) {
    console.error('💥 Erro na função getBinanceBalances:', error);
    throw error;
  }
}

async function getBinancePrices() {
  const response = await fetch('https://api.binance.com/api/v3/ticker/price');
  
  if (!response.ok) {
    throw new Error(`Binance Price API error: ${response.statusText}`);
  }

  const data = await response.json();
  const priceMap: { [key: string]: number } = {};
  
  data.forEach((ticker: any) => {
    // Remover USDT do símbolo para obter o símbolo base
    if (ticker.symbol.endsWith('USDT')) {
      const baseSymbol = ticker.symbol.replace('USDT', '');
      priceMap[baseSymbol] = parseFloat(ticker.price);
    }
    // Para USDT, o preço é sempre 1
    if (ticker.symbol === 'USDTUSDT' || ticker.symbol === 'USDT') {
      priceMap['USDT'] = 1.0;
    }
  });
  
  // Adicionar preços fixos para stablecoins e tokens que não têm par USDT
  priceMap['USDT'] = 1.0;
  priceMap['USDC'] = 1.0;
  priceMap['BUSD'] = 1.0;
  priceMap['BRL'] = 0.18; // Aproximação para BRL
  
  return priceMap;
}

async function getHyperliquidBalances(walletAddress: string, privateKey: string): Promise<any> {
  try {
    console.log(`🔗 Obtendo saldos da Hyperliquid para wallet: ${walletAddress.substring(0, 8)}...`);
    
    // Verificar se as credenciais estão válidas
    if (!walletAddress || !privateKey || walletAddress === 'undefined' || privateKey === 'undefined') {
      console.warn('⚠️ Credenciais Hyperliquid inválidas');
      throw new Error('Credenciais Hyperliquid não configuradas corretamente');
    }
    
    // Usar a nossa edge function hyperliquid-api para obter saldos
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/hyperliquid-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        action: 'get_balance',
        wallet_address: walletAddress,
        private_key: privateKey
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro Hyperliquid API:', response.status, errorText);
      throw new Error(`Hyperliquid API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Hyperliquid error: ${data.error}`);
    }
    
    console.log('✅ Hyperliquid API conectada com sucesso');
    
    // Processar os dados retornados pela nova implementação
    const balances = data.balances || data.data || [];
    console.log(`🔍 Processando ${balances.length} saldos da Hyperliquid:`, balances);
    
    return balances;

  } catch (error) {
    console.error('❌ Erro ao obter saldos Hyperliquid:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido na Hyperliquid',
      balances: []
    };
  }
}

async function getPionexBalances(apiKey: string, secretKey: string) {
  try {
    const timestamp = Date.now().toString();
    
    // Pionex API: Criar query string para balance
    const params = `timestamp=${timestamp}`;
    
    // Generate signature for Pionex (método correto)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Assinatura no formato correto para Pionex
    const message = `GET/api/v1/account/balance?${params}`;
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('🔄 Tentando conectar na Pionex API...');
    
    const response = await fetch(`https://api.pionex.com/api/v1/account/balance?${params}`, {
      method: 'GET',
      headers: {
        'PIONEX-KEY': apiKey,
        'PIONEX-SIGNATURE': signatureHex,
        'PIONEX-TIMESTAMP': timestamp,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro Pionex API:', response.status, errorText);
      
        // Se for erro 404/Not Found ou 403/Forbidden, tentar endpoint alternativo
        if (response.status === 404 || response.status === 403) {
        console.log('🔄 Tentando endpoint alternativo da Pionex...');
        
        const altResponse = await fetch(`https://api.pionex.com/api/v1/account/balances?${params}`, {
          method: 'GET',
          headers: {
            'PIONEX-KEY': apiKey,
            'PIONEX-SIGNATURE': signatureHex,
            'PIONEX-TIMESTAMP': timestamp,
            'Content-Type': 'application/json',
          },
        });
        
        if (!altResponse.ok) {
          const altErrorText = await altResponse.text();
          console.error('❌ Endpoint alternativo também falhou:', altResponse.status, altErrorText);
          throw new Error(`Pionex API error: ${response.status} - ${errorText}`);
        }
        
        const altData = await altResponse.json();
        console.log('✅ Sucesso com endpoint alternativo da Pionex');
        return altData.result?.balances || altData.data?.balances || [];
      }
      
      throw new Error(`Pionex API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Pionex API conectada com sucesso');
    return data.result?.balances || data.data?.balances || [];
    
  } catch (error) {
    console.error('❌ Erro específico da Pionex:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse request body para obter credenciais e user_id
    let requestData: any = {};
    if (req.method === 'POST') {
      try {
        requestData = await req.json();
      } catch (e) {
        // Se não conseguir fazer parse, continua com dados vazios
      }
    }
    
    // Usar user_id da requisição - OBRIGATÓRIO
    if (!requestData.user_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User ID é obrigatório. Faça login para continuar.',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const userId = requestData.user_id;
    console.log('User ID usado:', userId);

    const realMode = requestData.real_mode || false;
    const userBinanceApiKey = requestData.binance_api_key;
    const userBinanceSecretKey = requestData.binance_secret_key;
    const userHyperliquidWalletName = requestData.hyperliquid_wallet_name;
    const userHyperliquidWalletAddress = requestData.hyperliquid_wallet_address;
    const userHyperliquidPrivateKey = requestData.hyperliquid_private_key;
    const userOKXApiKey = requestData.okx_api_key;
    const userOKXSecretKey = requestData.okx_secret_key;
    const userOKXPassphrase = requestData.okx_passphrase;
    const userBybitApiKey = requestData.bybit_api_key;
    const userBybitSecretKey = requestData.bybit_secret_key;

    console.log('=== RECEBIDA REQUISIÇÃO GET-PORTFOLIO ===');
    console.log('Modo real:', realMode);
    console.log('Credenciais fornecidas:', {
      binanceApiKey: userBinanceApiKey ? `${userBinanceApiKey.substring(0, 8)}...` : 'não fornecida',
      binanceSecretKey: userBinanceSecretKey ? `${userBinanceSecretKey.substring(0, 8)}...` : 'não fornecida',
      okxApiKey: userOKXApiKey ? `${userOKXApiKey.substring(0, 8)}...` : 'não fornecida',
      okxPass: userOKXPassphrase ? '***' : 'não fornecida',
      hyperliquidWalletName: userHyperliquidWalletName ? userHyperliquidWalletName : 'não fornecida',
      hyperliquidWalletAddress: userHyperliquidWalletAddress ? `${userHyperliquidWalletAddress.substring(0, 8)}...` : 'não fornecida',
      hyperliquidPrivateKey: userHyperliquidPrivateKey ? `${userHyperliquidPrivateKey.substring(0, 8)}...` : 'não fornecida',
      bybitApiKey: userBybitApiKey ? `${userBybitApiKey.substring(0, 8)}...` : 'não fornecida',
      bybitSecretKey: userBybitSecretKey ? `${userBybitSecretKey.substring(0, 8)}...` : 'não fornecida',
    });

    // Usar credenciais fornecidas pelo usuário - SEM FALLBACK PARA ENV VARS
    const binanceApiKey = userBinanceApiKey;
    const binanceSecretKey = userBinanceSecretKey;
    const hyperliquidWalletAddress = userHyperliquidWalletAddress;
    const hyperliquidPrivateKey = userHyperliquidPrivateKey;
    const okxApiKey = userOKXApiKey;
    const okxSecretKey = userOKXSecretKey;
    const okxPassphrase = userOKXPassphrase;
    const bybitApiKey = userBybitApiKey;
    const bybitSecretKey = userBybitSecretKey;

    console.log('Credenciais finais a serem usadas:', {
      binanceApiKey: binanceApiKey ? `${binanceApiKey.substring(0, 8)}...` : 'AUSENTE',
      binanceSecretKey: binanceSecretKey ? `${binanceSecretKey.substring(0, 8)}...` : 'AUSENTE',
      okxApiKey: okxApiKey ? `${okxApiKey.substring(0, 8)}...` : 'AUSENTE',
      hyperliquidWalletAddress: hyperliquidWalletAddress ? `${hyperliquidWalletAddress.substring(0, 8)}...` : 'AUSENTE',
      hyperliquidPrivateKey: hyperliquidPrivateKey ? `${hyperliquidPrivateKey.substring(0, 8)}...` : 'AUSENTE'
    });

    // Buscar saldos reais das exchanges apenas se modo real estiver ativo
    let realBalances: any[] = [];
    let dataSource = realMode ? 'real' : 'simulated';
    let tokenPrices: { [key: string]: number } = {};
    
    // Buscar preços dos tokens via API da Binance
    try {
      console.log('Buscando preços dos tokens da Binance...');
      tokenPrices = await getBinancePrices();
      console.log(`Carregados preços para ${Object.keys(tokenPrices).length} tokens`);
    } catch (error) {
      console.error('Erro ao buscar preços dos tokens:', error);
      // Continuar sem preços se der erro
    }
    
    if (realMode) {
      try {
        console.log('=== MODO REAL ATIVO ===');
        console.log('Credenciais disponíveis:', {
          binanceApiKey: !!binanceApiKey,
          binanceSecretKey: !!binanceSecretKey,
          hyperliquidWalletAddress: !!hyperliquidWalletAddress,
          hyperliquidPrivateKey: !!hyperliquidPrivateKey,
          userProvidedBinance: !!(userBinanceApiKey && userBinanceSecretKey),
          userProvidedHyperliquid: !!(userHyperliquidWalletAddress && userHyperliquidPrivateKey)
        });
        
        if (binanceApiKey && binanceSecretKey) {
          console.log('Tentando conectar na Binance com credenciais fornecidas...');
          console.log('🔍 Validando credenciais da Binance...');
          console.log('✓ API Key presente:', !!binanceApiKey, binanceApiKey ? `(${binanceApiKey.length} chars)` : '');
          console.log('✓ Secret Key presente:', !!binanceSecretKey, binanceSecretKey ? `(${binanceSecretKey.length} chars)` : '');
          
          try {
            const binanceBalances = await getBinanceBalances(binanceApiKey, binanceSecretKey);
            realBalances = realBalances.concat(
              binanceBalances.map((b: any) => ({
                symbol: b.asset,
                balance: parseFloat(b.free),
                locked_balance: parseFloat(b.locked),
                exchange: 'Binance',
                price_usd: tokenPrices[b.asset] || 0,
                value_usd: parseFloat(b.free) * (tokenPrices[b.asset] || 0),
                updated_at: new Date().toISOString()
              }))
            );
            console.log(`✅ Binance conectada com sucesso: ${binanceBalances.length} saldos carregados`);
          } catch (binanceError) {
            console.error('❌ Erro específico da Binance:', binanceError);
            console.error('📋 Detalhes completos do erro:', {
              message: binanceError.message,
              name: binanceError.name,
              stack: binanceError.stack
            });
            
            // Verificar diferentes tipos de erro
            if (binanceError.message.includes('Geographic restriction') || binanceError.message.includes('451')) {
              console.error('🌍 RESTRIÇÃO GEOGRÁFICA DA BINANCE!');
              console.error('O servidor Supabase está em uma localização bloqueada pela Binance.');
              console.error('Isso é temporário e independe das suas credenciais.');
              dataSource = 'simulated-geo-restriction';
            } else if (binanceError.message.includes('Unauthorized') || binanceError.message.includes('401') || binanceError.message.includes('API-key format invalid')) {
              console.error('🚨 CREDENCIAIS DA BINANCE INVÁLIDAS! Verifique:');
              console.error('1. Se a API Key está correta');
              console.error('2. Se a Secret Key está correta');
              console.error('3. Se as permissões incluem "Enable Reading" e "Spot & Margin Trading"');
              console.error('4. Se o IP está na whitelist (se configurado)');
              console.error('💡 Erro específico:', binanceError.message);
              // Não interromper o fluxo: seguimos para Hyperliquid/OKX
              dataSource = dataSource === 'real' ? 'partial-real' : dataSource;
            } else {
              dataSource = dataSource === 'real' ? 'api-error' : dataSource;
            }
            // Não relançar o erro para permitir continuar com as outras exchanges
          }
        } else {
          console.log('⚠️ Credenciais da Binance não fornecidas - pulando Binance');
        }

        // Buscar saldos da Hyperliquid
        if (hyperliquidWalletAddress && hyperliquidPrivateKey) {
          console.log('Tentando conectar na Hyperliquid com credenciais fornecidas...');
          try {
            const hyperliquidBalances = await getHyperliquidBalances(hyperliquidWalletAddress, hyperliquidPrivateKey);
            
            // Processar saldos da Hyperliquid
            const processedHyperliquidBalances = hyperliquidBalances
              .filter((b: any) => (parseFloat(b.free || b.balance || 0) > 0))
              .map((b: any) => {
                const assetSymbol = b.asset || b.symbol;
                let priceUsd = 0;
                
                // Tentar encontrar preço de diferentes formas
                if (assetSymbol) {
                  priceUsd = tokenPrices[assetSymbol] || 
                            tokenPrices[`${assetSymbol}USDT`] ||
                            tokenPrices[`${assetSymbol}USD`] ||
                            (assetSymbol === 'USDC' ? 1.0 : 0);
                }
                
                const balance = parseFloat(b.free || b.balance || 0);
                
                return {
                  symbol: assetSymbol,
                  balance: balance,
                  locked_balance: parseFloat(b.locked || 0),
                  exchange: 'Hyperliquid',
                  type: b.type || 'spot',
                  price_usd: priceUsd,  
                  value_usd: priceUsd * balance,
                  application_title: b.type === 'perpetual' ? 'Perpétua' : 
                                    b.type === 'cross-margin' ? 'Cross-margin' : 
                                    'Cross-exchange arbitrage',
                  updated_at: new Date().toISOString()
                };
              });
            
            realBalances = realBalances.concat(processedHyperliquidBalances);
            console.log(`✅ Hyperliquid conectada com sucesso: ${hyperliquidBalances.length} saldos carregados`);
          } catch (hyperliquidError) {
            console.error('❌ Erro específico da Hyperliquid:', hyperliquidError);
            // Para Hyperliquid, não fazemos throw pois pode não ter credenciais válidas
          }
        } else {
          console.log('⚠️ Credenciais da Hyperliquid não fornecidas - pulando Hyperliquid');
        }

        // Buscar saldos da OKX
        if (okxApiKey && okxSecretKey && okxPassphrase) {
          try {
            console.log('Tentando conectar na OKX com credenciais fornecidas...');
            const okxResp = await fetch(`${supabaseUrl}/functions/v1/okx-api`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
              body: JSON.stringify({ 
                action: 'get_balances', 
                api_key: okxApiKey, 
                secret_key: okxSecretKey, 
                passphrase: okxPassphrase,
                user_id: userId 
              })
            });
            const okxJson = await okxResp.json();
            if (okxJson.success) {
              const okxBalances = okxJson.balances || [];
              const processedOKXBalances = okxBalances.map((b: any) => {
                const assetSymbol = b.asset;
                const priceUsd = tokenPrices[assetSymbol] || tokenPrices[`${assetSymbol}USDT`] || (assetSymbol === 'USDT' ? 1 : 0);
                const balance = parseFloat(b.free || b.balance || 0);
                return {
                  symbol: assetSymbol,
                  balance,
                  locked_balance: parseFloat(b.locked || 0),
                  exchange: 'OKX',
                  price_usd: priceUsd,
                  value_usd: priceUsd * balance,
                  updated_at: new Date().toISOString()
                };
              });
              realBalances = realBalances.concat(processedOKXBalances);
              console.log(`✅ OKX conectada com sucesso: ${okxBalances.length} saldos carregados`);
            } else {
              console.warn('⚠️ Falha ao obter saldos da OKX:', okxJson.error);
              
              // Verificar se é erro de IP whitelist (código 50110)
              if (okxJson.error && okxJson.error.includes('50110')) {
                console.error('🚫 ERRO DE IP WHITELIST DA OKX!');
                console.error('Supabase está usando IPs dinâmicos que não estão na whitelist da OKX');
                console.error('💡 SOLUÇÕES:');
                console.error('1. Na OKX → API Management → Edit → Desabilite IP Restriction');
                console.error('2. Ou adicione 0.0.0.0/0 na whitelist (se disponível)');
                console.error('3. Ou mantenha a OKX apenas para preços (sem saldos)');
                dataSource = dataSource === 'real' ? 'partial-real' : dataSource;
              } else if (okxJson.error && okxJson.error.includes('Unauthorized')) {
                console.error('🚨 CREDENCIAIS DA OKX INVÁLIDAS! Verifique:');
                console.error('1. Se a API Key está correta');
                console.error('2. Se a Secret Key está correta');
                console.error('3. Se a Passphrase está correta');
                console.error('4. Se as permissões incluem "Trade"');
                dataSource = dataSource === 'real' ? 'partial-real' : dataSource;
              }
            }
          } catch (okxError) {
            console.error('❌ Erro específico da OKX:', okxError);
            console.error('📋 Detalhes do erro OKX:', {
              message: okxError.message,
              name: okxError.name
            });
            
            // Verificar se é erro de conectividade ou whitelist
            if (okxError.message.includes('50110') || okxError.message.includes('IP') || okxError.message.includes('whitelist')) {
              console.error('🚫 PROBLEMA DE IP WHITELIST DA OKX - Edge Functions usam IPs dinâmicos');
              console.error('💡 Configure a OKX para permitir qualquer IP ou desabilite IP Restriction');
              dataSource = dataSource === 'real' ? 'partial-real' : dataSource;
            } else {
              console.error('❌ Erro geral da OKX - pode ser temporário');
              dataSource = dataSource === 'real' ? 'partial-real' : dataSource;
            }
          }
        } else {
          console.log('⚠️ Credenciais da OKX não fornecidas - pulando OKX');
        }

        // Buscar saldos da Bybit
        if (bybitApiKey && bybitSecretKey) {
          try {
            console.log('Tentando conectar na Bybit com credenciais fornecidas...');
            const bybitResp = await fetch(`${supabaseUrl}/functions/v1/bybit-api`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
              body: JSON.stringify({ 
                action: 'get_balances', 
                api_key: bybitApiKey, 
                secret_key: bybitSecretKey,
                user_id: userId 
              })
            });
            const bybitJson = await bybitResp.json();
            if (bybitJson.success) {
              const bybitBalances = bybitJson.balances || [];
              const processedBybitBalances = bybitBalances.map((b: any) => {
                const assetSymbol = b.symbol;
                const priceUsd = tokenPrices[assetSymbol] || tokenPrices[`${assetSymbol}USDT`] || (assetSymbol === 'USDT' ? 1 : 0);
                const balance = parseFloat(b.balance || 0);
                return {
                  symbol: assetSymbol,
                  balance,
                  locked_balance: parseFloat(b.locked || 0),
                  exchange: 'Bybit',
                  price_usd: priceUsd,
                  value_usd: priceUsd * balance,
                  updated_at: new Date().toISOString()
                };
              });
              realBalances = realBalances.concat(processedBybitBalances);
              console.log(`✅ Bybit conectada com sucesso: ${bybitBalances.length} saldos carregados`);
            } else {
              console.warn('⚠️ Falha ao obter saldos da Bybit:', bybitJson.error);
              if (bybitJson.error && bybitJson.error.includes('Unauthorized')) {
                console.error('🚨 CREDENCIAIS DA BYBIT INVÁLIDAS! Verifique:');
                console.error('1. Se a API Key está correta');
                console.error('2. Se a Secret Key está correta');
                console.error('3. Se as permissões incluem leitura de saldos');
                dataSource = dataSource === 'real' ? 'partial-real' : dataSource;
              }
            }
          } catch (bybitError) {
            console.error('❌ Erro específico da Bybit:', bybitError);
            console.error('📋 Detalhes do erro Bybit:', {
              message: bybitError.message,
              name: bybitError.name
            });
            dataSource = dataSource === 'real' ? 'partial-real' : dataSource;
          }
        } else {
          console.log('⚠️ Credenciais da Bybit não fornecidas - pulando Bybit');
        }

        if (realBalances.length > 0) {
          dataSource = 'real-api';
          console.log(`✅ SUCESSO: ${realBalances.length} saldos reais carregados de ${realBalances.map(b => b.exchange).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`);
        } else {
          console.log('❌ Nenhum saldo real encontrado - credenciais podem estar inválidas');
          dataSource = 'no-data';
        }
      } catch (error) {
        console.error('❌ ERRO GERAL ao buscar saldos das exchanges:', error);
        console.error('Detalhes do erro:', {
          message: error.message,
          stack: error.stack
        });
        
        // Verificar diferentes tipos de erro
        if (error.message.includes('Geographic restriction') || error.message.includes('451')) {
          console.error('🌍 RESTRIÇÃO GEOGRÁFICA DA BINANCE!');
          console.error('O servidor Supabase está em uma localização bloqueada pela Binance.');
          dataSource = 'geo-blocked';
        } else if (error.message.includes('Unauthorized') || error.message.includes('401')) {
          console.error('🚨 CREDENCIAIS DA BINANCE INVÁLIDAS! Verifique:');
          console.error('1. Se a API Key está correta');
          console.error('2. Se a Secret Key está correta');
          console.error('3. Se as permissões incluem "Enable Reading" e "Spot & Margin Trading"');
          console.error('4. Se o IP está na whitelist (se configurado)');
          dataSource = 'invalid-credentials';
        } else {
          dataSource = 'api-error';
        }
        
        console.info('❌ ERRO: Não é possível buscar saldos reais. Não usando fallback simulado.');
      }
    }

    // 🔄 Se conseguiu buscar dados das exchanges, sincronizar com portfolio local
    if (realBalances.length > 0 && realMode) {
      console.log(`Sincronizando ${realBalances.length} saldos com banco de dados...`);
      
      // Agrupar saldos por exchange
      const binanceBalances = realBalances
        .filter(asset => asset.exchange === 'Binance')
        .map(asset => ({ ...asset, symbol: asset.symbol, balance: asset.balance, exchange: 'Binance' }));
      
      const okxBalances = realBalances
        .filter(asset => asset.exchange === 'OKX')
        .map(asset => ({ ...asset, symbol: asset.symbol, balance: asset.balance, exchange: 'OKX' }));
      
      const hyperliquidBalances = realBalances
        .filter(asset => asset.exchange === 'Hyperliquid')
        .map(asset => ({ ...asset, symbol: asset.symbol, balance: asset.balance, exchange: 'Hyperliquid' }));
      
      const bybitBalances = realBalances
        .filter(asset => asset.exchange === 'Bybit')
        .filter(asset => asset.balance > 0)
        .map(asset => ({
          symbol: asset.symbol,
          balance: asset.balance,
          price_usd: asset.price_usd || 0,
          value_usd: asset.value_usd || 0
        }));

      const okxBalances = realBalances
        .filter(asset => asset.exchange === 'OKX')
        .filter(asset => asset.balance > 0)
        .map(asset => ({
          symbol: asset.symbol,
          balance: asset.balance,
          price_usd: asset.price_usd || 0,
          value_usd: asset.value_usd || 0
        }));

      const hyperliquidBalances = realBalances
        .filter(asset => asset.exchange === 'Hyperliquid')
        .filter(asset => asset.balance > 0)
        .map(asset => ({
          symbol: asset.symbol,
          balance: asset.balance,
          price_usd: asset.price_usd || 0,
          value_usd: asset.value_usd || 0
        }));

      // Sincronizar cada exchange usando a nova função
      try {
        if (binanceBalances.length > 0) {
          await supabase.rpc('sync_real_balances', {
            p_user_id: userId,
            p_exchange: 'Binance', 
            p_balances: binanceBalances
          });
        }

        if (okxBalances.length > 0) {
          await supabase.rpc('sync_real_balances', {
            p_user_id: userId,
            p_exchange: 'OKX',
            p_balances: okxBalances
          });
        }

        if (hyperliquidBalances.length > 0) {
          await supabase.rpc('sync_real_balances', {
            p_user_id: userId,
            p_exchange: 'Hyperliquid',
            p_balances: hyperliquidBalances
          });
        }

        if (bybitBalances.length > 0) {
          await supabase.rpc('sync_real_balances', {
            p_user_id: userId,
            p_exchange: 'Bybit',
            p_balances: bybitBalances
          });
        }

        console.log("✅ Saldos sincronizados com sucesso no banco de dados");
      } catch (syncError) {
        console.error("❌ Erro ao sincronizar saldos:", syncError);
      }
    }

    // ===============================================
    // 📊 BUSCAR DADOS DO PORTFOLIO ATUALIZADO
    // ===============================================

    let portfolio: any[] = [];

    // Sempre buscar dados do banco (após sincronização ou dados existentes)
    const { data: localAssets, error: localError } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .gt('balance', 0)
      .order('exchange', { ascending: true })
      .order('symbol', { ascending: true });

    if (localError) {
      console.error("❌ Erro ao buscar dados do portfolio:", localError);
      portfolio = [];
    } else if (localAssets && localAssets.length > 0) {
      portfolio = localAssets.map(asset => ({
        ...asset,
        price_usd: asset.price_usd || tokenPrices[asset.symbol] || 0,
        value_usd: asset.value_usd || (asset.balance * (tokenPrices[asset.symbol] || 0))
      }));
      console.log(`📊 Portfolio carregado: ${portfolio.length} ativos`);
    } else {
      console.log(`📊 Portfolio vazio - nenhum saldo encontrado`);
      portfolio = [];
    }

    // Se há saldos reais das exchanges, usar diretamente (sem fallback para dados antigos)
    if (realBalances.length > 0 && realMode) {
      const realPortfolio = realBalances
        .filter(asset => asset.balance > 0)
        .map(asset => ({
          symbol: asset.symbol,
          balance: asset.balance,
          locked_balance: asset.locked_balance || 0,
          exchange: asset.exchange,
          price_usd: asset.price_usd || tokenPrices[asset.symbol] || 0,
          value_usd: asset.value_usd || (asset.balance * (tokenPrices[asset.symbol] || 0)),
          application_title: asset.application_title || `Real Balance - ${asset.exchange}`,
          investment_type: asset.type || 'spot',
          updated_at: new Date().toISOString()
        }));
      
      // Usar apenas dados reais se existirem
      if (realPortfolio.length > 0) {
        portfolio = realPortfolio;
        console.log("📈 Usando dados reais das exchanges");
      }
    }

    // Buscar histórico de trades
    const { data: trades, error: tradesError } = await supabase
      .from('arbitrage_trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (tradesError) {
      throw new Error(`Erro ao buscar trades: ${tradesError.message}`);
    }

    // Calcular estatísticas
    const totalValue = portfolio?.reduce((sum, asset) => {
      const assetValue = (asset.value_usd_calculated || (asset.balance * asset.price_usd)) || asset.value_usd || 0;
      return sum + assetValue;
    }, 0) || 0;
    
    const totalTrades = trades?.length || 0;
    const successfulTrades = trades?.filter(t => t.status === 'completed').length || 0;
    const totalProfit = trades?.reduce((sum, t) => sum + (parseFloat(t.net_profit) || 0), 0) || 0;
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;

    console.log(`Portfolio stats - Value: ${totalValue}, Trades: ${totalTrades}, Success: ${successRate.toFixed(1)}%, Source: ${dataSource}`);

    const isSuccess = (portfolio && portfolio.length > 0) || dataSource === 'real-api' || dataSource === 'partial-real' || !realMode;

    return new Response(JSON.stringify({
      success: isSuccess,
      data: {
        portfolio: portfolio || [],
        recent_trades: trades || [],
        statistics: {
          total_value_usd: totalValue,
          total_trades: totalTrades,
          successful_trades: successfulTrades,
          total_profit_usd: totalProfit,
          success_rate_percent: successRate,
          last_updated: new Date().toISOString()
        },
        data_source: dataSource,
        real_mode_active: realMode,
        error_info: dataSource.includes('error') || dataSource.includes('invalid') || dataSource.includes('blocked') ? 
          'API credentials invalid or connection issue. Please verify your API keys.' : null
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na edge function get-portfolio:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});