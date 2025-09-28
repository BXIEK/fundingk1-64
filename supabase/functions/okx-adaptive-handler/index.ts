import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OKX Adaptive Handler desabilitado - fazendo conexões diretas
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    console.log('⚠️ OKX Adaptive Handler desabilitado - sistema configurado para conexões diretas');

    // Retornar erro informando que o handler adaptativo foi desabilitado
    return new Response(JSON.stringify({
      success: false,
      error: 'Sistema adaptativo OKX desabilitado. Use conexões diretas via okx-api.',
      message: 'Faça requisições diretas para /functions/v1/okx-api sem sistemas adaptativos.',
      direct_connection: true,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 503
    });

  } catch (error) {
    console.error('❌ OKX Adaptive Handler desabilitado:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Sistema adaptativo desabilitado',
      message: 'Usar okx-api diretamente'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 503
    });
  }
});