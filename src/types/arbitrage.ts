export interface ArbitrageOpportunity {
  id: string;
  symbol: string;
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  spread: number;
  potential: number;
  risk_level: string;
  last_updated: string;
  // Additional properties for compatibility
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  riskLevel: string;
  spreadPercentage: number;
  liquidityBuy: number;
  liquiditySell: number;
  netProfitUsd: number;
  expiresAt: string;
  gasFeeEstimate: number;
  executionTimeEstimate: number;
}