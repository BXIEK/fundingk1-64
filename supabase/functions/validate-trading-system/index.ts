// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationRequest {
  user_id: string;
  validation_type: 'full' | 'api_connectivity' | 'balance_check' | 'config_validation';
  trading_mode: 'real' | 'test';
  binance_api_key?: string;
  binance_secret_key?: string;
}

interface ValidationResult {
  success: boolean;
  component: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🔍 VALIDATE-TRADING-SYSTEM: Iniciando validação do sistema');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestData: ValidationRequest = await req.json();
    const { user_id, validation_type = 'full', trading_mode, binance_api_key, binance_secret_key } = requestData;

    console.log(`Validando sistema para usuário ${user_id} em modo ${trading_mode}`);

    const results: ValidationResult[] = [];
    const timestamp = new Date().toISOString();

    // 1. Validação de Conectividade das APIs
    if (validation_type === 'full' || validation_type === 'api_connectivity') {
      console.log('🌐 Testando conectividade das APIs...');
      
      try {
        // Testar conectividade geral via nossa edge function de market data
        const marketDataTest = await supabase.functions.invoke('binance-market-data', {
          body: { endpoint: 'tickers' }
        });

        if (!marketDataTest.error) {
          results.push({
            success: true,
            component: 'Binance API Connectivity',
            status: 'success',
            message: 'Conexão com Binance estabelecida via proxy system',
            details: { endpoint: 'binance-market-data', proxy_system: true },
            timestamp
          });
        } else {
          results.push({
            success: false,
            component: 'Binance API Connectivity',
            status: 'warning',
            message: 'API Binance com restrições - usando dados simulados',
            details: { error: marketDataTest.error.message, fallback_active: true },
            timestamp
          });
        }

        // Testar sistema de detecção de oportunidades
        const arbitrageTest = await supabase.functions.invoke('detect-arbitrage-opportunities', {
          body: { type: 'cross_exchange' }
        });

        results.push({
          success: !arbitrageTest.error,
          component: 'Arbitrage Detection System',
          status: !arbitrageTest.error ? 'success' : 'warning',
          message: !arbitrageTest.error ? 'Sistema de detecção funcionando' : 'Sistema com limitações geográficas',
          details: { 
            system_status: !arbitrageTest.error ? 'operational' : 'limited',
            simulated_data: !!arbitrageTest.error
          },
          timestamp
        });

      } catch (error) {
        results.push({
          success: false,
          component: 'API Connectivity',
          status: 'error',
          message: 'Erro ao testar conectividade das APIs',
          details: { error: error.message },
          timestamp
        });
      }
    }

    // 2. Validação de Credenciais e Permissões
    if (validation_type === 'full' || validation_type === 'api_connectivity') {
      console.log('🔑 Validando credenciais API...');

      if (trading_mode === 'real') {
        try {
          // Se as credenciais foram fornecidas, testá-las diretamente
          if (binance_api_key && binance_secret_key) {
            try {
              // Testar as credenciais Binance fornecidas
              const testResult = await supabase.functions.invoke('test-binance-connection', {
                body: { apiKey: binance_api_key, secretKey: binance_secret_key }
              });

              if (testResult.data?.success) {
                results.push({
                  success: true,
                  component: 'API Credentials',
                  status: 'success',
                  message: 'Credenciais Binance validadas com sucesso',
                  details: { 
                    configured_apis: ['Binance'], 
                    total_apis: 1,
                    account_info: testResult.data.accountInfo 
                  },
                  timestamp
                });
              } else {
                results.push({
                  success: false,
                  component: 'API Credentials',
                  status: 'error',
                  message: 'Credenciais Binance inválidas ou com restrições',
                  details: { error: testResult.data?.message || testResult.error?.message },
                  timestamp
                });
              }
            } catch (error) {
              results.push({
                success: false,
                component: 'API Credentials',
                status: 'error',
                message: 'Erro ao testar credenciais Binance',
                details: { error: error.message },
                timestamp
              });
            }
          } else {
            results.push({
              success: false,
              component: 'API Credentials',
              status: 'warning',
              message: 'Credenciais não fornecidas - Configure suas chaves API',
              details: { configured_apis: [], total_apis: 0 },
              timestamp
            });
          }
        } catch (error) {
          results.push({
            success: false,
            component: 'API Credentials',
            status: 'error',
            message: 'Erro ao verificar credenciais',
            details: { error: error.message },
            timestamp
          });
        }
      } else {
        results.push({
          success: true,
          component: 'API Credentials',
          status: 'warning',
          message: 'Modo teste ativo - Credenciais não obrigatórias',
          details: { mode: 'test' },
          timestamp
        });
      }
    }

    // 3. Validação de Configurações Ativas
    if (validation_type === 'full' || validation_type === 'config_validation') {
      console.log('⚙️ Validando configurações de automação...');

      try {
        const { data: fundingConfigs } = await supabase
          .from('auto_funding_configs')
          .select('*')
          .eq('user_id', user_id)
          .eq('is_enabled', true);

        const { data: crossExchangeConfigs } = await supabase
          .from('auto_cross_exchange_configs')
          .select('*')
          .eq('user_id', user_id)
          .eq('is_enabled', true);

        const totalConfigs = (fundingConfigs?.length || 0) + (crossExchangeConfigs?.length || 0);

        results.push({
          success: totalConfigs > 0,
          component: 'Automation Configurations',
          status: totalConfigs > 0 ? 'success' : 'warning',
          message: totalConfigs > 0 ? `${totalConfigs} configurações ativas` : 'Nenhuma automação ativa',
          details: {
            funding_configs: fundingConfigs?.length || 0,
            cross_exchange_configs: crossExchangeConfigs?.length || 0,
            total: totalConfigs
          },
          timestamp
        });

      } catch (error) {
        results.push({
          success: false,
          component: 'Automation Configurations',
          status: 'error',
          message: 'Erro ao verificar configurações',
          details: { error: error.message },
          timestamp
        });
      }
    }

    // 4. Validação de Saldos
    if (validation_type === 'full' || validation_type === 'balance_check') {
      console.log('💰 Validando saldos disponíveis...');

      if (trading_mode === 'real') {
        try {
          // Verificar saldos para uma operação teste pequena
          const { data: balanceCheck, error: balanceError } = await supabase.rpc('check_and_lock_balance_for_arbitrage', {
            p_user_id: user_id,
            p_symbol: 'BTC',
            p_amount: 0.001, // Quantidade pequena para teste
            p_buy_exchange: 'Binance',
            p_sell_exchange: 'Pionex',
            p_current_price: 50000
          });

          if (balanceError) {
            results.push({
              success: false,
              component: 'Balance Validation',
              status: 'error',
              message: 'Erro ao verificar saldos',
              details: { error: balanceError.message },
              timestamp
            });
          } else {
            // A função retorna um objeto com 'success' field
            const hasBalance = balanceCheck && typeof balanceCheck === 'object' && balanceCheck.success;

            results.push({
              success: !!hasBalance,
              component: 'Balance Validation',
              status: hasBalance ? 'success' : 'warning',
              message: hasBalance ? 'Saldos suficientes para operações teste' : 'Saldos insuficientes - configure seus fundos',
              details: balanceCheck,
              timestamp
            });
          }

        } catch (error) {
          results.push({
            success: false,
            component: 'Balance Validation',
            status: 'error',
            message: 'Erro ao verificar saldos',
            details: { error: error.message },
            timestamp
          });
        }
      } else {
        // Para modo teste, sempre aprovar
        results.push({
          success: true,
          component: 'Balance Validation',
          status: 'success',
          message: 'Modo teste - Saldos simulados disponíveis',
          details: { mode: 'test', simulated_balance: true },
          timestamp
        });
      }
    }

    // 5. Validação do Sistema de Execução
    if (validation_type === 'full') {
      console.log('🚀 Testando sistema de execução...');

      try {
        // Testar Edge Function de execução real de arbitragem
        try {
          const executeTest = await supabase.functions.invoke('execute-real-arbitrage', {
            body: { 
              test: true, 
              validation: true,
              symbol: 'BTC',
              amount: 0.001,
              user_id: user_id,
              trading_mode: 'simulation'
            }
          });

          results.push({
            success: !executeTest.error,
            component: 'Real Arbitrage Execution',
            status: !executeTest.error ? 'success' : 'warning',
            message: !executeTest.error ? 'Sistema de execução funcionando' : 'Sistema com limitações',
            details: { 
              function_name: 'execute-real-arbitrage', 
              accessible: !executeTest.error,
              test_mode: true
            },
            timestamp
          });
        } catch (error) {
          results.push({
            success: false,
            component: 'Real Arbitrage Execution',
            status: 'error',
            message: 'Sistema de execução inacessível',
            details: { function_name: 'execute-real-arbitrage', error: error.message },
            timestamp
          });
        }

        // Testar sistema de transferência inteligente
        try {
          const transferTest = await supabase.functions.invoke('smart-cross-exchange-transfer', {
            body: { 
              test: true,
              user_id: user_id,
              symbol: 'BTC',
              amount: 0.001,
              from_exchange: 'Binance',
              to_exchange: 'Pionex'
            }
          });

          results.push({
            success: !transferTest.error,
            component: 'Smart Transfer System',
            status: !transferTest.error ? 'success' : 'warning',
            message: !transferTest.error ? 'Sistema de transferência funcionando' : 'Sistema com limitações',
            details: { 
              function_name: 'smart-cross-exchange-transfer', 
              accessible: !transferTest.error
            },
            timestamp
          });
        } catch (error) {
          results.push({
            success: false,
            component: 'Smart Transfer System',
            status: 'error',
            message: 'Sistema de transferência inacessível',
            details: { function_name: 'smart-cross-exchange-transfer', error: error.message },
            timestamp
          });
        }

      } catch (error) {
        results.push({
          success: false,
          component: 'Execution System',
          status: 'error',
          message: 'Erro ao testar sistema de execução',
          details: { error: error.message },
          timestamp
        });
      }
    }

    // Calcular score geral
    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success).length;
    const overallScore = totalTests > 0 ? (successfulTests / totalTests) * 100 : 0;

    const response = {
      success: true,
      validation_type,
      trading_mode,
      overall_score: overallScore,
      total_tests: totalTests,
      successful_tests: successfulTests,
      results,
      summary: {
        status: overallScore >= 80 ? 'healthy' : overallScore >= 60 ? 'warning' : 'critical',
        message: overallScore >= 80 ? 'Sistema funcionando corretamente' :
                overallScore >= 60 ? 'Sistema com algumas advertências' : 'Sistema com problemas críticos'
      },
      timestamp,
      next_validation_recommended: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hora
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na validação do sistema:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});