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
  min_spread_percentage: number;
  max_investment_amount: number;
  min_profit_threshold: number;
  max_concurrent_operations: number;
  auto_rebalance_enabled: boolean;
  stop_loss_percentage: number;
  exchanges_enabled: string[];
  risk_management_level: string;
  symbols_filter: string[];
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
        .from('auto_cross_exchange_configs')
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
        min_spread_percentage: Number(body.min_spread_percentage ?? 0),
        max_investment_amount: Number(body.max_investment_amount ?? 0),
        min_profit_threshold: Number(body.min_profit_threshold ?? 0),
        max_concurrent_operations: Number(body.max_concurrent_operations ?? 1),
        auto_rebalance_enabled: !!body.auto_rebalance_enabled,
        stop_loss_percentage: Number(body.stop_loss_percentage ?? 0),
        exchanges_enabled: body.exchanges_enabled ?? [],
        risk_management_level: body.risk_management_level ?? 'medium',
        symbols_filter: body.symbols_filter ?? [],
        updated_at: new Date().toISOString()
      };

      // Realiza upsert manual para evitar dependência de constraint única em user_id
      const { data: existing, error: selectError } = await supabase
        .from('auto_cross_exchange_configs')
        .select('id')
        .eq('user_id', payload.user_id)
        .maybeSingle();

      if (selectError) throw selectError;

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from('auto_cross_exchange_configs')
          .update(payload)
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('auto_cross_exchange_configs')
          .insert(payload);
        if (insertError) throw insertError;
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Ação inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('auto-cross-exchange-config error:', e);
    const message = e && typeof e === 'object' && 'message' in (e as any) ? (e as any).message : JSON.stringify(e);
    return new Response(JSON.stringify({ success: false, error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});