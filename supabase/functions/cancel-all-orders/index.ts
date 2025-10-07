import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cancelar todas as ordens abertas na Binance
async function cancelBinanceOrders(apiKey: string, secretKey: string) {
  try {
    console.log('🔍 Buscando ordens abertas na Binance...');
    
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');

    // Buscar ordens abertas
    const openOrdersUrl = `https://api.binance.com/api/v3/openOrders?${queryString}&signature=${signature}`;
    const openOrdersResponse = await fetch(openOrdersUrl, {
      headers: { 'X-MBX-APIKEY': apiKey }
    });

    if (!openOrdersResponse.ok) {
      throw new Error(`Erro ao buscar ordens: ${await openOrdersResponse.text()}`);
    }

    const openOrders = await openOrdersResponse.json();
    console.log(`📊 Encontradas ${openOrders.length} ordens abertas na Binance`);

    if (openOrders.length === 0) {
      return { success: true, canceledOrders: 0, message: 'Nenhuma ordem aberta' };
    }

    // Cancelar cada ordem
    const canceledOrders = [];
    for (const order of openOrders) {
      try {
        const cancelTimestamp = Date.now();
        const cancelQuery = `symbol=${order.symbol}&orderId=${order.orderId}&timestamp=${cancelTimestamp}`;
        const cancelSignature = createHmac('sha256', secretKey)
          .update(cancelQuery)
          .digest('hex');

        const cancelUrl = `https://api.binance.com/api/v3/order?${cancelQuery}&signature=${cancelSignature}`;
        const cancelResponse = await fetch(cancelUrl, {
          method: 'DELETE',
          headers: { 'X-MBX-APIKEY': apiKey }
        });

        if (cancelResponse.ok) {
          const result = await cancelResponse.json();
          canceledOrders.push({
            symbol: order.symbol,
            orderId: order.orderId,
            side: order.side,
            price: order.price,
            quantity: order.origQty
          });
          console.log(`✅ Ordem cancelada: ${order.symbol} #${order.orderId}`);
        } else {
          console.log(`⚠️ Falha ao cancelar ordem ${order.orderId}: ${await cancelResponse.text()}`);
        }
      } catch (error) {
        console.log(`❌ Erro ao cancelar ordem ${order.orderId}:`, error);
      }
    }

    return {
      success: true,
      canceledOrders: canceledOrders.length,
      orders: canceledOrders,
      message: `${canceledOrders.length} ordens canceladas na Binance`
    };
  } catch (error) {
    console.error('❌ Erro ao cancelar ordens Binance:', error);
    throw error;
  }
}

// Cancelar todas as ordens abertas na OKX
async function cancelOKXOrders(apiKey: string, secretKey: string, passphrase: string) {
  try {
    console.log('🔍 Buscando ordens abertas na OKX...');

    const timestamp = new Date().toISOString();
    const method = 'GET';
    const endpoint = '/api/v5/trade/orders-pending';
    const prehash = timestamp + method + endpoint;
    
    const signature = btoa(
      String.fromCharCode(...new Uint8Array(
        await crypto.subtle.sign(
          'HMAC',
          await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(secretKey),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          ),
          new TextEncoder().encode(prehash)
        )
      ))
    );

    // Buscar ordens pendentes
    const openOrdersUrl = `https://www.okx.com${endpoint}`;
    const openOrdersResponse = await fetch(openOrdersUrl, {
      method: 'GET',
      headers: {
        'OK-ACCESS-KEY': apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': passphrase,
        'Content-Type': 'application/json'
      }
    });

    if (!openOrdersResponse.ok) {
      throw new Error(`Erro ao buscar ordens: ${await openOrdersResponse.text()}`);
    }

    const openOrdersData = await openOrdersResponse.json();
    const openOrders = openOrdersData.data || [];
    console.log(`📊 Encontradas ${openOrders.length} ordens abertas na OKX`);

    if (openOrders.length === 0) {
      return { success: true, canceledOrders: 0, message: 'Nenhuma ordem aberta' };
    }

    // Cancelar cada ordem
    const canceledOrders = [];
    for (const order of openOrders) {
      try {
        const cancelTimestamp = new Date().toISOString();
        const cancelMethod = 'POST';
        const cancelEndpoint = '/api/v5/trade/cancel-order';
        const cancelBody = JSON.stringify({
          instId: order.instId,
          ordId: order.ordId
        });
        const cancelPrehash = cancelTimestamp + cancelMethod + cancelEndpoint + cancelBody;
        
        const cancelSignature = btoa(
          String.fromCharCode(...new Uint8Array(
            await crypto.subtle.sign(
              'HMAC',
              await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(secretKey),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
              ),
              new TextEncoder().encode(cancelPrehash)
            )
          ))
        );

        const cancelUrl = `https://www.okx.com${cancelEndpoint}`;
        const cancelResponse = await fetch(cancelUrl, {
          method: 'POST',
          headers: {
            'OK-ACCESS-KEY': apiKey,
            'OK-ACCESS-SIGN': cancelSignature,
            'OK-ACCESS-TIMESTAMP': cancelTimestamp,
            'OK-ACCESS-PASSPHRASE': passphrase,
            'Content-Type': 'application/json'
          },
          body: cancelBody
        });

        if (cancelResponse.ok) {
          const result = await cancelResponse.json();
          if (result.code === '0') {
            canceledOrders.push({
              symbol: order.instId,
              orderId: order.ordId,
              side: order.side,
              price: order.px,
              quantity: order.sz
            });
            console.log(`✅ Ordem cancelada: ${order.instId} #${order.ordId}`);
          } else {
            console.log(`⚠️ Falha ao cancelar ordem ${order.ordId}: ${result.msg}`);
          }
        } else {
          console.log(`⚠️ Erro HTTP ao cancelar ordem ${order.ordId}`);
        }
      } catch (error) {
        console.log(`❌ Erro ao cancelar ordem ${order.ordId}:`, error);
      }
    }

    return {
      success: true,
      canceledOrders: canceledOrders.length,
      orders: canceledOrders,
      message: `${canceledOrders.length} ordens canceladas na OKX`
    };
  } catch (error) {
    console.error('❌ Erro ao cancelar ordens OKX:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { exchange, userId } = await req.json();

    if (!userId) {
      throw new Error('User ID é obrigatório');
    }

    if (!exchange || !['binance', 'okx', 'all'].includes(exchange)) {
      throw new Error('Exchange inválida. Use: binance, okx ou all');
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔄 Cancelando ordens abertas - Exchange: ${exchange}`);

    const results: any = {};

    // Binance
    if (exchange === 'binance' || exchange === 'all') {
      const { data: binanceConfig } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', userId)
        .eq('exchange', 'binance')
        .eq('is_active', true)
        .single();

      if (binanceConfig) {
        try {
          results.binance = await cancelBinanceOrders(
            binanceConfig.api_key,
            binanceConfig.secret_key
          );
        } catch (error: any) {
          results.binance = {
            success: false,
            error: error.message
          };
        }
      } else {
        results.binance = {
          success: false,
          error: 'Credenciais Binance não configuradas'
        };
      }
    }

    // OKX
    if (exchange === 'okx' || exchange === 'all') {
      const { data: okxConfig } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', userId)
        .eq('exchange', 'okx')
        .eq('is_active', true)
        .single();

      if (okxConfig) {
        try {
          results.okx = await cancelOKXOrders(
            okxConfig.api_key,
            okxConfig.secret_key,
            okxConfig.passphrase
          );
        } catch (error: any) {
          results.okx = {
            success: false,
            error: error.message
          };
        }
      } else {
        results.okx = {
          success: false,
          error: 'Credenciais OKX não configuradas'
        };
      }
    }

    // Calcular totais
    const totalCanceled = Object.values(results).reduce((sum: number, r: any) => 
      sum + (r.canceledOrders || 0), 0
    );

    return new Response(
      JSON.stringify({
        success: true,
        totalCanceled,
        results,
        message: `Total de ${totalCanceled} ordens canceladas`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
