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
    
    console.log(`🌐 Bright Data Web Unlocker Request: ${method} ${targetUrl}`);
    
    // Obter API Key do Bright Data Web Unlocker
    const brightDataApiKey = Deno.env.get('BRIGHT_DATA_API_KEY');
    
    if (!brightDataApiKey) {
      console.error('❌ BRIGHT_DATA_API_KEY não configurada');
      return new Response(JSON.stringify({
        success: false,
        error: 'API Key do Bright Data não configurada'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
    
    console.log(`🔐 Usando Bright Data Web Unlocker API`);
    console.log(`🔑 API Key: ${brightDataApiKey.substring(0, 20)}...`);
    
    const startTime = Date.now();
    
    // Usar Bright Data Web Unlocker API
    console.log('🚀 Chamando Bright Data Web Unlocker API...');
    
    const unlockerPayload = {
      zone: 'web_unlocker1',
      url: targetUrl,
      format: 'raw',
      method: method,
      headers: headers,
      body: body && method !== 'GET' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
    };
    
    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${brightDataApiKey}`
      },
      body: JSON.stringify(unlockerPayload)
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
