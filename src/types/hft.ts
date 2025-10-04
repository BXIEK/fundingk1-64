// HFT Trading Types
export interface HFTOpportunity {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  netProfit: number;
  timestamp: number;
}

export interface ExchangePrice {
  exchange: string;
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
}

export interface SymbolPrices {
  symbol: string;
  prices: ExchangePrice[];
}

export interface ExecutedTrade {
  opportunity: HFTOpportunity;
  timestamp: number;
  result: {
    success: boolean;
    buyOrder?: {
      orderId: string;
      executedPrice: number;
      executedQty: number;
    };
    sellOrder?: {
      orderId: string;
      executedPrice: number;
      executedQty: number;
    };
    actualProfit?: number;
    error?: string;
  };
}

export interface HFTData {
  opportunities: HFTOpportunity[];
  prices: SymbolPrices[];
  executedTrades: ExecutedTrade[];
  activeTrades: number;
  autoExecuteEnabled: boolean;
  timestamp: number;
  iteration: number;
}

// Triangular Arbitrage Types
export interface TriangularOpportunity {
  id: string;
  cycle: string[];
  exchange: string;
  profitPercentage: number;
  netProfitUsd: number;
  prices: Record<string, number>;
  timestamp: number;
}

export interface TriangularData {
  opportunities: TriangularOpportunity[];
  prices: ExchangePrice[];
  timestamp: number;
}

// Database types for persisting trades
export interface HFTTradeRecord {
  id?: string;
  user_id: string;
  symbol: string;
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  spread_percentage: number;
  trade_amount: number;
  net_profit: number;
  status: 'pending' | 'completed' | 'failed';
  executed_at?: string;
  error_message?: string;
  created_at?: string;
}

export interface TriangularTradeRecord {
  id?: string;
  user_id: string;
  cycle: string[];
  exchange: string;
  profit_percentage: number;
  net_profit_usd: number;
  prices: Record<string, number>;
  trade_amount: number;
  status: 'pending' | 'completed' | 'failed';
  executed_at?: string;
  error_message?: string;
  created_at?: string;
}
