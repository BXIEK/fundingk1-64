import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Geographic bypass desabilitado - fazendo conexões diretas
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    console.log('⚠️ Geographic Bypass desabilitado - usando conexões diretas');

    // Retornar erro informando que o bypass geográfico foi desabilitado
    return new Response(JSON.stringify({
      success: false,
      error: 'Bypass geográfico desabilitado. Sistema configurado para conexões diretas às exchanges.',
      message: 'Todas as conexões são feitas diretamente sem bypass geográfico.',
      direct_connection: true,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 503
    });

  } catch (error) {
    console.error('❌ Erro no bypass geográfico desabilitado:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Bypass geográfico desabilitado',
      message: 'Usar conexões diretas às exchanges'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 503
    });
  }
});