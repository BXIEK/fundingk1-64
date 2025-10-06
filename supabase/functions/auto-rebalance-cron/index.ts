import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RebalanceConfig {
  user_id: string;
  is_enabled: boolean;
  target_allocations: Record<string, number>;
  max_deviation_percent: number;
  min_trade_value: number;
  last_rebalance_at: string | null;
  rebalance_frequency_hours: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 Auto-Rebalance Cron Job executando...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar todas as configurações ativas de rebalanceamento
    const { data: configs, error: configError } = await supabase
      .from('smart_rebalance_configs')
      .select('*')
      .eq('is_enabled', true);

    if (configError) {
      console.error('❌ Erro ao buscar configs:', configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      console.log('ℹ️ Nenhuma configuração ativa de rebalanceamento');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhuma config ativa', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 ${configs.length} configurações ativas encontradas`);

    let processed = 0;
    let skipped = 0;

    // Processar cada configuração
    for (const config of configs as RebalanceConfig[]) {
      const { user_id, last_rebalance_at, rebalance_frequency_hours } = config;

      // Verificar se já passou o tempo necessário desde o último rebalanceamento
      if (last_rebalance_at) {
        const lastRebalance = new Date(last_rebalance_at);
        const now = new Date();
        const hoursSinceLastRebalance = (now.getTime() - lastRebalance.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastRebalance < rebalance_frequency_hours) {
          console.log(`⏭️ Usuário ${user_id}: Aguardando próximo ciclo (${hoursSinceLastRebalance.toFixed(1)}h de ${rebalance_frequency_hours}h)`);
          skipped++;
          continue;
        }
      }

      console.log(`🔄 Processando rebalanceamento para usuário ${user_id}...`);

      try {
        // Chamar a função de rebalanceamento
        const { data: rebalanceResult, error: rebalanceError } = await supabase.functions.invoke(
          'smart-rebalance',
          {
            body: {
              userId: user_id,
              targetAllocations: config.target_allocations,
              maxDeviation: config.max_deviation_percent,
              minTradeValue: config.min_trade_value
            }
          }
        );

        if (rebalanceError) {
          console.error(`❌ Erro no rebalanceamento do usuário ${user_id}:`, rebalanceError);
          continue;
        }

        console.log(`✅ Rebalanceamento concluído para ${user_id}:`, rebalanceResult);
        processed++;

      } catch (error) {
        console.error(`❌ Erro ao processar usuário ${user_id}:`, error);
      }
    }

    const result = {
      success: true,
      message: `Rebalanceamento automático executado`,
      processed,
      skipped,
      total: configs.length,
      timestamp: new Date().toISOString()
    };

    console.log('📊 Resultado final:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro no cron job:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
