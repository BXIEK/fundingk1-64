import { useState, useCallback, useRef } from 'react';
import { LogEntry } from '@/components/RealtimeLogger';

export const useRealtimeLogger = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logCounterRef = useRef(0);

  const addLog = useCallback((
    level: LogEntry['level'],
    message: string,
    options?: {
      details?: any;
      operation?: string;
      exchange?: string;
      symbol?: string;
      duration?: number;
    }
  ) => {
    const newLog: LogEntry = {
      id: `log_${Date.now()}_${logCounterRef.current++}`,
      timestamp: new Date(),
      level,
      message,
      ...options
    };

    setLogs(prev => [...prev, newLog]);
  }, []);

  const addOperationLog = useCallback((
    operation: string,
    stage: 'start' | 'progress' | 'success' | 'error',
    message: string,
    options?: {
      details?: any;
      exchange?: string;
      symbol?: string;
      duration?: number;
    }
  ) => {
    let level: LogEntry['level'];
    let formattedMessage: string;

    switch (stage) {
      case 'start':
        level = 'info';
        formattedMessage = `🚀 Iniciando: ${message}`;
        break;
      case 'progress':
        level = 'info';
        formattedMessage = `⏳ Em andamento: ${message}`;
        break;
      case 'success':
        level = 'success';
        formattedMessage = `✅ Sucesso: ${message}`;
        break;
      case 'error':
        level = 'error';
        formattedMessage = `❌ Erro: ${message}`;
        break;
    }

    addLog(level, formattedMessage, {
      operation,
      ...options
    });
  }, [addLog]);

  const addTradeLog = useCallback((
    exchange: string,
    symbol: string,
    action: 'buy' | 'sell',
    amount: number,
    price: number,
    status: 'pending' | 'filled' | 'failed',
    options?: {
      details?: any;
      duration?: number;
    }
  ) => {
    let level: LogEntry['level'];
    let message: string;

    switch (status) {
      case 'pending':
        level = 'info';
        message = `📝 Ordem ${action.toUpperCase()}: ${amount} ${symbol} por ${price} USDT`;
        break;
      case 'filled':
        level = 'success';
        message = `💰 Ordem ${action.toUpperCase()} executada: ${amount} ${symbol} por ${price} USDT`;
        break;
      case 'failed':
        level = 'error';
        message = `🚫 Falha na ordem ${action.toUpperCase()}: ${amount} ${symbol} por ${price} USDT`;
        break;
    }

    addLog(level, message, {
      operation: 'trade',
      exchange,
      symbol,
      ...options
    });
  }, [addLog]);

  const addArbitrageLog = useCallback((
    symbol: string,
    buyExchange: string,
    sellExchange: string,
    spread: number,
    profit: number,
    status: 'detected' | 'analyzing' | 'executing' | 'completed' | 'failed',
    options?: {
      details?: any;
      duration?: number;
    }
  ) => {
    let level: LogEntry['level'];
    let message: string;

    switch (status) {
      case 'detected':
        level = 'info';
        message = `🔍 Oportunidade detectada: ${symbol} (${spread.toFixed(2)}% spread)`;
        break;
      case 'analyzing':
        level = 'info';
        message = `📊 Analisando viabilidade: ${symbol} entre ${buyExchange} e ${sellExchange}`;
        break;
      case 'executing':
        level = 'trade';
        message = `⚡ Executando arbitragem: ${symbol} (${buyExchange} → ${sellExchange})`;
        break;
      case 'completed':
        level = 'success';
        message = `🎯 Arbitragem concluída: ${symbol} - Lucro: $${profit.toFixed(2)}`;
        break;
      case 'failed':
        level = 'error';
        message = `⚠️ Arbitragem falhou: ${symbol}`;
        break;
    }

    addLog(level, message, {
      operation: 'arbitrage',
      symbol,
      details: {
        buyExchange,
        sellExchange,
        spread: `${spread.toFixed(2)}%`,
        expectedProfit: `$${profit.toFixed(2)}`
      },
      ...options
    });
  }, [addLog]);

  const addConnectionLog = useCallback((
    exchange: string,
    status: 'connecting' | 'connected' | 'disconnected' | 'error',
    message?: string,
    options?: {
      details?: any;
    }
  ) => {
    let level: LogEntry['level'];
    let formattedMessage: string;

    switch (status) {
      case 'connecting':
        level = 'info';
        formattedMessage = `🔌 Conectando com ${exchange}...`;
        break;
      case 'connected':
        level = 'success';
        formattedMessage = `✅ Conectado com ${exchange}`;
        break;
      case 'disconnected':
        level = 'warning';
        formattedMessage = `⚠️ Desconectado de ${exchange}`;
        break;
      case 'error':
        level = 'error';
        formattedMessage = `❌ Erro de conexão com ${exchange}${message ? `: ${message}` : ''}`;
        break;
    }

    addLog(level, formattedMessage, {
      operation: 'connection',
      exchange,
      ...options
    });
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    logCounterRef.current = 0;
  }, []);

  return {
    logs,
    addLog,
    addOperationLog,
    addTradeLog,
    addArbitrageLog,
    addConnectionLog,
    clearLogs
  };
};