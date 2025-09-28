import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Smart Proxy Service desabilitado - fazendo conexões diretas
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    console.log('⚠️ Smart Proxy Service desabilitado - sistema configurado para conexões diretas');

    // Retornar erro informando que o proxy foi desabilitado
    return new Response(JSON.stringify({
      success: false,
      error: 'Smart Proxy Service desabilitado. Sistema configurado para conexões diretas às exchanges.',
      message: 'Todas as requisições são feitas diretamente às APIs das exchanges sem proxies.',
      direct_connection: true,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 503
    });

  } catch (error) {
    console.error('❌ Smart Proxy Service desabilitado:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Smart Proxy Service desabilitado',
      message: 'Sistema configurado para conexões diretas'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 503
    });
  }
});