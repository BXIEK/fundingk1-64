import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteCrossExchangeRequest {
  opportunityId: string;
  userId: string;
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  mode: 'simulation' | 'real';
  config?: {
    investmentAmount?: number; // Opcional - usa saldo disponível se não fornecido
    maxSlippage: number;
    customFeeRate: number;
    stopLossPercentage: number;
    prioritizeSpeed: boolean;
    selectedNetwork?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      opportunityId, 
      userId, 
      symbol,
      buyExchange,
      sellExchange,
      buyPrice,
      sellPrice,
      mode = 'simulation',
      config = {
        maxSlippage: 0.3,
        customFeeRate: 0.2, // 0.2% para cross-exchange
        stopLossPercentage: 2.0,
        prioritizeSpeed: true
      }
    }: ExecuteCrossExchangeRequest = await req.json();

    console.log(`🚀 ARBITRAGEM CROSS-EXCHANGE [AUTO-SALDO]: ${buyExchange} -> ${sellExchange} | ${symbol}, Modo: ${mode}`);
    console.log(`💰 Taxas: Trading=${(config.customFeeRate)}%, Transfer=$0.10 (Arbitrum), Slippage=${config.maxSlippage}%`);
    console.log(`📊 Sistema usará saldos disponíveis automaticamente (sem limites mínimos fixos)`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ⭐ BUSCAR CREDENCIAIS DA TABELA exchange_api_configs
    console.log(`🔍 Buscando credenciais do usuário ${userId} na tabela exchange_api_configs...`);
    
    const { data: credentials, error: credError } = await supabase
      .from('exchange_api_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (credError) {
      console.error('❌ Erro ao buscar credenciais:', credError);
      throw new Error('Erro ao buscar credenciais das APIs');
    }

    if (!credentials || credentials.length === 0) {
      throw new Error('❌ Nenhuma credencial de API configurada. Configure em Controle de Arbitragem > Configuração de APIs.');
    }

    const binanceCred = credentials.find(c => c.exchange === 'binance');
    const okxCred = credentials.find(c => c.exchange === 'okx');

    const finalBinanceApiKey = binanceCred?.api_key;
    const finalBinanceSecretKey = binanceCred?.secret_key;
    const finalOkxApiKey = okxCred?.api_key;
    const finalOkxSecretKey = okxCred?.secret_key;
    const finalOkxPassphrase = okxCred?.passphrase;

    console.log('🔐 Credenciais carregadas da tabela:', {
      binance: !!finalBinanceApiKey,
      okx: !!finalOkxApiKey
    });

    // ⭐ REBALANCEAMENTO AUTOMÁTICO DESABILITADO
    // O sistema agora usa apenas os saldos já disponíveis em cada exchange
    if (mode === 'real') {
      console.log('ℹ️ Rebalanceamento automático desabilitado. Usando saldos disponíveis em cada exchange.');
    }

    // ⭐ BUSCAR SALDO DISPONÍVEL AUTOMATICAMENTE
    let usdtInvestment = 0;
    
    if (mode === 'real') {
      console.log(`🔍 Buscando saldo disponível de ${symbol} e USDT na ${buyExchange}...`);
      try {
        // Verificar saldo de crypto primeiro
        const cryptoBalance = await getExchangeBalance(buyExchange, symbol.replace('USDT', ''), { 
          binanceApiKey: finalBinanceApiKey, 
          binanceSecretKey: finalBinanceSecretKey, 
          okxApiKey: finalOkxApiKey, 
          okxSecretKey: finalOkxSecretKey, 
          okxPassphrase: finalOkxPassphrase 
        });
        
        console.log(`💰 Saldo de ${symbol}: ${cryptoBalance}`);
        
        // Se houver saldo de crypto, usar ele
        if (cryptoBalance > 0) {
          usdtInvestment = cryptoBalance * buyPrice;
          console.log(`✅ Usando saldo existente: ${cryptoBalance} ${symbol} = $${usdtInvestment.toFixed(2)} USDT`);
        } else {
          // Senão, verificar saldo de USDT
          const usdtBalance = await getExchangeBalance(buyExchange, 'USDT', { 
            binanceApiKey: finalBinanceApiKey, 
            binanceSecretKey: finalBinanceSecretKey, 
            okxApiKey: finalOkxApiKey, 
            okxSecretKey: finalOkxSecretKey, 
            okxPassphrase: finalOkxPassphrase 
          });
          
          console.log(`💰 Saldo de USDT: $${usdtBalance.toFixed(2)}`);
          
          if (usdtBalance <= 0) {
            const errorMsg = `❌ Sem saldo disponível na ${buyExchange}. Deposite USDT ou ${symbol} para continuar.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }
          
          // Usar 95% do saldo USDT disponível
          usdtInvestment = usdtBalance * 0.95;
          console.log(`✅ Usando 95% do saldo USDT: $${usdtInvestment.toFixed(2)}`);
        }
      } catch (balanceError) {
        console.error('❌ Erro ao buscar saldos:', balanceError);
        throw balanceError;
      }
    } else {
      // Modo simulação - usar valor padrão
      usdtInvestment = 50;
      console.log(`🎮 Modo simulação: usando $${usdtInvestment} USDT`);
    }
    // Calcular spread real entre as exchanges
    const spread_percentage = Math.abs((sellPrice - buyPrice) / buyPrice * 100);
    
    // Calcular métricas da operação com USDT
    // Spread ajustado por slippage (reduz o spread esperado, mas não é um custo fixo)
    const effectiveSpread = Math.max(0, spread_percentage - config.maxSlippage);
    const gross_profit = (usdtInvestment * effectiveSpread) / 100;
    const trading_fees = usdtInvestment * (config.customFeeRate / 100);
    const transfer_fees = 0.10; // Taxa fixa Arbitrum: $0.10 USDT
    const total_fees = trading_fees + transfer_fees;
    let net_profit = Math.max(0, gross_profit - total_fees);
    const roi_percentage = usdtInvestment > 0 ? (net_profit / usdtInvestment) * 100 : 0;

    // Executar sempre, independentemente da lucratividade (validação já feita no frontend)
    let status = 'completed';
    let error_message = null;
    
    // Simular algumas falhas ocasionais (2% de chance se lucrativo)
    if (status === 'completed' && Math.random() < 0.02) {
      status = 'failed';
      error_message = 'Condições de liquidez mudaram durante execução';
    }

    // Simular tempo de execução
    const execution_start = Date.now();
    const base_execution_time = config.prioritizeSpeed ? 1500 : 2000;
    const simulated_execution_time = base_execution_time + Math.floor(Math.random() * 1000);
    
    await new Promise(resolve => setTimeout(resolve, simulated_execution_time));
    
    const execution_end = Date.now();
    const actual_execution_time = execution_end - execution_start;

    const transaction_id = `CROSS_USDT_${symbol.replace('/', '')}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // ⭐ EXECUÇÃO REAL COM PADRÃO USDT
    let realOperationResults: any = null;
    
    if (mode === 'real' && status === 'completed') {
      try {
        console.log('💰 EXECUTANDO OPERAÇÃO REAL COM PADRÃO USDT...');
        console.log(`📊 Credenciais: Binance=${!!finalBinanceApiKey}, OKX=${!!finalOkxApiKey}`);
        
        // Validar credenciais necessárias
        const needsBinance = buyExchange === 'Binance' || sellExchange === 'Binance';
        const needsOKX = buyExchange === 'OKX' || sellExchange === 'OKX';
        
        if (needsBinance && (!finalBinanceApiKey || !finalBinanceSecretKey)) {
          throw new Error('❌ Credenciais da Binance não configuradas. Configure em Supabase Secrets.');
        }
        if (needsOKX && (!finalOkxApiKey || !finalOkxSecretKey || !finalOkxPassphrase)) {
          throw new Error('❌ Credenciais da OKX não configuradas. Configure em Supabase Secrets.');
        }
        
        // Usar o saldo já calculado anteriormente
        const actualUsdtInvestment = usdtInvestment;
        const finalUsdtInvestment = actualUsdtInvestment;
        
        console.log(`📊 VALOR DE OPERAÇÃO:`);
        console.log(`   Token: ${symbol}`);
        console.log(`   Valor a usar: $${actualUsdtInvestment.toFixed(2)} USDT`);
        console.log(`   Quantidade a operar: ${(actualUsdtInvestment / buyPrice).toFixed(6)} ${symbol.replace('USDT', '')}`);
        
        // Calcular quantidade de crypto que será comprada
        const targetCryptoAmount = finalUsdtInvestment / buyPrice;
        
        // Step 1: Verificar saldo disponível de crypto na exchange de origem
        let cryptoAmount = 0;
        let usedExistingBalance = false;
        
        try {
          console.log(`🔍 Verificando saldo de ${symbol.replace('USDT', '')} na ${buyExchange}...`);
          const availableBalance = await getExchangeBalance(buyExchange, symbol.replace('USDT', ''), { 
            binanceApiKey: finalBinanceApiKey, 
            binanceSecretKey: finalBinanceSecretKey, 
            okxApiKey: finalOkxApiKey, 
            okxSecretKey: finalOkxSecretKey, 
            okxPassphrase: finalOkxPassphrase 
          });
          console.log(`💰 Saldo disponível: ${availableBalance} ${symbol.replace('USDT', '')}`);
          
          // Se houver saldo de crypto, usar ele
          if (availableBalance >= targetCryptoAmount) {
            console.log(`✅ Saldo suficiente! Usando ${targetCryptoAmount.toFixed(6)} ${symbol.replace('USDT', '')} do saldo existente.`);
            cryptoAmount = targetCryptoAmount;
            usedExistingBalance = true;
          } else if (availableBalance > 0) {
            console.log(`⚠️ Saldo parcial: ${availableBalance} ${symbol.replace('USDT', '')}. Usando saldo disponível.`);
            cryptoAmount = availableBalance;
            usedExistingBalance = true;
          } else {
            console.log(`📉 Sem saldo de ${symbol.replace('USDT', '')}. Executando compra com USDT...`);
          }
        } catch (balanceError) {
          console.error('⚠️ Erro ao verificar saldo:', balanceError);
          console.log('Continuando com compra normal...');
        }
        
        // Step 1B: Executar compra apenas se não houver saldo disponível
        let buyResult: any = null;
        if (!usedExistingBalance) {
          console.log(`🔄 PASSO 1 - COMPRA: $${finalUsdtInvestment.toFixed(2)} USDT → ${symbol} na ${buyExchange}...`);
          buyResult = await executeBuyOrderUSDT(buyExchange, symbol, finalUsdtInvestment, buyPrice, { 
            binanceApiKey: finalBinanceApiKey, 
            binanceSecretKey: finalBinanceSecretKey, 
            okxApiKey: finalOkxApiKey, 
            okxSecretKey: finalOkxSecretKey, 
            okxPassphrase: finalOkxPassphrase 
          });
          console.log('✅ Compra executada:', JSON.stringify(buyResult));
          
          // Extrair quantidade de crypto comprada
          cryptoAmount = buyResult.executedQty || (finalUsdtInvestment / buyPrice);
          console.log(`💎 Quantidade comprada: ${cryptoAmount} ${symbol.replace('USDT', '')}`);
          
          // Aguardar o saldo aparecer (verificando Trading E Funding)
          if (buyExchange === 'OKX') {
            console.log('⏳ Aguardando saldo aparecer na OKX (Trading ou Funding)...');
            const maxAttempts = 10; // 10 tentativas = 30 segundos
            let balanceFound = false;
            let foundInFunding = false;
            
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              await new Promise(resolve => setTimeout(resolve, 3000)); // 3s entre tentativas
              
              try {
                const balanceInfo = await getOKXTotalBalance(symbol.replace('USDT', ''), { 
                  okxApiKey: finalOkxApiKey, 
                  okxSecretKey: finalOkxSecretKey, 
                  okxPassphrase: finalOkxPassphrase 
                });
                
                console.log(`   Tentativa ${attempt}/${maxAttempts}:`);
                console.log(`      Trading: ${balanceInfo.trading} ${symbol.replace('USDT', '')}`);
                console.log(`      Funding: ${balanceInfo.funding} ${symbol.replace('USDT', '')}`);
                console.log(`      Total: ${balanceInfo.total} ${symbol.replace('USDT', '')} (${balanceInfo.location})`);
                
                if (balanceInfo.total >= cryptoAmount * 0.95) { // Aceitar 95% da quantidade (tolerância para taxas)
                  console.log(`✅ Saldo confirmado: ${balanceInfo.total} ${symbol.replace('USDT', '')} em ${balanceInfo.location}`);
                  cryptoAmount = balanceInfo.total; // Usar o saldo real confirmado
                  foundInFunding = balanceInfo.location === 'funding' || balanceInfo.location === 'both';
                  balanceFound = true;
                  
                  // Se o saldo está na Funding, informar que não precisa transferência interna
                  if (foundInFunding && balanceInfo.location === 'funding') {
                    console.log('🎯 Saldo já está na Funding Account - transferência interna será PULADA');
                  }
                  break;
                }
              } catch (checkError) {
                console.warn(`⚠️ Erro ao verificar saldo (tentativa ${attempt}):`, checkError);
              }
            }
            
            if (!balanceFound) {
              throw new Error(
                `❌ TIMEOUT: Saldo de ${symbol.replace('USDT', '')} não apareceu em nenhuma conta da OKX após ${maxAttempts * 3}s. ` +
                `Possíveis causas:\n` +
                `• Ordem não foi executada pela OKX\n` +
                `• Liquidez insuficiente no par ${symbol}\n` +
                `• Verifique manualmente o status da ordem na OKX`
              );
            }
          } else {
            // Para Binance, aguardar apenas 3s como antes
            console.log('⏳ Aguardando processamento da ordem (3s)...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } else {
          console.log(`⚡ PULANDO COMPRA - Usando ${cryptoAmount.toFixed(6)} ${symbol.replace('USDT', '')} do saldo existente`);
          // Criar um buyResult simulado
          buyResult = {
            success: true,
            orderId: 'EXISTING_BALANCE',
            symbol: symbol,
            side: 'BUY',
            executedQty: cryptoAmount,
            executedUsdtValue: cryptoAmount * buyPrice,
            price: buyPrice,
            timestamp: Date.now(),
            operationMode: 'EXISTING_BALANCE'
          };
        }
        
        // Step 2: TRANSFERIR crypto da exchange de compra para exchange de venda
        console.log(`🔄 PASSO 2 - TRANSFERÊNCIA: ${cryptoAmount} ${symbol} da ${buyExchange} → ${sellExchange}...`);
        
        const transferResponse = await fetch(`${supabaseUrl}/functions/v1/smart-cross-exchange-transfer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            fromExchange: buyExchange,
            toExchange: sellExchange,
            asset: symbol.replace('USDT', ''), // Remove USDT do símbolo (ex: DOTUSDT → DOT)
            amount: cryptoAmount,
            networkOverride: config.selectedNetwork, // Rede selecionada pelo usuário
            binanceApiKey: finalBinanceApiKey,
            binanceSecretKey: finalBinanceSecretKey,
            okxApiKey: finalOkxApiKey,
            okxSecretKey: finalOkxSecretKey,
            okxPassphrase: finalOkxPassphrase
          })
        });
        
        if (!transferResponse.ok) {
          const error = await transferResponse.text();
          throw new Error(`Falha na transferência de ${symbol}: ${error}`);
        }
        
        const transferResult = await transferResponse.json();
        if (!transferResult.success) {
          throw new Error(`Transferência de ${symbol} falhou: ${transferResult.error}`);
        }
        
        console.log('✅ Transferência de crypto concluída:', transferResult);
        
        // Aguardar confirmação da transferência (pode levar alguns minutos)
        console.log('⏳ Aguardando confirmação da transferência na blockchain...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos de buffer
        
        // Step 3: Executar venda na exchange de venda (Crypto → USDT)
        console.log(`🔄 PASSO 3 - VENDA: ${cryptoAmount} ${symbol} → USDT na ${sellExchange}...`);
        const sellResult = await executeSellOrderUSDT(sellExchange, symbol, finalUsdtInvestment, sellPrice, { 
          binanceApiKey: finalBinanceApiKey, 
          binanceSecretKey: finalBinanceSecretKey, 
          okxApiKey: finalOkxApiKey, 
          okxSecretKey: finalOkxSecretKey, 
          okxPassphrase: finalOkxPassphrase 
        });
        console.log('✅ Venda executada:', JSON.stringify(sellResult));
        
        realOperationResults = {
          buyOrder: buyResult,
          sellOrder: sellResult,
          realExecutionTime: actual_execution_time,
          usdtOperationMode: true,
          totalUsdtUsed: actualUsdtInvestment,
          usdtPerOperation: finalUsdtInvestment
        };
        
        console.log('🎉 OPERAÇÃO REAL CONCLUÍDA COM SUCESSO!');
        
      } catch (realError) {
        console.error('❌ ERRO NA EXECUÇÃO REAL:', realError);
        console.error('Stack:', realError instanceof Error ? realError.stack : 'N/A');
        
        status = 'failed';
        const errorMessage = realError instanceof Error ? realError.message : String(realError);
        
        // Identificar tipo de erro
        if (errorMessage.includes('IP') && errorMessage.includes('whitelist')) {
          error_message = `Erro OKX: ${errorMessage}. Configure seu IP na whitelist: https://www.okx.com/account/my-api`;
        } else if (errorMessage.includes('Sem saldo disponível')) {
          error_message = `Saldo insuficiente: ${errorMessage}`;
        } else {
          error_message = `Falha na execução real: ${errorMessage}`;
        }
        net_profit = 0;
      }
    }

    // Registrar a operação no banco
    const tradeRecord = {
      user_id: userId,
      symbol: symbol,
      buy_exchange: buyExchange,
      sell_exchange: sellExchange,
      buy_price: buyPrice,
      sell_price: sellPrice,
      quantity: usdtInvestment / buyPrice, // Quantidade equivalente em crypto
      investment_amount: usdtInvestment, // Valor em USDT
      gross_profit: status === 'completed' ? gross_profit : 0,
      gas_fees: 0.10, // Taxa fixa Arbitrum
      slippage_cost: trading_fees,
      net_profit: status === 'completed' ? net_profit : 0,
      roi_percentage: status === 'completed' ? roi_percentage : 0,
      spread_percentage: spread_percentage,
      execution_time_ms: actual_execution_time,
      risk_level: spread_percentage > 2.0 ? 'HIGH' : spread_percentage > 1.0 ? 'MEDIUM' : 'LOW',
      status: status,
      pionex_order_id: transaction_id,
      error_message: error_message,
      executed_at: new Date().toISOString(),
      trading_mode: mode
    };

    const { error: insertError } = await supabase
      .from('arbitrage_trades')
      .insert(tradeRecord);

    if (insertError) {
      console.error('❌ Erro ao salvar trade:', insertError);
    } else {
      console.log('💾 Trade cross-exchange USDT registrado com sucesso');
    }

    // Marcar oportunidade como executada
    if (opportunityId && opportunityId !== 'manual') {
      await supabase
        .from('realtime_arbitrage_opportunities')
        .update({ is_active: false })
        .eq('id', opportunityId);
    }

    // Resposta de sucesso
    const response = {
      success: status === 'completed',
      transaction_id: transaction_id,
      mode: mode,
      isSimulation: mode === 'simulation',
      netProfit: parseFloat(net_profit.toFixed(6)),
      roiPercentage: parseFloat(roi_percentage.toFixed(4)),
      errorMessage: error_message,
      usdtOperationMode: true, // ⭐ NOVA FLAG
      buyOrderId: realOperationResults?.buyOrder?.orderId || `${buyExchange}_${Date.now()}`,
      sellOrderId: realOperationResults?.sellOrder?.orderId || `${sellExchange}_${Date.now()}`,
      execution_details: {
        symbol: symbol,
        buy_exchange: buyExchange,
        sell_exchange: sellExchange,
        usdt_investment: usdtInvestment, // ⭐ NOVO: Valor em USDT
        buy_price: buyPrice,
        sell_price: sellPrice,
        spread_percentage: parseFloat(spread_percentage.toFixed(4)),
        gross_profit: parseFloat(gross_profit.toFixed(6)),
        trading_fees: parseFloat(trading_fees.toFixed(6)),
        arbitrum_transfer_fee: 0.10,
        total_fees: parseFloat(total_fees.toFixed(6)),
        net_profit: parseFloat(net_profit.toFixed(6)),
        roi_percentage: parseFloat(roi_percentage.toFixed(4)),
        execution_time_ms: actual_execution_time,
        status: status,
        error_message: error_message,
        mode: mode,
        cost_percentage: parseFloat(((total_fees / usdtInvestment) * 100).toFixed(3)),
        real_operation: realOperationResults,
        operation_standard: 'USDT_ONLY' // ⭐ NOVO PADRÃO
      },
      strategy: 'cross_exchange_arbitrage_usdt',
      description: `Arbitragem cross-exchange USDT entre ${buyExchange} e ${sellExchange} executada com ${status === 'completed' ? 'sucesso' : 'falha'}`,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Arbitragem cross-exchange USDT ${status}: ${buyExchange} -> ${sellExchange} | ${symbol}, Lucro: $${net_profit.toFixed(2)} USDT`);

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Erro na execução de arbitragem cross-exchange USDT:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        strategy: 'cross_exchange_arbitrage_usdt'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ⭐ FUNÇÕES DE EXECUÇÃO COM PADRÃO USDT

// Executar ordem de compra na exchange (PADRÃO USDT)
async function executeBuyOrderUSDT(exchange: string, symbol: string, usdtAmount: number, price: number, credentials?: { binanceApiKey?: string; binanceSecretKey?: string; okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }) {
  console.log(`💰 COMPRA USDT: $${usdtAmount} USDT → ${symbol} na ${exchange} (preço: $${price})`);
  
  if (exchange === 'Binance') {
    return await executeBinanceOrderUSDT(symbol, 'BUY', usdtAmount, price, credentials?.binanceApiKey, credentials?.binanceSecretKey);
  } else if (exchange === 'OKX') {
    return await executeOKXOrderUSDT(symbol, 'BUY', usdtAmount, price, { okxApiKey: credentials?.okxApiKey, okxSecretKey: credentials?.okxSecretKey, okxPassphrase: credentials?.okxPassphrase });
  } else {
    throw new Error(`Exchange não suportada: ${exchange}`);
  }
}

// Executar ordem de venda na exchange (PADRÃO USDT)
async function executeSellOrderUSDT(exchange: string, symbol: string, usdtAmount: number, price: number, credentials?: { binanceApiKey?: string; binanceSecretKey?: string; okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }) {
  console.log(`💰 VENDA USDT: ${symbol} → $${usdtAmount} USDT na ${exchange} (preço: $${price})`);
  
  if (exchange === 'Binance') {
    return await executeBinanceOrderUSDT(symbol, 'SELL', usdtAmount, price, credentials?.binanceApiKey, credentials?.binanceSecretKey);
  } else if (exchange === 'OKX') {
    return await executeOKXOrderUSDT(symbol, 'SELL', usdtAmount, price, { okxApiKey: credentials?.okxApiKey, okxSecretKey: credentials?.okxSecretKey, okxPassphrase: credentials?.okxPassphrase });
  } else {
    throw new Error(`Exchange não suportada: ${exchange}`);
  }
}

// ⭐ NOVA FUNÇÃO: Executar ordens Binance baseadas em USDT
async function executeBinanceOrderUSDT(
  symbol: string,
  side: 'BUY' | 'SELL', 
  usdtAmount: number,
  currentPrice: number,
  apiKey?: string,
  secretKey?: string
) {
  console.log(`🚀 ORDEM BINANCE USDT: ${side} $${usdtAmount} USDT de ${symbol} (preço: $${currentPrice})`);
  
  if (!apiKey || !secretKey) {
    throw new Error('API keys da Binance são obrigatórias para execução real');
  }
  
  try {
    // Calcular quantidade de crypto baseada no USDT
    let quantity: number;
    
    if (side === 'BUY') {
      quantity = usdtAmount / currentPrice;
      console.log(`💵 COMPRA: $${usdtAmount} USDT → ${quantity} ${symbol}`);
    } else {
      quantity = usdtAmount / currentPrice;
      console.log(`💵 VENDA: ${quantity} ${symbol} → $${usdtAmount} USDT`);
    }
    
    // Obter informações do símbolo para ajustar precisão
    const symbolInfo = await getBinanceSymbolInfo(symbol);
    
    // Arredondar quantidade baseada no stepSize
    const adjustedQuantity = roundToStepSize(quantity, symbolInfo.stepSize);
    
    // Verificar limites
    if (adjustedQuantity < symbolInfo.minQty) {
      throw new Error(`Quantidade muito pequena: ${adjustedQuantity} < ${symbolInfo.minQty}`);
    }
    
    // Preparar ordem
    const timestamp = Date.now();
    const queryString = `symbol=${symbol}USDT&side=${side}&type=MARKET&quantity=${adjustedQuantity}&timestamp=${timestamp}`;
    
    // Gerar assinatura
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
    
    console.log(`📡 Enviando ordem USDT para Binance: ${side} ${adjustedQuantity} ${symbol}USDT`);
    
    // Executar ordem
    const response = await fetch(
      `https://api.binance.com/api/v3/order?${queryString}&signature=${signatureHex}`,
      {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Erro Binance: ${errorData}`);
    }
    
    const responseData = await response.json();
    console.log(`✅ Ordem USDT Binance executada:`, responseData);
    
    return {
      success: true,
      orderId: responseData.orderId,
      symbol: symbol,
      side: side,
      executedQty: responseData.executedQty,
      executedUsdtValue: parseFloat(responseData.executedQty) * currentPrice,
      price: currentPrice,
      usdtAmount: usdtAmount,
      commission: responseData.fills?.reduce((sum: number, fill: any) => sum + parseFloat(fill.commission || 0), 0) || 0,
      timestamp: Date.now(),
      operationMode: 'USDT_BASED'
    };
    
  } catch (error) {
    console.error(`❌ Erro na ordem USDT Binance:`, error);
    throw error;
  }
}

// ⭐ NOVA FUNÇÃO: Executar ordens OKX baseadas em USDT
async function executeOKXOrderUSDT(
  symbol: string,
  side: 'BUY' | 'SELL',
  usdtAmount: number,
  currentPrice: number,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
) {
  console.log(`🚀 ORDEM OKX USDT: ${side} $${usdtAmount} USDT de ${symbol}`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    // Calcular quantidade baseada no USDT
    const cryptoQuantity = usdtAmount / currentPrice;
    console.log(`💵 OKX: ${side} ${cryptoQuantity} ${symbol} (valor: $${usdtAmount} USDT)`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/okx-api`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        action: 'place_order',
        symbol: symbol,
        side: side.toLowerCase(),
        type: 'market',
        quantity: cryptoQuantity,
        api_key: credentials.okxApiKey,
        secret_key: credentials.okxSecretKey,
        passphrase: credentials.okxPassphrase
      })
    });
    
    if (!response.ok) {
      throw new Error(`OKX order failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    return {
      success: true,
      orderId: result.orderId || `OKX_USDT_${Date.now()}`,
      executedQty: cryptoQuantity,
      executedUsdtValue: usdtAmount,
      price: currentPrice,
      side: side,
      symbol: symbol,
      timestamp: Date.now(),
      operationMode: 'USDT_BASED'
    };
    
  } catch (error) {
    console.error(`❌ Erro na ordem OKX USDT:`, error);
    throw error;
  }
}

// Funções auxiliares para USDT
async function getBinanceSymbolInfo(symbol: string) {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}USDT`);
    const data = await response.json();
    
    if (!data.symbols || data.symbols.length === 0) {
      throw new Error(`Símbolo ${symbol}USDT não encontrado`);
    }
    
    const symbolInfo = data.symbols[0];
    const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
    
    return {
      stepSize: parseFloat(lotSizeFilter.stepSize),
      minQty: parseFloat(lotSizeFilter.minQty),
      maxQty: parseFloat(lotSizeFilter.maxQty)
    };
  } catch (error) {
    const precisionMap: Record<string, any> = {
      'BTC': { stepSize: 0.00001, minQty: 0.00001, maxQty: 9000 },
      'ETH': { stepSize: 0.0001, minQty: 0.0001, maxQty: 100000 },
      'SOL': { stepSize: 0.001, minQty: 0.001, maxQty: 10000000 }
    };
    return precisionMap[symbol] || { stepSize: 0.001, minQty: 0.001, maxQty: 10000000 };
  }
}

function roundToStepSize(quantity: number, stepSize: number): number {
  const precision = Math.max(0, Math.ceil(Math.log10(1 / stepSize)));
  const rounded = Math.floor(quantity / stepSize) * stepSize;
  return parseFloat(rounded.toFixed(precision));
}

// Função para verificar saldos nas exchanges
async function checkExchangeBalances(
  buyExchange: string,
  sellExchange: string,
  credentials: {
    binanceApiKey?: string;
    binanceSecretKey?: string;
    okxApiKey?: string;
    okxSecretKey?: string;
    okxPassphrase?: string;
  }
): Promise<{ buy: number; sell: number }> {
  const balances = { buy: 0, sell: 0 };
  
  // Verificar saldo na exchange de compra
  if (buyExchange === 'Binance') {
    balances.buy = await getBinanceUSDTBalance(credentials.binanceApiKey!, credentials.binanceSecretKey!);
  } else if (buyExchange === 'OKX') {
    balances.buy = await getOKXUSDTBalance({ okxApiKey: credentials.okxApiKey, okxSecretKey: credentials.okxSecretKey, okxPassphrase: credentials.okxPassphrase });
  }
  
  // Verificar saldo na exchange de venda
  if (sellExchange === 'Binance') {
    balances.sell = await getBinanceUSDTBalance(credentials.binanceApiKey!, credentials.binanceSecretKey!);
  } else if (sellExchange === 'OKX') {
    balances.sell = await getOKXUSDTBalance({ okxApiKey: credentials.okxApiKey, okxSecretKey: credentials.okxSecretKey, okxPassphrase: credentials.okxPassphrase });
  }
  
  return balances;
}

async function getBinanceUSDTBalance(apiKey: string, secretKey: string): Promise<number> {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  
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
  
  const response = await fetch(
    `https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`,
    {
      headers: {
        'X-MBX-APIKEY': apiKey,
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Erro ao obter saldo Binance');
  }
  
  const data = await response.json();
  const usdtBalance = data.balances.find((b: any) => b.asset === 'USDT');
  return usdtBalance ? parseFloat(usdtBalance.free) : 0;
}

async function getBinanceCryptoBalance(asset: string, apiKey: string, secretKey: string): Promise<number> {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  
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
  
  const response = await fetch(
    `https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`,
    {
      headers: {
        'X-MBX-APIKEY': apiKey,
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Erro ao obter saldo Binance');
  }
  
  const data = await response.json();
  const cryptoBalance = data.balances.find((b: any) => b.asset === asset);
  return cryptoBalance ? parseFloat(cryptoBalance.free) : 0;
}

async function getOKXUSDTBalance(
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
): Promise<number> {
  const timestamp = new Date().toISOString();
  const method = 'GET';
  const requestPath = '/api/v5/account/balance';
  
  const prehash = timestamp + method + requestPath;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(credentials.okxSecretKey!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': credentials.okxApiKey!,
      'OK-ACCESS-SIGN': signatureBase64,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase!,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Erro ao obter saldo OKX');
  }
  
  const data = await response.json();
  const usdtBalance = data.data[0].details.find((d: any) => d.ccy === 'USDT');
  return usdtBalance ? parseFloat(usdtBalance.availBal) : 0;
}

async function getOKXCryptoBalance(
  asset: string,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
): Promise<number> {
  const timestamp = new Date().toISOString();
  const method = 'GET';
  const requestPath = '/api/v5/account/balance';
  
  const prehash = timestamp + method + requestPath;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(credentials.okxSecretKey!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': credentials.okxApiKey!,
      'OK-ACCESS-SIGN': signatureBase64,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase!,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Erro ao obter saldo OKX Trading Account');
  }
  
  const data = await response.json();
  const cryptoBalance = data.data[0].details.find((d: any) => d.ccy === asset);
  return cryptoBalance ? parseFloat(cryptoBalance.availBal) : 0;
}

async function getOKXFundingBalance(
  asset: string,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
): Promise<number> {
  const timestamp = new Date().toISOString();
  const method = 'GET';
  const requestPath = '/api/v5/asset/balances';
  
  const prehash = timestamp + method + requestPath;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(credentials.okxSecretKey!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': credentials.okxApiKey!,
      'OK-ACCESS-SIGN': signatureBase64,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': credentials.okxPassphrase!,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Erro ao obter saldo OKX Funding Account');
  }
  
  const data = await response.json();
  const cryptoBalance = data.data?.find((d: any) => d.ccy === asset);
  return cryptoBalance ? parseFloat(cryptoBalance.availBal) : 0;
}

async function getOKXTotalBalance(
  asset: string,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
): Promise<{ trading: number; funding: number; total: number; location: 'trading' | 'funding' | 'both' | 'none' }> {
  const [trading, funding] = await Promise.all([
    getOKXCryptoBalance(asset, credentials),
    getOKXFundingBalance(asset, credentials)
  ]);
  
  let location: 'trading' | 'funding' | 'both' | 'none' = 'none';
  if (trading > 0 && funding > 0) location = 'both';
  else if (trading > 0) location = 'trading';
  else if (funding > 0) location = 'funding';
  
  return { trading, funding, total: trading + funding, location };
}

async function getExchangeBalance(
  exchange: string,
  asset: string,
  credentials: {
    binanceApiKey?: string;
    binanceSecretKey?: string;
    okxApiKey?: string;
    okxSecretKey?: string;
    okxPassphrase?: string;
  }
): Promise<number> {
  if (exchange === 'Binance') {
    return await getBinanceCryptoBalance(asset, credentials.binanceApiKey!, credentials.binanceSecretKey!);
  } else if (exchange === 'OKX') {
    return await getOKXCryptoBalance(asset, { okxApiKey: credentials.okxApiKey, okxSecretKey: credentials.okxSecretKey, okxPassphrase: credentials.okxPassphrase });
  } else {
    throw new Error(`Exchange não suportada: ${exchange}`);
  }
}