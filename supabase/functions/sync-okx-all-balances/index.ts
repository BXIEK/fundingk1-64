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

    // Deletar registros antigos do usuário na OKX (todas as variações) antes de inserir novos
    const { error: deleteError } = await supabase
      .from('portfolios')
      .delete()
      .eq('user_id', userId)
      .in('exchange', ['OKX', 'OKX-Trading', 'OKX-Funding']);
    
    if (deleteError) {
      console.error('❌ Erro ao limpar registros antigos:', deleteError);
    } else {
      console.log('✅ Registros antigos da OKX removidos');
    }

    // Buscar preços atuais da Binance para cálculo do value_usd
    const priceResponse = await fetch('https://api.binance.com/api/v3/ticker/price');
    const prices = await priceResponse.json();
    const priceMap = new Map();
    for (const p of prices) {
      const symbol = p.symbol.replace('USDT', '');
      priceMap.set(symbol, parseFloat(p.price));
    }
    console.log(`💰 Preços carregados para ${priceMap.size} símbolos`);

    // Inserir registros separados para Trading e Funding COM PREÇOS ATUALIZADOS
    // IMPORTANTE: Usar exchange diferente para evitar constraint violation
    const insertPromises = [];
    for (const balance of combinedBalances) {
      const priceUsd = priceMap.get(balance.symbol) || 0;
      
      // Se tem saldo em Trading, inserir registro de Trading
      if (balance.trading > 0) {
        const valueUsd = balance.trading * priceUsd;
        console.log(`  💰 ${balance.symbol} Trading: ${balance.trading} × $${priceUsd} = $${valueUsd.toFixed(2)}`);
        
        insertPromises.push(
          supabase
            .from('portfolios')
            .insert({
              user_id: userId,
              symbol: balance.symbol,
              exchange: 'OKX-Trading',  // Evita constraint violation
              balance: balance.trading,
              locked_balance: 0,
              price_usd: priceUsd,
              value_usd: valueUsd,
              application_title: 'OKX (Trading)',
              updated_at: new Date().toISOString()
            })
        );
      }
      
      // Se tem saldo em Funding, inserir registro de Funding
      if (balance.funding > 0) {
        const valueUsd = balance.funding * priceUsd;
        console.log(`  💰 ${balance.symbol} Funding: ${balance.funding} × $${priceUsd} = $${valueUsd.toFixed(2)}`);
        
        insertPromises.push(
          supabase
            .from('portfolios')
            .insert({
              user_id: userId,
              symbol: balance.symbol,
              exchange: 'OKX-Funding',  // Evita constraint violation
              balance: balance.funding,
              locked_balance: 0,
              price_usd: priceUsd,
              value_usd: valueUsd,
              application_title: 'OKX (Funding)',
              updated_at: new Date().toISOString()
            })
        );
      }
    }
    
    // Executar todas as inserções em paralelo
    await Promise.all(insertPromises);
    console.log(`✅ ${insertPromises.length} registros inseridos no banco de dados`);

    console.log('✅ Sincronização completa realizada com sucesso');

    // Calcular resumo para retorno
    const summary = {
      trading_only: combinedBalances.filter(b => b.accounts.includes('Trading') && !b.accounts.includes('Funding')).length,
      funding_only: combinedBalances.filter(b => b.accounts.includes('Funding') && !b.accounts.includes('Trading')).length,
      both_accounts: combinedBalances.filter(b => b.accounts.includes('Trading') && b.accounts.includes('Funding')).length,
      total_unique: combinedBalances.length,
      total_records: combinedBalances.length
    };

    return new Response(JSON.stringify({
      success: true,
      trading: tradingBalances,
      funding: fundingBalances,
      combined: combinedBalances,
      summary,
      message: `${summary.total_records} ativos sincronizados (${summary.trading_only} só Trading, ${summary.funding_only} só Funding, ${summary.both_accounts} em ambas)`
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
    const errorText = await response.text();
    console.error('❌ Erro ao buscar Trading Account:', errorText);
    throw new Error('Erro ao buscar Trading Account');
  }
  
  const data = await response.json();
  console.log('📊 Trading Account response:', JSON.stringify(data, null, 2));
  
  const details = data.data?.[0]?.details || [];
  console.log(`✅ Trading Account: ${details.length} ativos brutos encontrados`);
  
  const filtered = details.filter((d: any) => {
    const avail = parseFloat(d.availBal || '0');
    const frozen = parseFloat(d.frozenBal || '0');
    const cash = parseFloat(d.cashBal || '0');
    const total = avail + frozen;
    
    console.log(`  - ${d.ccy}: availBal=${avail}, frozenBal=${frozen}, cashBal=${cash}, total=${total}`);
    
    return total > 0;
  });
  
  return filtered.map((d: any) => ({
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
    const errorText = await response.text();
    console.error('❌ Erro ao buscar Funding Account:', errorText);
    throw new Error('Erro ao buscar Funding Account');
  }
  
  const data = await response.json();
  console.log('📊 Funding Account response:', JSON.stringify(data, null, 2));
  
  const details = data.data || [];
  console.log(`✅ Funding Account: ${details.length} ativos brutos encontrados`);
  
  const filtered = details.filter((d: any) => {
    const avail = parseFloat(d.availBal || '0');
    const frozen = parseFloat(d.frozenBal || '0');
    const total = avail + frozen;
    
    console.log(`  - ${d.ccy}: availBal=${avail}, frozenBal=${frozen}, total=${total}`);
    
    return total > 0;
  });
  
  return filtered.map((d: any) => ({
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
