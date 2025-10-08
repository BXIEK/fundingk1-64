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
    
    // Criar URL do proxy
    const proxyUrl = `http://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;
    
    // Fazer requisição via proxy usando fetch nativo do Deno
    const startTime = Date.now();
    
    // Configurar autenticação do proxy
    const proxyAuth = btoa(`${proxyUsername}:${proxyPassword}`);
    
    // Fazer requisição com proxy
    const response = await fetch(targetUrl, {
      method,
      headers: {
        ...headers,
        'Proxy-Authorization': `Basic ${proxyAuth}`,
      },
      body: body && method !== 'GET' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      // @ts-ignore - Deno suporta proxy em fetch
      proxy: `http://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`,
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
