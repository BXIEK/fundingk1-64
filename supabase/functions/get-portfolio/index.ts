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
  
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  
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
    const errorText = await response.text();
    console.error('❌ Erro da API Binance:', response.status, errorText);
    
    let errorMessage = `Binance API error: ${response.statusText}`;
    
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.msg) {
        errorMessage += ` - ${errorData.msg}`;
      }
    } catch {
      // Ignorar se não conseguir parsear o JSON do erro
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log('✅ Binance API conectada diretamente com sucesso!');
  return data.balances.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
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

async function getHyperliquidBalances(walletAddress: string, privateKey: string) {
  try {
    console.log('🔄 Tentando conectar na Hyperliquid API...');
    
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
    const balances = data.data || [];
    console.log(`🔍 Processando ${balances.length} saldos da Hyperliquid:`, balances);
    
    // Converter para formato padrão
    const processedBalances = balances.map((balance: any) => ({
      asset: balance.asset,
      free: balance.balance?.toString() || '0',
      locked: '0',
      balance: balance.balance || 0,
      type: balance.type || 'spot',
      exchange: 'Hyperliquid'
    }));
    
    console.log(`✅ ${processedBalances.length} saldos convertidos da Hyperliquid`);
    return processedBalances;
    
  } catch (error) {
    console.error('❌ Erro específico da Hyperliquid:', error);
    throw error;
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
      
      // Se for erro 404/Not Found, tentar endpoint alternativo
      if (response.status === 404) {
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
    
    // Usar user_id da requisição ou fallback para demo user
    const userId = requestData.user_id || '00000000-0000-0000-0000-000000000000';
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
    });

    // Fallback para env vars se não foram fornecidas
    const binanceApiKey = userBinanceApiKey || Deno.env.get('BINANCE_API_KEY');
    const binanceSecretKey = userBinanceSecretKey || Deno.env.get('BINANCE_SECRET_KEY');
    const hyperliquidWalletAddress = userHyperliquidWalletAddress;
    const hyperliquidPrivateKey = userHyperliquidPrivateKey || Deno.env.get('HYPERLIQUID_PRIVATE_KEY');
    const okxApiKey = userOKXApiKey || Deno.env.get('OKX_API_KEY');
    const okxSecretKey = userOKXSecretKey || Deno.env.get('OKX_SECRET_KEY');
    const okxPassphrase = userOKXPassphrase || Deno.env.get('OKX_PASSPHRASE');

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
          try {
            const binanceBalances = await getBinanceBalances(binanceApiKey, binanceSecretKey);
            realBalances = realBalances.concat(
              binanceBalances.map((b: any) => ({
                symbol: b.asset,
                balance: parseFloat(b.free),
                locked_balance: parseFloat(b.locked),
                exchange: 'Binance',
                price_usd: tokenPrices[b.asset] || 0,
                value_usd: tokenPrices[b.asset] || 0,
                updated_at: new Date().toISOString()
              }))
            );
            console.log(`✅ Binance conectada com sucesso: ${binanceBalances.length} saldos carregados`);
          } catch (binanceError) {
            console.error('❌ Erro específico da Binance:', binanceError);
            console.error('Detalhes do erro:', {
              message: binanceError.message,
              stack: binanceError.stack
            });
            
            // Verificar diferentes tipos de erro
            if (binanceError.message.includes('Geographic restriction') || binanceError.message.includes('451')) {
              console.error('🌍 RESTRIÇÃO GEOGRÁFICA DA BINANCE!');
              console.error('O servidor Supabase está em uma localização bloqueada pela Binance.');
              console.error('Isso é temporário e independe das suas credenciais.');
              dataSource = 'simulated-geo-restriction';
            } else if (binanceError.message.includes('Unauthorized') || binanceError.message.includes('401')) {
              console.error('🚨 CREDENCIAIS DA BINANCE INVÁLIDAS! Verifique:');
              console.error('1. Se a API Key está correta');
              console.error('2. Se a Secret Key está correta');
              console.error('3. Se as permissões incluem "Enable Reading" e "Spot & Margin Trading"');
              console.error('4. Se o IP está na whitelist (se configurado)');
            }
            
            throw binanceError; // Re-throw para ser capturado pelo catch geral
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
            }
          } catch (okxError) {
            console.error('❌ Erro específico da OKX:', okxError);
          }
        } else {
          console.log('⚠️ Credenciais da OKX não fornecidas - pulando OKX');
        }

        if (realBalances.length > 0) {
          dataSource = 'real-api';
          console.log(`✅ SUCESSO: ${realBalances.length} saldos reais carregados de ${realBalances.map(b => b.exchange).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`);
        } else {
          console.log('⚠️ Nenhum saldo real encontrado, usando dados simulados como fallback');
          dataSource = 'simulated-fallback';
        }
      } catch (error) {
        console.error('❌ ERRO GERAL ao buscar saldos das exchanges:', error);
        console.log('🔄 Usando dados simulados como fallback devido ao erro na API');
        dataSource = 'simulated-fallback';
      }
    }

    // Atualizar portfolio local com saldos reais (mantendo informação da exchange)
    if (realBalances.length > 0) {
      for (const balance of realBalances) {
        if (balance.balance > 0 || balance.locked_balance > 0) {
          await supabase
            .from('portfolios')
            .upsert({
              user_id: userId,
              symbol: balance.symbol,
              balance: balance.balance,
              locked_balance: balance.locked_balance,
              exchange: balance.exchange, // Preservar informação da exchange
              price_usd: balance.price_usd,
              value_usd: balance.value_usd,
              updated_at: new Date().toISOString()
            });
        }
      }
    }

    // Buscar portfolio atualizado
    let portfolio: any[] = [];
    
    if (realMode && realBalances.length > 0) {
      // Se modo real e temos dados das APIs, usar os dados reais diretos
      portfolio = realBalances;
      console.log(`Usando dados reais diretos: ${realBalances.length} ativos`);
    } else {
      // Caso contrário, buscar dados locais (simulados ou cache)
      const { data: localPortfolio, error: portfolioError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', userId)
        .order('symbol');

      if (portfolioError) {
        throw new Error(`Erro ao buscar portfolio: ${portfolioError.message}`);
      }
      
      // Adicionar preços aos dados locais se disponíveis
      portfolio = (localPortfolio || []).map((asset: any) => ({
        ...asset,
        price_usd: tokenPrices[asset.symbol] || asset.price_usd || 0,
        value_usd: tokenPrices[asset.symbol] || asset.value_usd || 0
      }));
      console.log(`Usando dados locais: ${portfolio.length} ativos`);
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
      const assetValue = (asset.price_usd || asset.value_usd || 0) * (parseFloat(asset.balance) + parseFloat(asset.locked_balance || 0));
      return sum + assetValue;
    }, 0) || 0;
    
    const totalTrades = trades?.length || 0;
    const successfulTrades = trades?.filter(t => t.status === 'completed').length || 0;
    const totalProfit = trades?.reduce((sum, t) => sum + (parseFloat(t.net_profit) || 0), 0) || 0;
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;

    console.log(`Portfolio stats - Value: ${totalValue}, Trades: ${totalTrades}, Success: ${successRate.toFixed(1)}%, Source: ${dataSource}`);

    return new Response(JSON.stringify({
      success: true,
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
        real_mode_active: realMode
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