import { supabase } from '@/integrations/supabase/client';
import type { HFTTradeRecord, TriangularTradeRecord } from '@/types/hft';

/**
 * Salva um trade HFT executado no banco de dados
 */
export async function saveHFTTrade(trade: Omit<HFTTradeRecord, 'id' | 'created_at'>) {
  try {
    const { data, error } = await supabase
      .from('hft_trades' as any)
      .insert(trade as any)
      .select()
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error saving HFT trade:', error);
    return { success: false, error };
  }
}

/**
 * Busca trades HFT do usuário
 */
export async function getHFTTrades(userId: string, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('hft_trades' as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching HFT trades:', error);
    return { success: false, error, data: [] };
  }
}

/**
 * Salva um trade triangular executado no banco de dados
 */
export async function saveTriangularTrade(trade: Omit<TriangularTradeRecord, 'id' | 'created_at'>) {
  try {
    const { data, error } = await supabase
      .from('triangular_trades' as any)
      .insert(trade as any)
      .select()
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error saving triangular trade:', error);
    return { success: false, error };
  }
}

/**
 * Busca trades triangulares do usuário
 */
export async function getTriangularTrades(userId: string, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('triangular_trades' as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching triangular trades:', error);
    return { success: false, error, data: [] };
  }
}

/**
 * Atualiza o status de um trade HFT
 */
export async function updateHFTTradeStatus(
  tradeId: string,
  status: 'pending' | 'completed' | 'failed',
  errorMessage?: string
) {
  try {
    const updateData: any = {
      status,
      error_message: errorMessage,
    };
    
    if (status === 'completed') {
      updateData.executed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('hft_trades' as any)
      .update(updateData)
      .eq('id', tradeId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating HFT trade status:', error);
    return { success: false, error };
  }
}

/**
 * Busca estatísticas de trades HFT
 */
export async function getHFTStats(userId: string) {
  try {
    const { data, error } = await supabase
      .from('hft_trades' as any)
      .select('net_profit, status')
      .eq('user_id', userId);

    if (error) throw error;

    const trades = data || [];
    const stats = {
      totalTrades: trades.length,
      completedTrades: trades.filter((t: any) => t.status === 'completed').length,
      failedTrades: trades.filter((t: any) => t.status === 'failed').length,
      totalProfit: trades.reduce((sum: number, t: any) => sum + (Number(t.net_profit) || 0), 0),
      avgProfit: 0,
    };

    if (stats.completedTrades > 0) {
      const completedTrades = trades.filter((t: any) => t.status === 'completed');
      stats.avgProfit = completedTrades.reduce((sum: number, t: any) => sum + (Number(t.net_profit) || 0), 0) / stats.completedTrades;
    }

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error fetching HFT stats:', error);
    return { success: false, error };
  }
}

/**
 * Busca estatísticas de trades triangulares
 */
export async function getTriangularStats(userId: string) {
  try {
    const { data, error } = await supabase
      .from('triangular_trades' as any)
      .select('net_profit_usd, status')
      .eq('user_id', userId);

    if (error) throw error;

    const trades = data || [];
    const stats = {
      totalTrades: trades.length,
      completedTrades: trades.filter((t: any) => t.status === 'completed').length,
      failedTrades: trades.filter((t: any) => t.status === 'failed').length,
      totalProfit: trades.reduce((sum: number, t: any) => sum + (Number(t.net_profit_usd) || 0), 0),
      avgProfit: 0,
    };

    if (stats.completedTrades > 0) {
      const completedTrades = trades.filter((t: any) => t.status === 'completed');
      stats.avgProfit = completedTrades.reduce((sum: number, t: any) => sum + (Number(t.net_profit_usd) || 0), 0) / stats.completedTrades;
    }

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error fetching triangular stats:', error);
    return { success: false, error };
  }
}
