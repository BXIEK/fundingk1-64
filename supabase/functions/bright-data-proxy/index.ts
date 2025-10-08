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
    const proxyHost = 'brd.superproxy.io';
    const proxyPort = '33335';
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
    
    console.log(`🔐 Usando proxy: ${proxyHost}:${proxyPort}`);
    console.log(`👤 Username: ${proxyUsername.substring(0, 20)}...`);
    
    const startTime = Date.now();
    
    // Para HTTP proxies, fazemos a requisição diretamente para o proxy
    // com a URL completa do target e autenticação Proxy-Authorization
    const proxyAuth = btoa(`${proxyUsername}:${proxyPassword}`);
    
    // Construir headers com autenticação do proxy
    const requestHeaders: Record<string, string> = {
      'Proxy-Authorization': `Basic ${proxyAuth}`,
      ...headers,
    };
    
    // Para proxies HTTP, a requisição deve ser feita para o proxy
    // com a URL absoluta do target
    const response = await fetch(targetUrl, {
      method,
      headers: requestHeaders,
      body: body && method !== 'GET' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    
    const responseTime = Date.now() - startTime;
    const statusCode = response.status;
    
    let parsedData;
    try {
      const responseText = await response.text();
      parsedData = JSON.parse(responseText);
    } catch {
      parsedData = await response.text();
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
        host: proxyHost,
        port: proxyPort,
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
