import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface N8NWebhookConfig {
  userId: string;
  webhookUrl: string;
  webhookType: 'arbitrage' | 'transfer' | 'monitoring';
  isActive: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, ...data } = await req.json();

    console.log('🔧 n8n Webhook Manager - Ação:', action);

    switch (action) {
      case 'save_webhook': {
        const { userId, webhookUrl, webhookType }: N8NWebhookConfig = data;

        // Validar webhook URL
        if (!webhookUrl.includes('n8n') && !webhookUrl.includes('webhook')) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'URL de webhook inválida'
            }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Testar webhook
        console.log('🧪 Testando webhook n8n...');
        const testResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            test: true,
            timestamp: new Date().toISOString(),
            message: 'Test from SAAT'
          })
        });

        if (!testResponse.ok) {
          throw new Error('Webhook test failed');
        }

        console.log('✅ Webhook testado com sucesso');

        // Salvar configuração
        const { error: upsertError } = await supabase
          .from('n8n_webhooks')
          .upsert({
            user_id: userId,
            webhook_url: webhookUrl,
            webhook_type: webhookType,
            is_active: true,
            last_tested_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,webhook_type'
          });

        if (upsertError) throw upsertError;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Webhook n8n configurado e testado com sucesso'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_webhooks': {
        const { userId } = data;

        const { data: webhooks, error } = await supabase
          .from('n8n_webhooks')
          .select('*')
          .eq('user_id', userId);

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            webhooks
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'test_webhook': {
        const { webhookUrl } = data;

        const testPayload = {
          test: true,
          timestamp: new Date().toISOString(),
          data: {
            symbol: 'BTCUSDT',
            amount: 100,
            action: 'test_connection'
          }
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload)
        });

        const result = await response.json();

        return new Response(
          JSON.stringify({
            success: response.ok,
            status: response.status,
            result
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'trigger_arbitrage': {
        const { userId, opportunity, webhookUrl } = data;

        console.log('🎯 Triggering arbitrage via n8n:', opportunity);

        const payload = {
          userId,
          timestamp: new Date().toISOString(),
          action: 'execute_arbitrage',
          opportunity: {
            symbol: opportunity.symbol,
            buyExchange: opportunity.buy_exchange,
            sellExchange: opportunity.sell_exchange,
            buyPrice: opportunity.buy_price,
            sellPrice: opportunity.sell_price,
            spread: opportunity.spread_percentage,
            amount: opportunity.amount || 100
          }
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        return new Response(
          JSON.stringify({
            success: response.ok,
            message: 'Arbitragem delegada para n8n',
            result
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Ação não reconhecida'
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

  } catch (error) {
    console.error('❌ Erro no n8n webhook manager:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
