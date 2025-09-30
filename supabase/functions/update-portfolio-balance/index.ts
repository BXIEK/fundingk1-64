// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== UPDATE-PORTFOLIO-BALANCE INICIADO ===');
  console.log('Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('Retornando CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Inicializando cliente Supabase...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fazendo parse do body da requisição...');
    const { user_id, symbol, amount_change, exchange } = await req.json();
    
    console.log('Request data recebida:', {
      user_id,
      symbol,
      amount_change,
      exchange,
      type: typeof amount_change
    });
    
    // Validar dados da requisição
    if (!user_id || !symbol || amount_change === undefined || amount_change === null) {
      throw new Error('Dados incompletos: user_id, symbol e amount_change são obrigatórios');
    }
    
    // Converter amount_change para número se for string
    const numericAmount = typeof amount_change === 'string' ? parseFloat(amount_change) : amount_change;
    
    if (isNaN(numericAmount)) {
      throw new Error('amount_change deve ser um número válido');
    }
    
    console.log(`Atualizando saldo: ${symbol} ${numericAmount > 0 ? '+' : ''}${numericAmount} para usuário ${user_id} na exchange ${exchange || 'GLOBAL'}`);
    
    // Chamar função do banco para atualizar saldo
    const { data, error } = await supabase.rpc('update_portfolio_balance', {
      p_user_id: user_id,
      p_symbol: symbol,
      p_amount_change: numericAmount,
      p_exchange: exchange || 'GLOBAL'
    });
    
    if (error) {
      console.error('Erro na função update_portfolio_balance:', error);
      throw new Error(`Erro ao atualizar saldo: ${error.message}`);
    }
    
    console.log('Saldo atualizado com sucesso');
    
    // Buscar saldo atualizado para confirmar
    const { data: portfolioData, error: portfolioError } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', user_id)
      .eq('symbol', symbol)
      .eq('exchange', exchange || 'GLOBAL');
    
    if (portfolioError) {
      console.warn('Aviso: Não foi possível buscar saldo atualizado:', portfolioError);
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `Saldo de ${symbol} atualizado com sucesso`,
      data: {
        user_id,
        symbol,
        exchange: exchange || 'GLOBAL',
        amount_change: numericAmount,
        updated_portfolio: portfolioData?.[0] || null
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na atualização de saldo:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});