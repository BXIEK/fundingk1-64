import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CredentialStatus {
  exchange: string;
  status: 'valid' | 'invalid' | 'error' | 'missing';
  message: string;
  details?: any;
  suggestions?: string[];
}

interface ValidationResult {
  success: boolean;
  summary: string;
  credentials: CredentialStatus[];
  critical_issues: string[];
  next_steps: string[];
  trading_config?: {
    maxTradeSize: number;
    dailyLimit: number;
    maxSlippage: number;
    maxConcurrentTrades: number;
  };
}

async function validateBinanceCredentials(apiKey?: string, secretKey?: string): Promise<CredentialStatus> {
  if (!apiKey || !secretKey) {
    return {
      exchange: 'Binance',
      status: 'missing',
      message: 'API Key ou Secret Key não configurados',
      suggestions: [
        'Configure suas credenciais da Binance na aba "API" da página "Configuração de API"',
        'Certifique-se de que as credenciais estão salvas corretamente'
      ]
    };
  }

  try {
    // Criar query string com timestamp
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;

    // Gerar assinatura HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(queryString);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Testar endpoint básico da conta
    const response = await fetch(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`,
      {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      const accountData = await response.json();
      return {
        exchange: 'Binance',
        status: 'valid',
        message: 'Credenciais válidas e funcionando',
        details: {
          canTrade: accountData.canTrade,
          canWithdraw: accountData.canWithdraw,
          canDeposit: accountData.canDeposit,
          totalAssets: accountData.balances?.filter((b: any) => 
            parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
          ).length || 0
        }
      };
    } else {
      const errorText = await response.text();
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {}

      const suggestions: string[] = [];
      let message = `Erro HTTP ${response.status}: ${response.statusText}`;
      
      if (errorData.msg) {
        message = errorData.msg;
        
        if (errorData.msg.includes('Invalid API-key')) {
          suggestions.push('Verifique se a API Key está correta');
          suggestions.push('Gere uma nova API Key na Binance');
        }
        
        if (errorData.msg.includes('Signature for this request')) {
          suggestions.push('Verifique se a Secret Key está correta');
          suggestions.push('Certifique-se de que não há espaços extras na Secret Key');
        }
        
        if (errorData.msg.includes('IP') || response.status === 451) {
          suggestions.push('Desative a restrição de IP na configuração da API Key');
          suggestions.push('Ou adicione o IP do Supabase à whitelist');
        }
        
        if (errorData.msg.includes('permission')) {
          suggestions.push('Ative "Enable Reading" na configuração da API Key');
          suggestions.push('Ative permissões de Spot/Futures se necessário');
        }
      }

      return {
        exchange: 'Binance',
        status: 'invalid',
        message,
        details: { httpStatus: response.status, errorCode: errorData.code },
        suggestions: suggestions.length > 0 ? suggestions : [
          'Recrie a API Key na Binance com permissões corretas',
          'Desative restrições de IP',
          'Ative "Enable Reading" e outras permissões necessárias'
        ]
      };
    }
  } catch (error) {
    return {
      exchange: 'Binance',
      status: 'error',
      message: `Erro de conexão: ${error instanceof Error ? error.message : String(error)}`,
      suggestions: [
        'Verifique a conectividade de rede',
        'Teste novamente em alguns minutos'
      ]
    };
  }
}

async function validateHyperliquidCredentials(): Promise<CredentialStatus> {
  const privateKey = Deno.env.get('HYPERLIQUID_PRIVATE_KEY');
  const apiKey = Deno.env.get('HYPERLIQUID_API_KEY');

  if (!privateKey && !apiKey) {
    return {
      exchange: 'Hyperliquid',
      status: 'missing',
      message: 'Private Key ou API Key não configurado',
      suggestions: [
        'Configure HYPERLIQUID_PRIVATE_KEY nos secrets do Supabase',
        'Ou configure HYPERLIQUID_API_KEY se usando API Key'
      ]
    };
  }

  try {
    // Testar endpoint público primeiro
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'allMids'
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && Object.keys(data).length > 0) {
        return {
          exchange: 'Hyperliquid',
          status: 'valid',
          message: 'Conexão com Hyperliquid funcionando (endpoint público)',
          details: {
            symbolsCount: Object.keys(data).length,
            note: 'Testado apenas endpoint público - private key não validada'
          }
        };
      }
    }

    return {
      exchange: 'Hyperliquid',
      status: 'error',
      message: 'Falha na conexão com Hyperliquid',
      suggestions: [
        'Verifique a conectividade com a API da Hyperliquid',
        'Teste novamente em alguns minutos'
      ]
    };
  } catch (error) {
    return {
      exchange: 'Hyperliquid',
      status: 'error',
      message: `Erro de conexão: ${error instanceof Error ? error.message : String(error)}`,
      suggestions: [
        'Verifique a conectividade de rede',
        'API da Hyperliquid pode estar temporariamente indisponível'
      ]
    };
  }
}

async function validateOKXCredentials(): Promise<CredentialStatus> {
  const apiKey = Deno.env.get('OKX_API_KEY');
  const secretKey = Deno.env.get('OKX_SECRET_KEY');
  const passphrase = Deno.env.get('OKX_PASSPHRASE');

  if (!apiKey || !secretKey || !passphrase) {
    return {
      exchange: 'OKX',
      status: 'missing',
      message: 'API Key, Secret Key ou Passphrase não configurados',
      suggestions: [
        'Configure OKX_API_KEY nos secrets do Supabase',
        'Configure OKX_SECRET_KEY nos secrets do Supabase',
        'Configure OKX_PASSPHRASE nos secrets do Supabase'
      ]
    };
  }

  try {
    // Primeiro: checar endpoint público para confirmar conectividade
    const publicRes = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
    if (!publicRes.ok) {
      return {
        exchange: 'OKX',
        status: 'error',
        message: `Falha no endpoint público (HTTP ${publicRes.status})`,
        suggestions: ['Verifique conectividade com okx.com', 'Tente novamente em alguns minutos']
      };
    }
    const publicData = await publicRes.json();

    // Agora: validar credenciais em endpoint privado (saldo)
    const timestamp = new Date().toISOString();
    const method = 'GET';
    const requestPath = '/api/v5/account/balance';
    const body = '';

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const prehash = encoder.encode(timestamp + method + requestPath + body);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, prehash);
    const signBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    const res = await fetch(`https://www.okx.com${requestPath}`, {
      method,
      headers: {
        'OK-ACCESS-KEY': apiKey,
        'OK-ACCESS-SIGN': signBase64,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': passphrase,
        'Content-Type': 'application/json'
      }
    });

    const text = await res.text();
    let json: any = {};
    try { json = JSON.parse(text); } catch {}

    if (res.ok && json && json.code === '0') {
      return {
        exchange: 'OKX',
        status: 'valid',
        message: 'Credenciais OKX válidas e funcionando',
        details: {
          publicSymbols: Array.isArray(publicData?.data) ? publicData.data.length : undefined,
          currencies: json.data?.[0]?.details?.length ?? undefined
        }
      };
    }

    const suggestions: string[] = [
      'Verifique se a passphrase corresponde à API Key',
      'Confirme permissões de Spot Trading e leitura da conta',
      'Recrie a API Key na OKX se necessário'
    ];

    if (json?.msg?.toLowerCase()?.includes('invalid api key')) {
      suggestions.push('Cheque OKX_API_KEY');
    }
    if (json?.msg?.toLowerCase()?.includes('passphrase')) {
      suggestions.push('Atualize OKX_PASSPHRASE');
    }

    return {
      exchange: 'OKX',
      status: 'invalid',
      message: json?.msg || `Erro HTTP ${res.status}`,
      details: json.code ? { code: json.code, msg: json.msg } : { httpStatus: res.status, body: text },
      suggestions
    };
  } catch (error) {
    return {
      exchange: 'OKX',
      status: 'error',
      message: `Erro de conexão: ${error instanceof Error ? error.message : String(error)}`,
      suggestions: [
        'Verifique conectividade de rede',
        'Confirme se não há bloqueio de IP/geo',
        'Tente novamente em alguns minutos'
      ]
    };
  }
}
// Pionex removido: validador substituído por OKX

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Iniciando validação de credenciais das exchanges...');

    // Obter credenciais do corpo da requisição
    let body: any = {};
    try {
      if (req.method !== 'GET') {
        body = await req.json();
      }
    } catch (e) {
      console.log('Nenhum corpo na requisição, usando valores padrão');
    }

    const { binanceApiKey, binanceSecretKey } = body;

    // Validar todas as credenciais em paralelo
    const [binanceStatus, hyperliquidStatus, okxStatus] = await Promise.all([
      validateBinanceCredentials(binanceApiKey, binanceSecretKey),
      validateHyperliquidCredentials(),
      validateOKXCredentials()
    ]);

    const credentials = [binanceStatus, hyperliquidStatus, okxStatus];
    const criticalIssues: string[] = [];
    const nextSteps: string[] = [];

    // Analisar resultados
    const validCount = credentials.filter(c => c.status === 'valid').length;
    const invalidCount = credentials.filter(c => c.status === 'invalid').length;
    const missingCount = credentials.filter(c => c.status === 'missing').length;
    const errorCount = credentials.filter(c => c.status === 'error').length;

    // Identificar problemas críticos
    credentials.forEach(cred => {
      if (cred.status === 'invalid') {
        criticalIssues.push(`${cred.exchange}: ${cred.message}`);
      }
      if (cred.status === 'missing') {
        criticalIssues.push(`${cred.exchange}: Credenciais não configuradas`);
      }
      if (cred.suggestions) {
        nextSteps.push(...cred.suggestions.map((s: string) => `${cred.exchange}: ${s}`));
      }
    });

    // Adicionar próximos passos relacionados à configuração de trading
    if (validCount > 0) {
      nextSteps.push('Verificar configurações de Trading na página inicial: Tamanho Máximo por Trade e Limite Diário');
      nextSteps.push('Testar com valores pequenos primeiro (ex: $10-50) antes de usar valores maiores');
      nextSteps.push('Monitorar histórico de operações para verificar se os valores corretos estão sendo usados');
    }

    // Gerar resumo
    let summary = '';
    if (validCount === 3) {
      summary = '✅ Todas as credenciais estão funcionando perfeitamente! Verifique as configurações de Trading para definir valores adequados.';
    } else if (validCount > 0) {
      summary = `⚠️ ${validCount}/3 exchanges funcionando. ${invalidCount} inválidas, ${missingCount} não configuradas, ${errorCount} com erro. Configure as exchanges restantes e ajuste as configurações de Trading.`;
    } else {
      summary = '❌ Nenhuma credencial está funcionando. Configure suas credenciais de API e defina configurações de Trading adequadas.';
    }

    const result: ValidationResult = {
      success: validCount > 0,
      summary,
      credentials,
      critical_issues: criticalIssues,
      next_steps: nextSteps,
      trading_config: {
        maxTradeSize: 500, // Valores padrão - o frontend irá mostrar os valores atuais do localStorage
        dailyLimit: 1000,
        maxSlippage: 0.5,
        maxConcurrentTrades: 3
      }
    };

    console.log('✅ Validação concluída:', summary);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Erro na validação de credenciais:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      summary: 'Erro interno no validador de credenciais'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});