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
    
    // Fazer requisição via proxy usando Deno.Command
    const startTime = Date.now();
    
    const curlCommand = new Deno.Command("curl", {
      args: [
        "-x", `${proxyHost}:${proxyPort}`,
        "-U", `${proxyUsername}:${proxyPassword}`,
        "-X", method,
        ...Object.entries(headers).flatMap(([key, value]) => ["-H", `${key}: ${value}`]),
        ...(body && method !== 'GET' ? ["-d", typeof body === 'string' ? body : JSON.stringify(body)] : []),
        targetUrl,
        "-s", // silent
        "-w", "\\n%{http_code}", // append HTTP status code
      ],
      stdout: "piped",
      stderr: "piped",
    });
    
    const { stdout, stderr } = await curlCommand.output();
    const responseTime = Date.now() - startTime;
    
    if (stderr.length > 0) {
      const errorText = new TextDecoder().decode(stderr);
      console.error('❌ Curl stderr:', errorText);
    }
    
    const output = new TextDecoder().decode(stdout);
    const lines = output.trim().split('\n');
    const statusCode = parseInt(lines[lines.length - 1]);
    const responseBody = lines.slice(0, -1).join('\n');
    
    let parsedData;
    try {
      parsedData = JSON.parse(responseBody);
    } catch {
      parsedData = responseBody;
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
