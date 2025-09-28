import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface USDTOrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  usdtAmount: number;
  currentPrice: number;
  apiKey: string;
  secretKey: string;
}

// ⭐ NOVA FUNÇÃO: Executar ordens Binance baseadas em USDT
async function executeBinanceOrderUSDT(
  symbol: string,
  side: 'BUY' | 'SELL', 
  usdtAmount: number,
  currentPrice: number,
  apiKey: string,
  secretKey: string
) {
  console.log(`🚀 ORDEM BINANCE USDT: ${side} $${usdtAmount} USDT de ${symbol} (preço: $${currentPrice})`);
  
  try {
    // Calcular quantidade de crypto baseada no USDT
    let quantity: number;
    
    if (side === 'BUY') {
      // Para BUY: USDT → Crypto
      quantity = usdtAmount / currentPrice;
      console.log(`💵 COMPRA: $${usdtAmount} USDT → ${quantity} ${symbol}`);
    } else {
      // Para SELL: Crypto → USDT  
      quantity = usdtAmount / currentPrice;
      console.log(`💵 VENDA: ${quantity} ${symbol} → $${usdtAmount} USDT`);
    }
    
    // Obter informações do símbolo para ajustar precisão
    const symbolInfo = await getSymbolInfo(symbol);
    
    // Arredondar quantidade baseada no stepSize
    const adjustedQuantity = roundToStepSize(quantity, symbolInfo.stepSize);
    
    // Verificar limites
    if (adjustedQuantity < symbolInfo.minQty) {
      throw new Error(`Quantidade muito pequena: ${adjustedQuantity} < ${symbolInfo.minQty}`);
    }
    
    if (adjustedQuantity > symbolInfo.maxQty) {
      throw new Error(`Quantidade muito grande: ${adjustedQuantity} > ${symbolInfo.maxQty}`);
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
    console.log(`✅ Ordem USDT executada com sucesso:`, responseData);
    
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

// Funções auxiliares
async function getSymbolInfo(symbol: string) {
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
    // Fallback para valores padrão
    const precisionMap: Record<string, any> = {
      'BTC': { stepSize: 0.00001, minQty: 0.00001, maxQty: 9000 },
      'ETH': { stepSize: 0.0001, minQty: 0.0001, maxQty: 100000 },
      'BNB': { stepSize: 0.001, minQty: 0.001, maxQty: 10000000 },
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, side, usdtAmount, currentPrice, apiKey, secretKey }: USDTOrderRequest = await req.json();
    
    if (!symbol || !side || !usdtAmount || !currentPrice || !apiKey || !secretKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Parâmetros obrigatórios: symbol, side, usdtAmount, currentPrice, apiKey, secretKey'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const result = await executeBinanceOrderUSDT(symbol, side, usdtAmount, currentPrice, apiKey, secretKey);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Erro na edge function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});