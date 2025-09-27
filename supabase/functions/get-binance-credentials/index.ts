import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔐 Carregando credenciais da Binance...');
    
    const binanceApiKey = Deno.env.get('BINANCE_API_KEY');
    const binanceSecretKey = Deno.env.get('BINANCE_SECRET_KEY');

    if (!binanceApiKey || !binanceSecretKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais da Binance não configuradas no Supabase' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = {
      apiKey: binanceApiKey,
      secretKey: binanceSecretKey
    };

    console.log('✅ Credenciais da Binance carregadas com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        credentials,
        message: 'Credenciais da Binance carregadas do Supabase'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao carregar credenciais da Binance:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Erro ao carregar credenciais: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});