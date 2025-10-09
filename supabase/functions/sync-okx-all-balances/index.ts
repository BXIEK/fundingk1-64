// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, okxApiKey, okxSecretKey, okxPassphrase } = await req.json();

    if (!userId || !okxApiKey || !okxSecretKey || !okxPassphrase) {
      throw new Error('Credenciais OKX incompletas');
    }

    console.log('🔄 Iniciando sincronização completa de saldos OKX...');

    // Buscar Trading Account
    const tradingBalances = await getOKXTradingBalances(okxApiKey, okxSecretKey, okxPassphrase);
    console.log(`✅ Trading Account: ${tradingBalances.length} ativos encontrados`);

    // Buscar Funding Account
    const fundingBalances = await getOKXFundingBalances(okxApiKey, okxSecretKey, okxPassphrase);
    console.log(`✅ Funding Account: ${fundingBalances.length} ativos encontrados`);

    // Combinar saldos
    const combinedBalances = combineBalances(tradingBalances, fundingBalances);
    console.log(`📊 Total combinado: ${combinedBalances.length} ativos únicos`);

    // Sincronizar com banco de dados
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Limpar saldos antigos da OKX para este usuário
    console.log('🧹 Limpando registros antigos da OKX...');
    await supabase
      .from('portfolios')
      .delete()
      .eq('user_id', userId)
      .eq('exchange', 'OKX');

    // Inserir saldos separados por conta (Trading e Funding)
    const recordsToInsert: any[] = [];

    for (const balance of combinedBalances) {
      // Se está apenas na Trading
      if (balance.accounts.includes('Trading') && !balance.accounts.includes('Funding')) {
        recordsToInsert.push({
          user_id: userId,
          symbol: balance.symbol,
          exchange: 'OKX',
          balance: balance.trading,
          locked_balance: 0,
          price_usd: 0,
          value_usd: 0,
          application_title: 'Real Balance - OKX Trading',
          updated_at: new Date().toISOString()
        });
      }
      // Se está apenas na Funding
      else if (balance.accounts.includes('Funding') && !balance.accounts.includes('Trading')) {
        recordsToInsert.push({
          user_id: userId,
          symbol: balance.symbol,
          exchange: 'OKX',
          balance: balance.funding,
          locked_balance: 0,
          price_usd: 0,
          value_usd: 0,
          application_title: 'Real Balance - OKX Funding',
          updated_at: new Date().toISOString()
        });
      }
      // Se está em ambas, inserir DOIS registros separados
      else if (balance.accounts.includes('Trading') && balance.accounts.includes('Funding')) {
        // Trading
        if (balance.trading > 0) {
          recordsToInsert.push({
            user_id: userId,
            symbol: balance.symbol,
            exchange: 'OKX',
            balance: balance.trading,
            locked_balance: 0,
            price_usd: 0,
            value_usd: 0,
            application_title: 'Real Balance - OKX Trading',
            updated_at: new Date().toISOString()
          });
        }
        // Funding
        if (balance.funding > 0) {
          recordsToInsert.push({
            user_id: userId,
            symbol: balance.symbol,
            exchange: 'OKX',
            balance: balance.funding,
            locked_balance: 0,
            price_usd: 0,
            value_usd: 0,
            application_title: 'Real Balance - OKX Funding',
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    console.log(`💾 Inserindo ${recordsToInsert.length} registros separados no banco...`);
    
    if (recordsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('portfolios')
        .insert(recordsToInsert);

      if (insertError) {
        console.error('❌ Erro ao inserir saldos:', insertError);
        throw insertError;
      }
    }

    console.log('✅ Sincronização completa realizada com sucesso');

    // Calcular resumo para retorno
    const summary = {
      trading_only: combinedBalances.filter(b => b.accounts.includes('Trading') && !b.accounts.includes('Funding')).length,
      funding_only: combinedBalances.filter(b => b.accounts.includes('Funding') && !b.accounts.includes('Trading')).length,
      both_accounts: combinedBalances.filter(b => b.accounts.includes('Trading') && b.accounts.includes('Funding')).length,
      total_unique: combinedBalances.length,
      total_records: recordsToInsert.length
    };

    return new Response(JSON.stringify({
      success: true,
      trading: tradingBalances,
      funding: fundingBalances,
      combined: combinedBalances,
      summary,
      message: `${summary.total_records} registros sincronizados (${summary.trading_only} Trading, ${summary.funding_only} Funding, ${summary.both_accounts} em ambas)`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function getOKXTradingBalances(apiKey: string, secretKey: string, passphrase: string) {
  const timestamp = new Date().toISOString();
  const method = 'GET';
  const requestPath = '/api/v5/account/balance';
  
  const prehash = timestamp + method + requestPath;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signatureBase64,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Erro ao buscar Trading Account');
  }
  
  const data = await response.json();
  const details = data.data?.[0]?.details || [];
  
  return details
    .filter((d: any) => parseFloat(d.availBal || '0') > 0 || parseFloat(d.frozenBal || '0') > 0)
    .map((d: any) => ({
      symbol: d.ccy,
      balance: parseFloat(d.availBal || '0') + parseFloat(d.frozenBal || '0'),
      account: 'Trading'
    }));
}

async function getOKXFundingBalances(apiKey: string, secretKey: string, passphrase: string) {
  const timestamp = new Date().toISOString();
  const method = 'GET';
  const requestPath = '/api/v5/asset/balances';
  
  const prehash = timestamp + method + requestPath;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(prehash));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://www.okx.com${requestPath}`, {
    method: 'GET',
    headers: {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signatureBase64,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Erro ao buscar Funding Account');
  }
  
  const data = await response.json();
  const details = data.data || [];
  
  return details
    .filter((d: any) => parseFloat(d.availBal || '0') > 0 || parseFloat(d.frozenBal || '0') > 0)
    .map((d: any) => ({
      symbol: d.ccy,
      balance: parseFloat(d.availBal || '0') + parseFloat(d.frozenBal || '0'),
      account: 'Funding'
    }));
}

function combineBalances(trading: any[], funding: any[]) {
  const combined = new Map();
  
  // Adicionar saldos da Trading
  for (const t of trading) {
    combined.set(t.symbol, {
      symbol: t.symbol,
      trading: t.balance,
      funding: 0,
      total: t.balance,
      accounts: ['Trading']
    });
  }
  
  // Adicionar/combinar saldos da Funding
  for (const f of funding) {
    if (combined.has(f.symbol)) {
      const existing = combined.get(f.symbol);
      existing.funding = f.balance;
      existing.total += f.balance;
      existing.accounts.push('Funding');
    } else {
      combined.set(f.symbol, {
        symbol: f.symbol,
        trading: 0,
        funding: f.balance,
        total: f.balance,
        accounts: ['Funding']
      });
    }
  }
  
  return Array.from(combined.values());
}
