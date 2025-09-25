// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Pool de proxies premium e serviços de redirecionamento
const PROXY_POOLS = {
  // Proxies públicos gratuitos (menor confiabilidade)
  free: [
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://cors-proxy.htmldriven.com/?url=',
    'https://api.allorigins.win/raw?url='
  ],
  // Proxies residenciais simulados (maior sucesso)
  residential: [
    'https://proxy-server-1.herokuapp.com/proxy?url=',
    'https://proxy-server-2.herokuapp.com/proxy?url=',
    'https://cors-anywhere-alternative.herokuapp.com/',
    'https://thingproxy-alternative.freeboard.io/fetch/'
  ],
  // Proxies datacenter simulados
  datacenter: [
    'https://datacenter-proxy-1.netlify.app/api/proxy?target=',
    'https://datacenter-proxy-2.vercel.app/api/proxy?target=',
    'https://smart-proxy.railway.app/proxy?url='
  ]
};

// IPs de diferentes países para rotação
const COUNTRY_IPS = {
  'US': ['8.8.8.8', '1.1.1.1', '208.67.222.222', '64.6.64.6'],
  'UK': ['80.67.169.40', '80.67.169.12', '149.112.112.112'],
  'DE': ['194.150.168.168', '81.95.120.118', '77.88.8.8'],
  'SG': ['103.247.36.36', '103.247.37.37', '180.76.76.76'],
  'JP': ['210.196.3.183', '210.239.96.110', '133.242.255.139'],
  'CA': ['198.101.242.72', '23.253.163.53', '184.105.193.78']
};

// User agents realísticos
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      targetUrl, 
      method = 'GET', 
      headers: reqHeaders = {}, 
      body,
      strategy = 'auto',  // auto, aggressive, stealth
      country = 'random'
    } = await req.json();

    console.log(`🌐 Smart Proxy Request: ${targetUrl} [Strategy: ${strategy}]`);

    // Selecionar país e IP
    const selectedCountry = country === 'random' 
      ? Object.keys(COUNTRY_IPS)[Math.floor(Math.random() * Object.keys(COUNTRY_IPS).length)]
      : country;
    
    const countryIPs = COUNTRY_IPS[selectedCountry] || COUNTRY_IPS['US'];
    const selectedIP = countryIPs[Math.floor(Math.random() * countryIPs.length)];
    const selectedUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    console.log(`🌍 Using IP from ${selectedCountry}: ${selectedIP}`);

    // Headers base para simular requisição real
    const baseHeaders = {
      'User-Agent': selectedUserAgent,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'X-Forwarded-For': selectedIP,
      'X-Real-IP': selectedIP,
      'CF-Connecting-IP': selectedIP,
      'True-Client-IP': selectedIP,
      'X-Originating-IP': selectedIP,
      'Client-IP': selectedIP,
      ...reqHeaders
    };

    let proxyPools: string[] = [];
    
    // Estratégia de seleção de proxies
    switch (strategy) {
      case 'aggressive':
        proxyPools = [...PROXY_POOLS.residential, ...PROXY_POOLS.datacenter, ...PROXY_POOLS.free];
        break;
      case 'stealth':
        proxyPools = [...PROXY_POOLS.residential, ...PROXY_POOLS.free];
        break;
      default:
        proxyPools = [...PROXY_POOLS.free, ...PROXY_POOLS.residential];
    }

    // Estratégia 1: Tentativa direta com IP mascarado e headers preservados
    if (strategy !== 'aggressive') {
      try {
        console.log(`🎯 Tentativa direta com IP ${selectedIP}...`);
        
        // Garantir que headers críticos sejam preservados (especialmente Authorization e apikey)
        const directHeaders = {
          ...baseHeaders,
          // Forçar inclusão de headers de autorização se fornecidos
          ...(reqHeaders.Authorization && { 'Authorization': reqHeaders.Authorization }),
          ...(reqHeaders.authorization && { 'authorization': reqHeaders.authorization }),
          ...(reqHeaders.apikey && { 'apikey': reqHeaders.apikey }),
          ...(reqHeaders['Content-Type'] && { 'Content-Type': reqHeaders['Content-Type'] }),
        };
        
        console.log(`📋 Headers incluídos: ${Object.keys(directHeaders).join(', ')}`);
        
        const response = await fetch(targetUrl, {
          method,
          headers: directHeaders,
          body: body ? JSON.stringify(body) : undefined
        });

        if (response.ok) {
          const data = await response.json();
          
          // Verificar se não é erro de autorização ou geográfico
          if (!data.code || (!data.msg?.includes('restricted location') && !data.message?.includes('Missing authorization'))) {
            console.log(`✅ Sucesso direto com IP ${selectedIP}`);
            
            return new Response(JSON.stringify({ 
              success: true, 
              data,
              source: 'direct',
              country: selectedCountry,
              ip: selectedIP
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            console.log(`⚠️ Erro na resposta direta: ${data.message || data.msg}`);
          }
        } else {
          console.log(`❌ Status direto: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.log(`❌ Falha direta: ${error.message}`);
      }
    }

    // Estratégia 2: Rotação inteligente de proxies
    for (let i = 0; i < proxyPools.length; i++) {
      const proxy = proxyPools[i];
      
      try {
        // Rotacionar IP a cada tentativa em modo agressivo
        if (strategy === 'aggressive' && i % 2 === 0) {
          const newIP = countryIPs[Math.floor(Math.random() * countryIPs.length)];
          baseHeaders['X-Forwarded-For'] = newIP;
          baseHeaders['X-Real-IP'] = newIP;
          baseHeaders['CF-Connecting-IP'] = newIP;
          console.log(`🔄 Rotacionando para IP: ${newIP}`);
        }

        const proxyUrl = `${proxy}${encodeURIComponent(targetUrl)}`;
        console.log(`🌐 Tentando proxy ${i + 1}/${proxyPools.length}: ${proxy.split('/')[2]}`);
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'User-Agent': baseHeaders['User-Agent'],
            'Accept': baseHeaders['Accept'],
            'X-Forwarded-For': baseHeaders['X-Forwarded-For']
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          // Verificar se não é erro geográfico
          if (!data.code || !data.msg?.includes('restricted location')) {
            console.log(`✅ Sucesso via proxy: ${proxy.split('/')[2]}`);
            
            return new Response(JSON.stringify({ 
              success: true, 
              data,
              source: 'proxy',
              proxy: proxy.split('/')[2],
              country: selectedCountry,
              ip: baseHeaders['X-Forwarded-For']
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // Delay entre tentativas para evitar rate limiting
        if (i < proxyPools.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        }

      } catch (error) {
        console.log(`❌ Falha proxy ${proxy.split('/')[2]}: ${error.message}`);
        continue;
      }
    }

    // Estratégia 3: Última tentativa com delay e headers especiais
    console.log(`🚨 Última tentativa com anti-fingerprinting...`);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const response = await fetch(targetUrl, {
        method,
        headers: {
          ...baseHeaders,
          'DNT': '1',
          'Upgrade-Insecure-Requests': '1',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://www.binance.com',
          'Referer': 'https://www.binance.com/'
        },
        body: body ? JSON.stringify(body) : undefined
      });

      if (response.ok) {
        const data = await response.json();
        if (!data.code || !data.msg?.includes('restricted location')) {
          console.log(`✅ Sucesso final com anti-fingerprinting`);
          
          return new Response(JSON.stringify({ 
            success: true, 
            data,
            source: 'anti-fingerprint',
            country: selectedCountry
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    } catch (error) {
      console.log(`❌ Falha final: ${error.message}`);
    }

    // Todas as estratégias falharam
    console.log(`💥 Todas as estratégias falharam para: ${targetUrl}`);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Todas as estratégias de proxy falharam',
      attempted_strategies: ['direct', 'proxy_rotation', 'anti_fingerprint'],
      country_attempted: selectedCountry,
      proxies_tried: proxyPools.length,
      fallback_available: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 451
    });

  } catch (error) {
    console.error('❌ Erro no Smart Proxy Service:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      service: 'smart-proxy-service'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});