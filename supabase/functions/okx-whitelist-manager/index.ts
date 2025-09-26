import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function isValidUuid(id: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(id);
}

// Very simple IPv4/CIDR validation; DB will also enforce inet type
function isValidIP(ip: string) {
  const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  const cidr = new RegExp(`^(${ipv4.source})\/(\d|[1-2]\d|3[0-2])$`);
  return ipv4.test(ip) || cidr.test(ip);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, user_id, ip_address, description, id, currentStatus } = body || {};

    if (!user_id || typeof user_id !== "string" || !isValidUuid(user_id)) {
      return new Response(JSON.stringify({ success: false, error: "user_id inválido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!action) {
      return new Response(JSON.stringify({ success: false, error: "Ação não informada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`[OKX Whitelist Manager] action=${action} user_id=${user_id}`);

    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("okx_whitelist_ips")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, items: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "add") {
      if (!ip_address || typeof ip_address !== "string" || !isValidIP(ip_address.trim())) {
        return new Response(JSON.stringify({ success: false, error: "Endereço IP inválido" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const { data, error } = await supabaseAdmin
        .from("okx_whitelist_ips")
        .insert({
          user_id,
          ip_address: ip_address.trim(),
          description: (description?.trim?.() || "IP da whitelist OKX"),
          is_active: true,
        })
        .select("*")
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, item: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "toggle") {
      if (!id) {
        return new Response(JSON.stringify({ success: false, error: "ID não informado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const { error } = await supabaseAdmin
        .from("okx_whitelist_ips")
        .update({ is_active: !Boolean(currentStatus) })
        .eq("id", id)
        .eq("user_id", user_id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "delete") {
      if (!id) {
        return new Response(JSON.stringify({ success: false, error: "ID não informado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const { error } = await supabaseAdmin
        .from("okx_whitelist_ips")
        .delete()
        .eq("id", id)
        .eq("user_id", user_id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Ação inválida" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (e) {
    console.error("[OKX Whitelist Manager] Error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});