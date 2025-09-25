// Função temporária para evitar erros 500 - remover referências antigas
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('⚠️ DEPRECATED: bybit-prices function called - this function is no longer supported');
  
  return new Response(JSON.stringify({
    success: false,
    error: 'Esta função foi descontinuada. Use apenas Binance e OKX.',
    deprecated: true,
    supported_exchanges: ['Binance', 'OKX'],
    timestamp: new Date().toISOString()
  }), {
    status: 410, // Gone
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});