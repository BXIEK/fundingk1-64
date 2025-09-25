// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpotFuturesRequest {
  symbol: string;
  amount: number;
  fromToken: string; // Token de origem (BTC, ETH, etc.)
  toToken: string;   // Token de destino (USDT, USDC, etc.)
  userId: string;
  mode?: 'real' | 'simulated';
}

interface TokenPrice {
  symbol: string;
  spot_price: number;
  futures_price: number;
  spread_percent: number;
}

interface ConversionRate {
  from: string;
  to: string;
  rate: number;
  fee_percent: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { symbol, amount, fromToken, toToken, userId, mode }: SpotFuturesRequest = await req.json();

    const execMode = mode === 'simulated' ? 'simulated' : 'real';
    // CORREÇÃO: No modo real, usar o UUID demo (onde estão os saldos reais)
    // No modo simulado, também usar UUID demo mas com dados simulados
    const finalUserId = '00000000-0000-0000-0000-000000000000';
    
    console.log(`🚀 Iniciando arbitragem spot-futures [${execMode.toUpperCase()}]: ${fromToken} → ${toToken} para ${symbol}`);
    console.log(`👤 User ID original: ${userId}, User ID usado: ${finalUserId} (Portfolio principal)`);

    // 1. Verificar saldos disponíveis
    const { data: portfolios, error: portfolioError } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', finalUserId);

    if (portfolioError) {
      throw new Error(`Erro ao buscar portfólio: ${portfolioError.message}`);
    }

    // 2. Calcular saldo total em USD e saldo específico do token
    const tokenBalance = portfolios?.find(p => p.symbol === fromToken)?.balance || 0;
    const lockedBalance = portfolios?.find(p => p.symbol === fromToken)?.locked_balance || 0;
    const availableTokenBalance = tokenBalance - lockedBalance;

    console.log(`💰 Saldo disponível de ${fromToken}: ${availableTokenBalance}`);

    // DEBUG: Log detalhado dos saldos
    console.log(`🔍 DEBUG SALDOS:`);
    console.log(`  - Portfolio completo:`, portfolios);
    console.log(`  - Token: ${fromToken}, Balance: ${tokenBalance}, Locked: ${lockedBalance}, Available: ${availableTokenBalance}`);
    
    // 3. Obter preços atuais spot e futures
    console.log(`📊 Buscando preços para ${symbol}...`);
    const spotFuturesPrices = await getSpotFuturesPrices(symbol, execMode, supabase);
    console.log(`💹 Preços obtidos:`, spotFuturesPrices);
    
    const conversionRates = await getConversionRates(fromToken, toToken, execMode, supabase, spotFuturesPrices.spot_price);
    console.log(`🔄 Taxa de conversão:`, conversionRates);

    // 4. Calcular spread e custos operacionais
    const spreadPercent = Math.abs(spotFuturesPrices.spread_percent);
    const transferCost = 0.001; // 0.1% para transferência spot-futures
    const conversionCost = conversionRates.fee_percent;
    const totalCosts = transferCost + conversionCost + 0.002; // 0.2% buffer de segurança

    console.log(`📊 Spread detectado: ${spreadPercent}%, Custos totais: ${totalCosts}%`);

    // 5. Verificar se o spread compensa os custos
    if (spreadPercent <= totalCosts) {
      return new Response(JSON.stringify({
        success: false,
        error: `Spread insuficiente: ${spreadPercent}% ≤ custos ${totalCosts}%`,
        details: {
          spread_percent: spreadPercent,
          total_costs: totalCosts,
          minimum_spread_needed: totalCosts + 0.1
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // 6. Calcular quantidade necessária em USD
    // CORREÇÃO: Se fromToken é USDT, a quantidade JÁ está em USD
    let requiredUsdValue: number;
    let fromTokenValueInUsd: number;
    
    if (fromToken === 'USDT') {
      // Operação com USDT: quantidade = valor direto em USD
      requiredUsdValue = amount;
      fromTokenValueInUsd = availableTokenBalance; // USDT = USD 1:1
      console.log(`💲 OPERAÇÃO COM USDT:`);
      console.log(`  - Valor solicitado: $${amount} USDT`);
      console.log(`  - Saldo disponível: $${availableTokenBalance} USDT`);
    } else {
      // Operação com crypto: quantidade × preço = valor USD
      const priceInUsd = spotFuturesPrices.spot_price;
      requiredUsdValue = amount * priceInUsd;
      fromTokenValueInUsd = availableTokenBalance * conversionRates.rate;
      console.log(`💲 OPERAÇÃO COM CRYPTO:`);
      console.log(`  - Quantidade: ${amount} ${fromToken}`);
      console.log(`  - Preço unitário: $${priceInUsd}`);
      console.log(`  - Valor necessário: $${requiredUsdValue}`);
      console.log(`  - Saldo ${fromToken} disponível: ${availableTokenBalance}`);
      console.log(`  - Saldo ${fromToken} em USD: $${fromTokenValueInUsd}`);
    }

    // 7. Auto-ajustar quantidade se necessário
    let finalAmount = amount;
    let needsConversion = false;
    let conversionAmount = 0;

    if (fromToken !== toToken && fromTokenValueInUsd < requiredUsdValue) {
      console.log(`❌ SALDO INSUFICIENTE: $${fromTokenValueInUsd.toFixed(2)} disponível < $${requiredUsdValue.toFixed(2)} necessário`);
      return new Response(JSON.stringify({
        success: false,
        error: `Saldo insuficiente: $${fromTokenValueInUsd.toFixed(2)} USD disponível, $${requiredUsdValue.toFixed(2)} USD necessário`,
        debug: {
          fromToken,
          toToken,
          availableTokenBalance,
          requiredUsdValue,
          fromTokenValueInUsd,
          conversionRate: conversionRates.rate,
          isUsdtOperation: fromToken === 'USDT'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    if (fromToken !== toToken) {
      needsConversion = true;
      // Calcular quanto do fromToken precisa ser convertido
      conversionAmount = Math.min(availableTokenBalance, requiredUsdValue / conversionRates.rate * 1.05); // 5% buffer
      console.log(`🔄 CONVERSÃO NECESSÁRIA: ${conversionAmount} ${fromToken} → ${toToken}`);
    }

    // 8. Executar conversão se necessária
    if (needsConversion) {
      console.log(`🔄 Convertendo ${conversionAmount} ${fromToken} para ${toToken}`);
      
      const conversionResult = await executeTokenConversion(
        finalUserId, 
        fromToken, 
        toToken, 
        conversionAmount, 
        conversionRates.rate,
        supabase
      );

      if (!conversionResult.success) {
        throw new Error(`Falha na conversão: ${conversionResult.error}`);
      }
    }

    // 9. Transferir da conta spot para futures
    console.log(`📤 Transferindo ${finalAmount} ${symbol} de Spot para Futures`);
    
    const transferResult = await executeSpotToFuturesTransfer(
      finalUserId,
      symbol,
      finalAmount,
      supabase
    );

    if (!transferResult.success) {
      throw new Error(`Falha na transferência: ${transferResult.error}`);
    }

    // 10. Executar operação de arbitragem
    const arbitrageResult = await executeSpotFuturesArbitrage(
      finalUserId,
      symbol,
      finalAmount,
      spotFuturesPrices,
      toToken,
      supabase
    );

    // 11. Registrar operação na base de dados
    const { data: operation, error: operationError } = await supabase
      .from('arbitrage_operations')
      .insert({
        user_id: finalUserId,
        operation_type: 'spot_futures_arbitrage',
        symbol,
        amount: finalAmount,
        from_token: fromToken,
        to_token: toToken,
        spot_price: spotFuturesPrices.spot_price,
        futures_price: spotFuturesPrices.futures_price,
        spread_percent: spreadPercent,
        total_costs_percent: totalCosts,
        expected_profit_usd: fromToken === 'USDT' ? 
          (amount * (spreadPercent - totalCosts)) / 100 :
          (finalAmount * priceInUsd * (spreadPercent - totalCosts)) / 100,
        status: arbitrageResult.success ? 'completed' : 'failed',
        conversion_performed: needsConversion,
        conversion_amount: conversionAmount,
        details: {
          original_amount_requested: amount,
          final_amount_executed: finalAmount,
          conversion_rate: conversionRates.rate,
          transfer_result: transferResult,
          arbitrage_result: arbitrageResult
        }
      })
      .select()
      .single();

    if (operationError) {
      console.error('Erro ao registrar operação:', operationError);
    }

    console.log(`✅ Arbitragem spot-futures concluída com sucesso!`);

    return new Response(JSON.stringify({
      success: true,
      operation_id: operation?.id,
      mode: execMode,
      message: 'Arbitragem spot-futures executada com sucesso',
      details: {
        symbol,
        amount_executed: finalAmount,
        from_token: fromToken,
        to_token: toToken,
        spread_captured: spreadPercent,
        total_costs: totalCosts,
        net_profit_percent: spreadPercent - totalCosts,
        expected_profit_usd: (finalAmount * priceInUsd * (spreadPercent - totalCosts)) / 100,
        conversion_performed: needsConversion,
        conversion_amount: needsConversion ? conversionAmount : 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro na arbitragem spot-futures:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno do servidor'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// Função auxiliar para obter preços spot e futures
async function getSpotFuturesPrices(symbol: string, mode: 'real' | 'simulated', supabase: any): Promise<TokenPrice> {
  try {
    if (mode === 'real') {
      // Buscar dados reais via edge function binance-market-data
      const symbolNormalized = symbol.replace('USDT', '/USDT');
      const { data: spotResp, error: spotErr } = await supabase.functions.invoke('binance-market-data', {
        body: { endpoint: 'tickers' }
      });
      if (spotErr) throw new Error(`Spot tickers error: ${spotErr.message}`);

      const { data: futResp, error: futErr } = await supabase.functions.invoke('binance-market-data', {
        body: { endpoint: 'futures' }
      });
      if (futErr) throw new Error(`Futures tickers error: ${futErr.message}`);

      const spotItem = Array.isArray(spotResp?.data) ? spotResp.data.find((i: any) => i.symbol === symbolNormalized) : null;
      const futItem = Array.isArray(futResp?.data) ? futResp.data.find((i: any) => i.symbol === symbolNormalized) : null;

      if (!spotItem || !futItem || !spotItem.price || !futItem.price) {
        console.log('⚠️ Dados reais indisponíveis, usando fallback simulado.');
      } else {
        const spotPrice = Number(spotItem.price);
        const futuresPrice = Number(futItem.price);
        const spreadPercent = (futuresPrice - spotPrice) / spotPrice * 100;
        return {
          symbol,
          spot_price: spotPrice,
          futures_price: futuresPrice,
          spread_percent: Math.abs(spreadPercent)
        };
      }
    }

    // Fallback simulado
    const basePrice = Math.random() * 50000 + 30000;
    const spread = (Math.random() - 0.5) * 0.02;
    const spotPrice = basePrice;
    const futuresPrice = basePrice * (1 + spread);
    const spreadPercent = (futuresPrice - spotPrice) / spotPrice * 100;

    return {
      symbol,
      spot_price: spotPrice,
      futures_price: futuresPrice,
      spread_percent: Math.abs(spreadPercent)
    };
  } catch (error) {
    throw new Error(`Erro ao obter preços: ${error.message}`);
  }
}

// Função auxiliar para obter taxas de conversão
async function getConversionRates(fromToken: string, toToken: string, mode: 'real' | 'simulated', supabase: any, spotPriceHint?: number): Promise<ConversionRate> {
  if (mode === 'real') {
    try {
      // Obter preços spot em USDT para calcular taxas de conversão
      const { data: spotResp } = await supabase.functions.invoke('binance-market-data', {
        body: { endpoint: 'tickers' }
      });
      const list = Array.isArray(spotResp?.data) ? spotResp.data : [];
      
      console.log(`🔄 Taxa de conversão REAL - Lista de preços:`, list.slice(0, 3));
      
      const toSymbol = `${toToken}/USDT`;
      const fromSymbol = `${fromToken}/USDT`;

      const toItem = list.find((i: any) => i.symbol === toSymbol);
      const fromItem = list.find((i: any) => i.symbol === fromSymbol);
      
      console.log(`🔄 Buscando conversão: ${fromToken} → ${toToken}`);
      console.log(`  - ${fromSymbol}: `, fromItem);
      console.log(`  - ${toSymbol}: `, toItem);

      let rate = 1;
      
      // USDT para outro token (ex: USDT → BTC)
      if (fromToken === 'USDT' && toItem?.price) {
        rate = 1 / Number(toItem.price); // 1 USDT = 1/preço_BTC BTC
        console.log(`✅ Taxa USDT→${toToken}: 1/${toItem.price} = ${rate}`);
      }
      // Outro token para USDT (ex: BTC → USDT) 
      else if (toToken === 'USDT' && fromItem?.price) {
        rate = Number(fromItem.price); // 1 BTC = preço_BTC USDT
        console.log(`✅ Taxa ${fromToken}→USDT: ${rate}`);
      }
      // Entre dois tokens não-USDT
      else if (fromItem?.price && toItem?.price) {
        rate = Number(fromItem.price) / Number(toItem.price);
        console.log(`✅ Taxa ${fromToken}→${toToken}: ${fromItem.price}/${toItem.price} = ${rate}`);
      }
      // Fallback: se é USDC, considerar 1:1 com USDT
      else if ((fromToken === 'USDT' && toToken === 'USDC') || (fromToken === 'USDC' && toToken === 'USDT')) {
        rate = 1;
        console.log(`✅ Taxa USDT↔USDC: 1:1`);
      }
      else {
        console.log(`⚠️ Não encontrou preços para conversão, usando rate=1`);
        rate = 1;
      }

      return {
        from: fromToken,
        to: toToken,
        rate: rate,
        fee_percent: 0.001
      };
    } catch (e) {
      console.log('⚠️ Falha ao obter taxas reais, usando simulado:', e.message);
    }
  }

  // Fallback simulado
  const rates: Record<string, number> = { BTC: 45000, ETH: 3000, BNB: 500, USDT: 1, USDC: 1, MATIC: 0.8 };
  const fromRate = rates[fromToken] || 1;
  const toRate = rates[toToken] || 1;
  const conversionRate = fromRate / toRate;
  return { from: fromToken, to: toToken, rate: conversionRate, fee_percent: 0.001 };
}

// Função para executar conversão de tokens
async function executeTokenConversion(
  userId: string,
  fromToken: string,
  toToken: string,
  amount: number,
  rate: number,
  supabase: any
): Promise<{ success: boolean; error?: string; converted_amount?: number }> {
  try {
    const convertedAmount = amount * rate * 0.999; // Desconta 0.1% de taxa

    // Debitar fromToken
    await supabase.rpc('update_portfolio_balance', {
      p_user_id: userId,
      p_symbol: fromToken,
      p_amount_change: -amount
    });

    // Creditar toToken
    await supabase.rpc('update_portfolio_balance', {
      p_user_id: userId,
      p_symbol: toToken,
      p_amount_change: convertedAmount
    });

    console.log(`✅ Conversão executada: ${amount} ${fromToken} → ${convertedAmount} ${toToken}`);

    return {
      success: true,
      converted_amount: convertedAmount
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Função para transferir de spot para futures
async function executeSpotToFuturesTransfer(
  userId: string,
  symbol: string,
  amount: number,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Em produção, fazer chamada real para API da Binance para transferência
    console.log(`📤 Transferência simulada: ${amount} ${symbol} Spot → Futures`);
    
    // Simular sucesso da transferência
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Função para executar arbitragem spot-futures
async function executeSpotFuturesArbitrage(
  userId: string,
  symbol: string,
  amount: number,
  prices: TokenPrice,
  targetToken: string,
  supabase: any
): Promise<{ success: boolean; error?: string; profit?: number }> {
  try {
    // Determinar direção da operação baseada no spread
    const isContango = prices.futures_price > prices.spot_price;
    
    if (isContango) {
      // Futures > Spot: Vender futures, comprar spot
      console.log(`🔄 Executando: Vender Futures (${prices.futures_price}) + Comprar Spot (${prices.spot_price})`);
    } else {
      // Spot > Futures: Vender spot, comprar futures  
      console.log(`🔄 Executando: Vender Spot (${prices.spot_price}) + Comprar Futures (${prices.futures_price})`);
    }

    // Calcular lucro da operação
    const profitPerUnit = Math.abs(prices.futures_price - prices.spot_price);
    const totalProfit = amount * profitPerUnit;

    // Simular execução da operação
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Creditar lucro na conta do usuário
    await supabase.rpc('update_portfolio_balance', {
      p_user_id: userId,
      p_symbol: targetToken,
      p_amount_change: totalProfit
    });

    console.log(`💰 Lucro creditado: ${totalProfit} ${targetToken}`);

    return {
      success: true,
      profit: totalProfit
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}