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
      disclaimer: "⚠️ IMPORTANTE: A OKX pode não ter a opção 'IP Restriction' disponível para todas as contas ou pode ter mudado a interface. Se não encontrar esta opção, isso é normal.",
      solution: {
        step1: "🔑 Acesse OKX → Account → API → API Management",
        step2: "✏️ Encontre sua API Key e clique em 'Edit' ou 'Manage'",
        step3: "🔍 Procure por 'IP Restriction', 'IP Whitelist' ou 'Allowed IPs':",
        options: [
          {
            recommended: true,
            title: "SE ENCONTRAR A OPÇÃO - Permitir todos os IPs",
            steps: [
              "Digite: 0.0.0.0/0",
              "Isso permite qualquer IP acessar a API",
              "Ideal para serviços cloud que mudam IP dinamicamente"
            ]
          },
          {
            recommended: false,
            title: "SE ENCONTRAR A OPÇÃO - Desabilitar restrição",
            steps: [
              "Deixe o campo em branco ou desmarque",
              "Remove completamente a restrição de IP",
              "Pode estar em configurações avançadas"
            ]
          },
          {
            recommended: true,
            title: "SE NÃO ENCONTRAR A OPÇÃO (Comum atualmente)",
            steps: [
              "Isso é normal - muitas contas OKX não têm IP Restriction",
              "Verifique se 'Trading' e 'Reading' estão habilitados",
              "O problema pode ser temporário ou de conectividade",
              "Considere usar apenas Binance para arbitragem"
            ]
          }
        ],
        step4: "💾 Se encontrou a opção, salve as mudanças",
        step5: "⏱️ Aguarde alguns minutos se fez alterações",
        step6: "🔄 Teste novamente o sistema de arbitragem"
      },
      important_notes: [
        "🔒 REALIDADE: Muitas contas OKX não têm configuração de IP Restriction disponível",
        "🏢 ALTERNATIVA: Se não conseguir configurar, use apenas Binance",
        "🔐 VERIFICAÇÃO: Certifique-se que API Key tem permissões de Trading habilitadas",
        "⚡ SUPORTE: Se necessário, contate o suporte da OKX sobre IP restrictions",
        "🚨 IMPORTANTE: Este erro pode indicar que sua conta não suporta esta função"
      ],
      troubleshooting: {
        "no_ip_option": "Se não encontrar opção de IP: isso é normal para muitas contas OKX",
        "still_not_working": "Se ainda não funcionar: pode ser limitação da conta ou região",
        "alternative_solution": "Use apenas Binance para arbitragem como alternativa segura"
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