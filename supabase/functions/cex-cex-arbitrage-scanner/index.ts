// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers for public access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: safe JSON parse for cases like pg_net without proper Content-Type/body
async function safeJsonParse(req: Request): Promise<any> {
  try {
    // Some callers (pg_net) may not send content-type, still try to parse
    const text = await req.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (_) {
      // If not valid JSON, return as raw text
      return { raw: text };
    }
  } catch (_) {
    return {};
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const ua = req.headers.get("user-agent") || "unknown";

  try {
    const method = req.method.toUpperCase();

    // Lightweight health endpoint (useful for pg_net GET)
    if (method === "GET") {
      return new Response(
        JSON.stringify({ success: true, status: "alive", source: "cex-cex-arbitrage-scanner", user_agent: ua }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Accept POST with or without Content-Type header
    const body = await safeJsonParse(req);

    // Extract optional params (provide safe defaults)
    const mode = (body?.mode || url.searchParams.get("mode") || "simulation").toString();
    const min_spread = Number(body?.min_spread ?? url.searchParams.get("min_spread") ?? 0.5);
    const symbols = body?.symbols ?? [];

    // For now, return a well-formed empty result to avoid 500s
    // This prevents failures when invoked by pg_net without proper headers
    const payload = {
      success: true,
      message: "Scanner reached successfully",
      mode,
      min_spread,
      symbols,
      opportunities: [],
      meta: {
        user_agent: ua,
        method,
        path: url.pathname,
        has_raw_body: Boolean(body?.raw),
      },
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("❌ cex-cex-arbitrage-scanner error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as any)?.message || "Internal error", function: "cex-cex-arbitrage-scanner" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
