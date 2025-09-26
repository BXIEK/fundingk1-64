import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔍 Analisando problema de IP whitelist da OKX...')
    
    // Obter IP atual da edge function
    const currentIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'IP não detectado'
    
    console.log(`📡 IP atual da Edge Function: ${currentIP}`)
    
    // Instruções detalhadas para resolver o problema
    const instructions = {
      problem: "🚫 OKX IP Whitelist Error (Código 50110)",
      current_ip: currentIP,
      solution: {
        step1: "🔑 Acesse OKX → Security → API Management",
        step2: "✏️ Encontre sua API Key e clique em 'Edit'",
        step3: "🌐 Na seção 'IP Restriction':",
        options: [
          {
            recommended: true,
            title: "OPÇÃO 1 - Permitir todos os IPs (Recomendado para Edge Functions)",
            steps: [
              "Digite: 0.0.0.0/0",
              "Isso permite qualquer IP acessar a API",
              "Ideal para serviços cloud que mudam IP dinamicamente"
            ]
          },
          {
            recommended: false,
            title: "OPÇÃO 2 - Desabilitar restrição de IP", 
            steps: [
              "Deixe o campo em branco",
              "Remove completamente a restrição de IP",
              "Menos seguro mas funciona"
            ]
          },
          {
            recommended: false,
            title: "OPÇÃO 3 - IPs específicos (Não recomendado)",
            steps: [
              `Adicionar IP atual: ${currentIP}`,
              "⚠️ PROBLEMA: Edge Functions mudam IP constantemente",
              "Você teria que atualizar sempre que o IP mudar"
            ]
          }
        ],
        step4: "💾 Save / Salvar as mudanças",
        step5: "⏱️ Aguarde alguns minutos para a mudança ser aplicada",
        step6: "🔄 Teste novamente o sistema de arbitragem"
      },
      important_notes: [
        "🔒 SEGURANÇA: Permitir todos os IPs (0.0.0.0/0) pode ser menos seguro",
        "🏢 ALTERNATIVA: Use apenas em contas de teste ou com valores baixos",
        "🔐 RECOMENDAÇÃO: Configure sempre uma senha forte e 2FA na OKX",
        "⚡ SOLUÇÃO DEFINITIVA: Edge Functions precisam desta configuração para funcionar",
        "🚨 SEM ESTA CONFIGURAÇÃO: Sistema adaptativo sempre falhará"
      ],
      troubleshooting: {
        "still_not_working": "Se ainda não funcionar após 10 minutos, tente deletar e recriar a API Key",
        "multiple_apis": "Se tem múltiplas API Keys, configure TODAS com 0.0.0.0/0",
        "trading_restrictions": "Certifique-se que 'Enable Reading' e 'Enable Trading' estão marcados"
      }
    }
    
    return new Response(JSON.stringify(instructions, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('❌ Erro no helper de IP whitelist:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        help: "Esta função ajuda a diagnosticar problemas de IP whitelist da OKX"
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})