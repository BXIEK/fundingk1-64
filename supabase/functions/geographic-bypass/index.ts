// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Serviço dedicado para contornar restrições geográficas da Binance
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetUrl, method = 'GET', headers: reqHeaders = {}, body } = await req.json();

    console.log(`🌐 Requisição de bypass para: ${targetUrl}`);

    // Pool de proxies rotativo
    const proxyPool = [
      'https://corsproxy.io/?',
      'https://api.codetabs.com/v1/proxy?quest=',
      'https://cors-proxy.htmldriven.com/?url=',
      'https://proxy.cors.sh/',
      'https://api.allorigins.win/raw?url='
    ];

    // Cabeçalhos para mascarar requisição
    const maskedHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Origin': 'https://www.binance.com',
      'Referer': 'https://www.binance.com/',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      ...reqHeaders
    };

    // Estratégia 1: Tentar acesso direto com headers mascarados
    try {
      console.log(`📡 Tentativa direta mascarada...`);
      const response = await fetch(targetUrl, {
        method,
        headers: maskedHeaders,
        body: body ? JSON.stringify(body) : undefined
      });

      if (response.ok) {
        const data = await response.json();
        if (!data.code || !data.msg?.includes('restricted location')) {
          console.log(`✅ Sucesso direto mascarado`);
          return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    } catch (error) {
      console.log(`❌ Falha direta: ${error.message}`);
    }

    // Estratégia 2: Usar proxies com rotação
    for (const proxy of proxyPool) {
      try {
        const proxyUrl = `${proxy}${encodeURIComponent(targetUrl)}`;
        console.log(`🔄 Tentando proxy: ${proxy}`);
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'User-Agent': maskedHeaders['User-Agent'],
            'Accept': maskedHeaders['Accept']
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.code || !data.msg?.includes('restricted location')) {
            console.log(`✅ Sucesso via proxy: ${proxy}`);
            return new Response(JSON.stringify({ success: true, data, source: 'proxy' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      } catch (error) {
        console.log(`❌ Falha proxy ${proxy}: ${error.message}`);
        continue;
      }
    }

    // Estratégia 3: Usar múltiplos IPs simulados
    const simulatedIPs = ['8.8.8.8', '1.1.1.1', '208.67.222.222', '9.9.9.9'];
    
    for (const ip of simulatedIPs) {
      try {
        console.log(`🌍 Tentando com IP simulado: ${ip}`);
        const response = await fetch(targetUrl, {
          method,
          headers: {
            ...maskedHeaders,
            'X-Forwarded-For': ip,
            'X-Real-IP': ip,
            'CF-Connecting-IP': ip,
            'True-Client-IP': ip,
            'X-Originating-IP': ip
          },
          body: body ? JSON.stringify(body) : undefined
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.code || !data.msg?.includes('restricted location')) {
            console.log(`✅ Sucesso com IP simulado: ${ip}`);
            return new Response(JSON.stringify({ success: true, data, source: 'ip_simulation' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      } catch (error) {
        console.log(`❌ Falha IP ${ip}: ${error.message}`);
        continue;
      }
    }

    // Se todas as tentativas falharam
    console.log(`❌ Todas as estratégias falharam para: ${targetUrl}`);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Acesso bloqueado por restrições geográficas',
      fallback: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 451
    });

  } catch (error) {
    console.error('❌ Erro no serviço de bypass:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});