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
    console.log('🔐 Carregando credenciais da OKX...');
    
    const okxApiKey = Deno.env.get('OKX_API_KEY');
    const okxSecretKey = Deno.env.get('OKX_SECRET_KEY');
    const okxPassphrase = Deno.env.get('OKX_PASSPHRASE');

    if (!okxApiKey || !okxSecretKey || !okxPassphrase) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais da OKX não configuradas no Supabase' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = {
      apiKey: okxApiKey,
      secretKey: okxSecretKey,
      passphrase: okxPassphrase
    };

    console.log('✅ Credenciais da OKX carregadas com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        credentials,
        message: 'Credenciais da OKX carregadas do Supabase'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao carregar credenciais da OKX:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Erro ao carregar credenciais: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});