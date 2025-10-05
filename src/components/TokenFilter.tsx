import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface TokenInfo {
  symbol: string;
  name: string;
  trend: 'up' | 'down' | 'neutral';
  change24h: number;
}

const TOP_TOKENS: TokenInfo[] = [
  { symbol: 'BTC', name: 'Bitcoin', trend: 'up', change24h: 2.5 },
  { symbol: 'ETH', name: 'Ethereum', trend: 'up', change24h: 3.2 },
  { symbol: 'BNB', name: 'Binance Coin', trend: 'up', change24h: 1.8 },
  { symbol: 'SOL', name: 'Solana', trend: 'up', change24h: 4.1 },
  { symbol: 'XRP', name: 'Ripple', trend: 'neutral', change24h: 0.5 },
  { symbol: 'ADA', name: 'Cardano', trend: 'up', change24h: 2.1 },
  { symbol: 'AVAX', name: 'Avalanche', trend: 'up', change24h: 3.5 },
  { symbol: 'DOT', name: 'Polkadot', trend: 'neutral', change24h: -0.3 },
  { symbol: 'MATIC', name: 'Polygon', trend: 'up', change24h: 2.8 },
  { symbol: 'ATOM', name: 'Cosmos', trend: 'up', change24h: 1.9 },
];

interface TokenFilterProps {
  selectedToken: string;
  onTokenChange: (token: string) => void;
  showOnlyUptrend?: boolean;
}

export const TokenFilter = ({ 
  selectedToken, 
  onTokenChange,
  showOnlyUptrend = false 
}: TokenFilterProps) => {
  const [tokens, setTokens] = useState<TokenInfo[]>(TOP_TOKENS);

  useEffect(() => {
    if (showOnlyUptrend) {
      setTokens(TOP_TOKENS.filter(t => t.trend === 'up'));
    } else {
      setTokens(TOP_TOKENS);
    }
  }, [showOnlyUptrend]);

  const selectedTokenInfo = tokens.find(t => t.symbol === selectedToken);

  return (
    <div className="space-y-2">
      <Select value={selectedToken} onValueChange={onTokenChange}>
        <SelectTrigger className="w-full bg-background">
          <SelectValue placeholder="Selecionar token" />
        </SelectTrigger>
        <SelectContent className="bg-background border z-50">
          {tokens.map((token) => (
            <SelectItem 
              key={token.symbol} 
              value={token.symbol}
              className="cursor-pointer hover:bg-muted"
            >
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{token.symbol}</span>
                  <span className="text-xs text-muted-foreground">{token.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {token.trend === 'up' && (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-500">+{token.change24h}%</span>
                    </>
                  )}
                  {token.trend === 'down' && (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      <span className="text-xs text-red-500">{token.change24h}%</span>
                    </>
                  )}
                  {token.trend === 'neutral' && (
                    <span className="text-xs text-muted-foreground">{token.change24h}%</span>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedTokenInfo && (
        <div className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{selectedTokenInfo.name}</span>
            {selectedTokenInfo.trend === 'up' && (
              <Badge className="bg-green-500 text-white gap-1">
                <TrendingUp className="h-3 w-3" />
                Alta
              </Badge>
            )}
            {selectedTokenInfo.trend === 'down' && (
              <Badge variant="destructive" className="gap-1">
                <TrendingDown className="h-3 w-3" />
                Baixa
              </Badge>
            )}
            {selectedTokenInfo.trend === 'neutral' && (
              <Badge variant="secondary">
                Neutro
              </Badge>
            )}
          </div>
          <span className={`text-sm font-semibold ${
            selectedTokenInfo.change24h > 0 ? 'text-green-500' : 
            selectedTokenInfo.change24h < 0 ? 'text-red-500' : 
            'text-muted-foreground'
          }`}>
            {selectedTokenInfo.change24h > 0 ? '+' : ''}{selectedTokenInfo.change24h}%
          </span>
        </div>
      )}
    </div>
  );
};
