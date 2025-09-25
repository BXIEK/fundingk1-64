// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Tenta ler o corpo, mas é opcional
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    // Este processador foi tornado passivo para aceitar chamadas internas (pg_net) sem JWT
    // e apenas confirmar o recebimento. Útil para pipelines que só precisam de ACK.
    const response = {
      success: true,
      message: "Realtime arbitrage processor ACK",
      method: req.method,
      path: url.pathname,
      test: !!body?.test,
      timestamp: new Date().toISOString()
    };

    // Log útil para depuração nos Edge Logs
    console.log("✅ realtime-arbitrage-processor recebeu requisição", {
      method: req.method,
      hasBody: Object.keys(body).length > 0,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Erro no realtime-arbitrage-processor:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
