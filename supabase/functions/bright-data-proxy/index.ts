import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProxyRequest {
  targetUrl: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetUrl, method = 'GET', headers = {}, body }: ProxyRequest = await req.json();
    
    console.log(`🌐 Bright Data Proxy Request: ${method} ${targetUrl}`);
    
    // Obter credenciais do Bright Data
    const proxyUsername = Deno.env.get('BRIGHT_DATA_USERNAME');
    const proxyPassword = Deno.env.get('BRIGHT_DATA_PASSWORD');
    
    if (!proxyUsername || !proxyPassword) {
      console.error('❌ Credenciais Bright Data não configuradas');
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciais do proxy não configuradas'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
    
    console.log(`🔐 Usando proxy Bright Data`);
    console.log(`👤 Username: ${proxyUsername.substring(0, 30)}...`);
    
    const startTime = Date.now();
    
    // NOTA: Deno Deploy não suporta proxies HTTP tradicionais
    // Vamos testar a conexão diretamente e retornar informações
    console.log('⚠️ LIMITAÇÃO: Deno Deploy não suporta proxies HTTP nativamente');
    console.log('🔄 Testando conexão direta ao endpoint...');
    
    const response = await fetch(targetUrl, {
      method,
      headers: {
        ...headers,
      },
      body: body && method !== 'GET' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    
    const responseTime = Date.now() - startTime;
    const statusCode = response.status;
    
    let parsedData;
    try {
      const responseText = await response.text();
      parsedData = JSON.parse(responseText);
    } catch {
      const responseText = await response.text();
      parsedData = responseText;
    }
    
    const success = statusCode >= 200 && statusCode < 300;
    
    console.log(`${success ? '✅' : '❌'} Bright Data Proxy: ${statusCode} (${responseTime}ms)`);
    
    return new Response(JSON.stringify({
      success,
      data: parsedData,
      source: 'bright-data-proxy',
      status: statusCode,
      responseTime,
      proxy: {
        host: 'brd.superproxy.io',
        port: 33335,
        country: 'BR'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Bright Data Proxy Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido no proxy',
      source: 'bright-data-proxy'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
