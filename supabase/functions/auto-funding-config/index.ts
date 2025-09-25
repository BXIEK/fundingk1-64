// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

type SavePayload = {
  action: 'save';
  user_id: string;
  is_enabled: boolean;
  min_funding_rate: number;
  max_investment_per_trade: number;
  min_profit_threshold: number;
  symbols: string[];
  auto_close_after_funding: boolean;
};

type GetPayload = {
  action: 'get';
  user_id: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as SavePayload | GetPayload;

    if (body.action === 'get') {
      const { data, error } = await supabase
        .from('auto_funding_configs')
        .select('*')
        .eq('user_id', body.user_id)
        .maybeSingle();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (body.action === 'save') {
      // Básica validação de entrada
      if (!body.user_id) throw new Error('user_id é obrigatório');

      const payload = {
        user_id: body.user_id,
        is_enabled: !!body.is_enabled,
        min_funding_rate: Number(body.min_funding_rate ?? 0),
        max_investment_per_trade: Number(body.max_investment_per_trade ?? 0),
        min_profit_threshold: Number(body.min_profit_threshold ?? 0),
        symbols: body.symbols ?? [],
        auto_close_after_funding: !!body.auto_close_after_funding,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('auto_funding_configs')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Ação inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('auto-funding-config error:', e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});