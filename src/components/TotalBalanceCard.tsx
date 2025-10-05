import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  TrendingUp, 
  TrendingDown, 
  PiggyBank,
  Minus,
  Zap,
  RefreshCw,
  ArrowRightLeft,
  Repeat
} from 'lucide-react';

interface TotalBalanceCardProps {
  binanceBalance: number;
  okxBalance: number;
  totalBaseline?: number;
  selectedToken?: string;
}

interface PriceData {
  binance: number;
  okx: number;
  spread: number;
}

interface TokenSpreadData {
  symbol: string;
  binancePrice: number;
  okxPrice: number;
  spread: number;
  absSpread: number;
}

interface TokenBalance {
  symbol: string;
  balance: number;
  valueUsd: number;
  priceUsd: number;
  exchange: string;
}

export const TotalBalanceCard = ({ 
  binanceBalance, 
  okxBalance,
  totalBaseline = 200,
  selectedToken: externalSelectedToken
}: TotalBalanceCardProps) => {
  const [autoConvertEnabled, setAutoConvertEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [internalSelectedToken, setInternalSelectedToken] = useState<string>('SOL');
  
  // Usar token externo se fornecido, senão usar interno
  const selectedToken = externalSelectedToken || internalSelectedToken;

  // Sincronizar token externo com interno quando mudar
  useEffect(() => {
    if (externalSelectedToken && externalSelectedToken !== internalSelectedToken) {
      console.log(`🔄 Sincronizando token para ${externalSelectedToken} no Total Balance`);
      setInternalSelectedToken(externalSelectedToken);
    }
  }, [externalSelectedToken]);
  const [tokenPrices, setTokenPrices] = useState<PriceData>({ binance: 0, okx: 0, spread: 0 });
  const [lastExecution, setLastExecution] = useState<string>('');
  const [binanceTokens, setBinanceTokens] = useState<TokenBalance[]>([]);
  const [okxTokens, setOkxTokens] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [activeTab, setActiveTab] = useState<'binance' | 'okx'>('binance');
  const [bestToken, setBestToken] = useState<TokenSpreadData | null>(null);

  // Lista de tokens disponíveis para conversão automática
  const availableTokens = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOT', 'LINK', 'UNI', 'AVAX'];

  // Helper para salvar conversões no histórico
  const saveConversionRecord = async (params: {
    fromToken: string;
    toToken: string;
    fromAmount: number;
    toAmount: number;
    exchange: string;
    conversionType: 'market' | 'limit';
    price: number;
    status: 'success' | 'failed';
    errorMessage?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('conversion_history').insert({
        user_id: user.id,
        from_token: params.fromToken,
        to_token: params.toToken,
        from_amount: params.fromAmount,
        to_amount: params.toAmount,
        exchange: params.exchange,
        conversion_type: params.conversionType,
        price: params.price,
        status: params.status,
        error_message: params.errorMessage
      });
    } catch (error) {
      console.error('Erro ao salvar registro de conversão:', error);
    }
  };

  const totalValue = binanceBalance + okxBalance;
  const profitLoss = totalValue - totalBaseline;
  const profitLossPercent = totalBaseline > 0 ? (profitLoss / totalBaseline) * 100 : 0;
  const isProfit = profitLoss > 0;
  const isLoss = profitLoss < 0;

  // Buscar tokens de ambas as exchanges
  const fetchAllTokens = async () => {
    setLoadingTokens(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: portfolioData, error } = await supabase.functions.invoke('get-portfolio', {
        body: { 
          user_id: user.id,
          real_mode: true,
          force_refresh: false
        }
      });

      if (error) throw error;

      if (!portfolioData?.success || !portfolioData?.data?.portfolio) {
        return;
      }

      // Filtrar tokens por exchange
      const binanceItems = portfolioData.data.portfolio
        .filter((item: any) => item.exchange === 'Binance' && item.balance > 0)
        .map((item: any) => ({
          symbol: item.symbol,
          balance: parseFloat(item.balance),
          valueUsd: parseFloat(item.value_usd_calculated || item.value_usd || 0),
          priceUsd: parseFloat(item.price_usd || 0),
          exchange: 'Binance'
        }));

      const okxItems = portfolioData.data.portfolio
        .filter((item: any) => item.exchange === 'OKX' && item.balance > 0)
        .map((item: any) => ({
          symbol: item.symbol,
          balance: parseFloat(item.balance),
          valueUsd: parseFloat(item.value_usd_calculated || item.value_usd || 0),
          priceUsd: parseFloat(item.price_usd || 0),
          exchange: 'OKX'
        }));

      setBinanceTokens(binanceItems);
      setOkxTokens(okxItems);
    } catch (error) {
      console.error('Erro ao buscar tokens:', error);
    } finally {
      setLoadingTokens(false);
    }
  };

  // Atualizar tokens periodicamente
  useEffect(() => {
    fetchAllTokens();
    const interval = setInterval(fetchAllTokens, 60000); // A cada 60s
    return () => clearInterval(interval);
  }, []);

  // Acionar conversões quando token externo mudar OU quando o componente montar
  useEffect(() => {
    if (externalSelectedToken && externalSelectedToken !== 'USDT' && !isProcessing) {
      console.log(`🔄 Verificando tokens para ${externalSelectedToken}, iniciando limpeza de tokens indesejados...`);
      
      const convertOldTokensAndBuyNew = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Buscar credenciais
          const { data: binanceCreds } = await supabase
            .from('exchange_api_configs')
            .select('*')
            .eq('user_id', user.id)
            .eq('exchange', 'binance')
            .eq('is_active', true)
            .maybeSingle();

          const { data: okxCreds } = await supabase
            .from('exchange_api_configs')
            .select('*')
            .eq('user_id', user.id)
            .eq('exchange', 'okx')
            .eq('is_active', true)
            .maybeSingle();

          if (!binanceCreds || !okxCreds) {
            console.log('⚠️ Credenciais não encontradas');
            return;
          }

          // Buscar todos os tokens atuais
          const { data: portfolioData } = await supabase.functions.invoke('get-portfolio', {
            body: { user_id: user.id, real_mode: true, force_refresh: true }
          });

          if (!portfolioData?.success) return;

          const portfolio = portfolioData.data.portfolio;
          
          // CRÍTICO: Filtrar TODOS os tokens diferentes do selecionado e USDT (incluindo BTC)
          const binanceOldTokens = portfolio.filter((i: any) => 
            i.exchange === 'Binance' && 
            i.symbol !== 'USDT' && 
            i.symbol !== externalSelectedToken &&
            parseFloat(i.balance) > 0
          );
          
          const okxOldTokens = portfolio.filter((i: any) => 
            i.exchange === 'OKX' && 
            i.symbol !== 'USDT' && 
            i.symbol !== externalSelectedToken &&
            parseFloat(i.balance) > 0
          );

          console.log(`🔍 Tokens a limpar - Binance: ${binanceOldTokens.map((t: any) => t.symbol).join(', ') || 'nenhum'}`);
          console.log(`🔍 Tokens a limpar - OKX: ${okxOldTokens.map((t: any) => t.symbol).join(', ') || 'nenhum'}`);

          // Alerta especial se BTC for detectado
          const btcInBinance = binanceOldTokens.find((t: any) => t.symbol === 'BTC');
          const btcInOkx = okxOldTokens.find((t: any) => t.symbol === 'BTC');
          if (btcInBinance || btcInOkx) {
            console.log(`🚨 BTC DETECTADO! Será convertido para USDT.`);
            if (btcInBinance) console.log(`   - Binance: ${btcInBinance.balance} BTC`);
            if (btcInOkx) console.log(`   - OKX: ${btcInOkx.balance} BTC`);
          }

          // Se houver tokens antigos, converter para USDT
          if (binanceOldTokens.length > 0 || okxOldTokens.length > 0) {
            console.log(`🧹 LIMPEZA: Convertendo ${binanceOldTokens.length + okxOldTokens.length} tokens indesejados para USDT...`);
            
            // Converter tokens antigos da Binance
            for (const token of binanceOldTokens) {
              try {
                console.log(`🔄 Convertendo ${token.symbol} → USDT na Binance...`);
                const { data: result } = await supabase.functions.invoke('binance-swap-token', {
                  body: {
                    apiKey: binanceCreds.api_key,
                    secretKey: binanceCreds.secret_key,
                    symbol: token.symbol,
                    direction: 'toUsdt',
                    orderType: 'market'
                  }
                });
                
                if (result?.success) {
                  await saveConversionRecord({
                    fromToken: token.symbol,
                    toToken: 'USDT',
                    fromAmount: token.balance,
                    toAmount: result.usdtReceived || 0,
                    exchange: 'Binance',
                    conversionType: 'market',
                    price: result.price || 0,
                    status: 'success'
                  });
                  console.log(`✅ ${token.symbol} convertido na Binance`);
                }
              } catch (err) {
                await saveConversionRecord({
                  fromToken: token.symbol,
                  toToken: 'USDT',
                  fromAmount: token.balance,
                  toAmount: 0,
                  exchange: 'Binance',
                  conversionType: 'market',
                  price: 0,
                  status: 'failed',
                  errorMessage: err instanceof Error ? err.message : 'Erro desconhecido'
                });
                console.error(`❌ Erro ao converter ${token.symbol}:`, err);
              }
            }

            // Converter tokens antigos da OKX
            for (const token of okxOldTokens) {
              try {
                console.log(`🔄 Convertendo ${token.symbol} → USDT na OKX...`);
                const { data: result } = await supabase.functions.invoke('okx-swap-token', {
                  body: {
                    apiKey: okxCreds.api_key,
                    secretKey: okxCreds.secret_key,
                    passphrase: okxCreds.passphrase,
                    symbol: token.symbol,
                    direction: 'toUsdt',
                    orderType: 'market'
                  }
                });
                
                if (result?.success) {
                  await saveConversionRecord({
                    fromToken: token.symbol,
                    toToken: 'USDT',
                    fromAmount: token.balance,
                    toAmount: result.usdtReceived || 0,
                    exchange: 'OKX',
                    conversionType: 'market',
                    price: result.price || 0,
                    status: 'success'
                  });
                  console.log(`✅ ${token.symbol} convertido na OKX`);
                }
              } catch (err) {
                await saveConversionRecord({
                  fromToken: token.symbol,
                  toToken: 'USDT',
                  fromAmount: token.balance,
                  toAmount: 0,
                  exchange: 'OKX',
                  conversionType: 'market',
                  price: 0,
                  status: 'failed',
                  errorMessage: err instanceof Error ? err.message : 'Erro desconhecido'
                });
                console.error(`❌ Erro ao converter ${token.symbol}:`, err);
              }
            }

            toast.info(`🧹 Tokens antigos convertidos para USDT`, {
              description: `${binanceOldTokens.length + okxOldTokens.length} tokens limpos. Aguarde para comprar ${externalSelectedToken}...`,
              duration: 5000
            });

            // Aguardar execução das ordens
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          // Buscar preços e executar compra do novo token
          const symbol = `${externalSelectedToken}USDT`;
          const { data: binanceData } = await supabase.functions.invoke('binance-market-data', {
            body: { action: 'tickers', symbols: [symbol] }
          });

          const { data: okxData } = await supabase.functions.invoke('okx-api', {
            body: { action: 'get_prices' }
          });

          if (binanceData?.success && okxData?.success) {
            const binancePrice = binanceData.data?.[symbol]?.lastPrice || binanceData.data?.[symbol]?.price || 0;
            const okxPrice = okxData.data?.[externalSelectedToken] || 0;

            if (binancePrice > 0 && okxPrice > 0) {
              const spread = ((okxPrice - binancePrice) / binancePrice) * 100;
              setTokenPrices({ binance: binancePrice, okx: okxPrice, spread });
              
              console.log(`📊 ${externalSelectedToken} - Binance: $${binancePrice}, OKX: $${okxPrice}, Spread: ${spread.toFixed(3)}%`);
              
              if (Math.abs(spread) > 0.3) {
                console.log(`✅ Executando conversão automática para ${externalSelectedToken}...`);
                await executeAutoConversion(binancePrice, okxPrice, externalSelectedToken);
              } else {
                console.log(`⏸️ Spread insuficiente (${spread.toFixed(3)}%) - aguardando melhor oportunidade`);
              }
            }
          }
        } catch (error) {
          console.error('Erro ao processar mudança de token:', error);
        }
      };

      convertOldTokensAndBuyNew();
    }
  }, [externalSelectedToken]);

  // Monitorar token selecionado e executar conversões automáticas apenas para ele
  useEffect(() => {
    if (!autoConvertEnabled || !selectedToken || selectedToken === 'USDT') return;

    const fetchPricesAndMaybeConvert = async () => {
      try {
        const symbol = `${selectedToken}USDT`;
        const { data: binanceData } = await supabase.functions.invoke('binance-market-data', {
          body: { action: 'tickers', symbols: [symbol] }
        });

        const { data: okxData } = await supabase.functions.invoke('okx-api', {
          body: { action: 'get_prices' }
        });

        if (binanceData?.success && okxData?.success) {
          const binancePrice = binanceData.data?.[symbol]?.lastPrice || binanceData.data?.[symbol]?.price || 0;
          const okxPrice = okxData.data?.[selectedToken] || 0;

          if (binancePrice > 0 && okxPrice > 0) {
            const spread = ((okxPrice - binancePrice) / binancePrice) * 100;
            setTokenPrices({ binance: binancePrice, okx: okxPrice, spread });
            console.log(`🤖 Auto (${selectedToken}) - Binance: $${binancePrice}, OKX: $${okxPrice}, Spread: ${spread.toFixed(3)}%`);

            if (Math.abs(spread) > 0.3 && !isProcessing) {
              await executeAutoConversion(binancePrice, okxPrice, selectedToken);
            }
          }
        }
      } catch (error) {
        console.error('Erro no auto monitoring do token selecionado:', error);
      }
    };

    fetchPricesAndMaybeConvert();
    const interval = setInterval(fetchPricesAndMaybeConvert, 15000);

    return () => clearInterval(interval);
  }, [autoConvertEnabled, isProcessing, selectedToken]);

  // Limpeza periódica: converter qualquer token diferente do selecionado e USDT para USDT (market)
  useEffect(() => {
    if (!selectedToken || selectedToken === 'USDT') return;

    let cancelled = false;
    const runCleanup = async () => {
      if (isProcessing) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data: binanceCreds }, { data: okxCreds }] = await Promise.all([
          supabase
            .from('exchange_api_configs')
            .select('*')
            .eq('user_id', user.id)
            .eq('exchange', 'binance')
            .eq('is_active', true)
            .maybeSingle(),
          supabase
            .from('exchange_api_configs')
            .select('*')
            .eq('user_id', user.id)
            .eq('exchange', 'okx')
            .eq('is_active', true)
            .maybeSingle(),
        ]);

        if (!binanceCreds || !okxCreds) return;

        const { data: portfolioData } = await supabase.functions.invoke('get-portfolio', {
          body: { user_id: user.id, real_mode: true, force_refresh: true }
        });
        if (!portfolioData?.success) return;

        const portfolio = portfolioData.data.portfolio || [];
        const toClean = (exchange: 'Binance'|'OKX') =>
          portfolio.filter((i: any) => i.exchange === exchange && i.symbol !== 'USDT' && i.symbol !== selectedToken && parseFloat(i.balance) > 0);

        const binanceOld = toClean('Binance');
        const okxOld = toClean('OKX');

        if (binanceOld.length === 0 && okxOld.length === 0) return;

        console.log(`🧹 Limpeza periódica: ${[...binanceOld, ...okxOld].map((t:any)=>t.symbol).join(', ')}`);

        for (const token of binanceOld) {
          if (cancelled) return;
          await supabase.functions.invoke('binance-swap-token', {
            body: { apiKey: binanceCreds.api_key, secretKey: binanceCreds.secret_key, symbol: token.symbol, direction: 'toUsdt', orderType: 'market' }
          });
        }

        for (const token of okxOld) {
          if (cancelled) return;
          await supabase.functions.invoke('okx-swap-token', {
            body: { apiKey: okxCreds.api_key, secretKey: okxCreds.secret_key, passphrase: okxCreds.passphrase, symbol: token.symbol, direction: 'toUsdt', orderType: 'market' }
          });
        }
      } catch (e) {
        console.warn('Limpeza periódica falhou:', e);
      }
    };

    runCleanup();
    const interval = setInterval(runCleanup, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedToken, isProcessing]);

  const executeAutoConversion = async (binancePrice: number, okxPrice: number, tokenSymbol?: string) => {
    const token = tokenSymbol || selectedToken;
    setIsProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar credenciais
      const { data: binanceCreds } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', 'binance')
        .eq('is_active', true)
        .maybeSingle();

      const { data: okxCreds } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', 'okx')
        .eq('is_active', true)
        .maybeSingle();

      if (!binanceCreds || !okxCreds) {
        toast.error('⚠️ Credenciais não encontradas', {
          description: 'Configure suas credenciais da Binance e OKX.',
          duration: 5000
        });
        setAutoConvertEnabled(false);
        return;
      }

      // Buscar saldos do token e USDT
      const { data: portfolioData } = await supabase.functions.invoke('get-portfolio', {
        body: { user_id: user.id, real_mode: true, force_refresh: false }
      });

      if (!portfolioData?.success) throw new Error('Erro ao buscar saldos');

      const portfolio = portfolioData.data.portfolio;
      
      // Filtrar saldos por exchange
      const binanceToken = portfolio.find((i: any) => i.exchange === 'Binance' && i.symbol === token);
      const okxToken = portfolio.find((i: any) => i.exchange === 'OKX' && i.symbol === token);
      const binanceUSDT = portfolio.find((i: any) => i.exchange === 'Binance' && i.symbol === 'USDT');
      const okxUSDT = portfolio.find((i: any) => i.exchange === 'OKX' && i.symbol === 'USDT');

      const binanceTokenBalance = binanceToken ? parseFloat(binanceToken.balance) : 0;
      const okxTokenBalance = okxToken ? parseFloat(okxToken.balance) : 0;
      const binanceUSDTBalance = binanceUSDT ? parseFloat(binanceUSDT.balance) : 0;
      const okxUSDTBalance = okxUSDT ? parseFloat(okxUSDT.balance) : 0;

      console.log(`💰 Saldos - Binance: ${binanceTokenBalance} ${token}, ${binanceUSDTBalance} USDT`);
      console.log(`💰 Saldos - OKX: ${okxTokenBalance} ${token}, ${okxUSDTBalance} USDT`);
      console.log(`📊 Preços - Binance: $${binancePrice}, OKX: $${okxPrice}, Spread: ${tokenPrices.spread.toFixed(3)}%`);

      const minNotionalUSD = 10;
      const minTokenBinance = minNotionalUSD / binancePrice;
      const minTokenOkx = minNotionalUSD / okxPrice;

      // NOVA LÓGICA: Verificar se há saldo suficiente do token em AMBAS as exchanges
      const hasEnoughTokenBinance = binanceTokenBalance >= minTokenBinance;
      const hasEnoughTokenOkx = okxTokenBalance >= minTokenOkx;

      // Se não tiver saldo suficiente em pelo menos uma exchange, converter tudo para USDT primeiro
      if (!hasEnoughTokenBinance || !hasEnoughTokenOkx) {
        console.log(`🔄 FASE 1: Convertendo tokens para USDT...`);
        
        // Pegar todos os tokens com saldo > 0 (exceto USDT)
        const binanceTokensToConvert = portfolio.filter((i: any) => 
          i.exchange === 'Binance' && i.symbol !== 'USDT' && parseFloat(i.balance) > 0
        );
        
        const okxTokensToConvert = portfolio.filter((i: any) => 
          i.exchange === 'OKX' && i.symbol !== 'USDT' && parseFloat(i.balance) > 0
        );

        // Converter todos os tokens Binance para USDT
        for (const tokenItem of binanceTokensToConvert) {
          try {
            console.log(`🔄 Convertendo ${tokenItem.symbol} → USDT na Binance...`);
            await supabase.functions.invoke('binance-swap-token', {
              body: {
                apiKey: binanceCreds.api_key,
                secretKey: binanceCreds.secret_key,
                symbol: tokenItem.symbol,
                direction: 'toUsdt',
                orderType: 'market'
              }
            });
            console.log(`✅ ${tokenItem.symbol} convertido para USDT na Binance`);
          } catch (err) {
            console.error(`❌ Erro ao converter ${tokenItem.symbol} na Binance:`, err);
          }
        }

        // Converter todos os tokens OKX para USDT
        for (const tokenItem of okxTokensToConvert) {
          try {
            console.log(`🔄 Convertendo ${tokenItem.symbol} → USDT na OKX...`);
            await supabase.functions.invoke('okx-swap-token', {
              body: {
                apiKey: okxCreds.api_key,
                secretKey: okxCreds.secret_key,
                passphrase: okxCreds.passphrase,
                symbol: tokenItem.symbol,
                direction: 'toUsdt',
                orderType: 'market'
              }
            });
            console.log(`✅ ${tokenItem.symbol} convertido para USDT na OKX`);
          } catch (err) {
            console.error(`❌ Erro ao converter ${tokenItem.symbol} na OKX:`, err);
          }
        }

        console.log(`✅ FASE 1 COMPLETA: Todos os tokens convertidos para USDT`);
        
        // Aguardar 3 segundos para as ordens serem executadas
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Buscar saldos atualizados
        const { data: updatedPortfolio } = await supabase.functions.invoke('get-portfolio', {
          body: { user_id: user.id, real_mode: true, force_refresh: true }
        });

        if (!updatedPortfolio?.success) throw new Error('Erro ao buscar saldos atualizados');

        const updatedBinanceUSDT = updatedPortfolio.data.portfolio.find(
          (i: any) => i.exchange === 'Binance' && i.symbol === 'USDT'
        );
        const updatedOkxUSDT = updatedPortfolio.data.portfolio.find(
          (i: any) => i.exchange === 'OKX' && i.symbol === 'USDT'
        );

        const newBinanceUSDT = updatedBinanceUSDT ? parseFloat(updatedBinanceUSDT.balance) : 0;
        const newOkxUSDT = updatedOkxUSDT ? parseFloat(updatedOkxUSDT.balance) : 0;

        console.log(`💰 Novos saldos USDT - Binance: ${newBinanceUSDT}, OKX: ${newOkxUSDT}`);

        // FASE 2: Comprar o token selecionado APENAS na exchange onde for mais barato
        console.log(`🎯 FASE 2: Comprando ${token} na exchange mais barata...`);

        let result, error, executedAction;
        
        if (binancePrice < okxPrice) {
          // Binance mais barato - comprar apenas na Binance
          if (newBinanceUSDT >= minNotionalUSD) {
            console.log(`🟢 Comprando ${token} na Binance (mais barato: $${binancePrice}) [LIMIT ORDER]`);
            const response = await supabase.functions.invoke('binance-swap-token', {
              body: {
                apiKey: binanceCreds.api_key,
                secretKey: binanceCreds.secret_key,
                symbol: token,
                direction: 'toToken',
                customAmount: Math.min(newBinanceUSDT, 50),
                orderType: 'limit'
              }
            });
            result = response.data;
            error = response.error;
            executedAction = `Compra de ${token} na Binance (mais barato)`;
            console.log(`✅ ${token} comprado na Binance, USDT mantido na OKX (mais caro)`);
          } else {
            console.log(`❌ USDT insuficiente na Binance: ${newBinanceUSDT}`);
            toast.warning('Saldo USDT insuficiente na Binance');
            return;
          }
        } else {
          // OKX mais barato - comprar apenas na OKX
          if (newOkxUSDT >= minNotionalUSD) {
            console.log(`🔵 Comprando ${token} na OKX (mais barato: $${okxPrice}) [LIMIT ORDER]`);
            const response = await supabase.functions.invoke('okx-swap-token', {
              body: {
                apiKey: okxCreds.api_key,
                secretKey: okxCreds.secret_key,
                passphrase: okxCreds.passphrase,
                symbol: token,
                direction: 'toToken',
                customAmount: Math.min(newOkxUSDT, 50),
                orderType: 'limit'
              }
            });
            result = response.data;
            error = response.error;
            executedAction = `Compra de ${token} na OKX (mais barato)`;
            console.log(`✅ ${token} comprado na OKX, USDT mantido na Binance (mais caro)`);
          } else {
            console.log(`❌ USDT insuficiente na OKX: ${newOkxUSDT}`);
            toast.warning('Saldo USDT insuficiente na OKX');
            return;
          }
        }

        if (error || !result?.success) {
          throw new Error(result?.error || error?.message || 'Erro na conversão');
        }

        toast.success(`✅ Rebalanceamento completo!`, {
          description: `${executedAction} | ${token} na exchange mais barata, USDT na mais cara`,
          duration: 7000
        });

        setLastExecution(new Date().toLocaleTimeString('pt-BR'));
        
        // FASE 3: Aguardar e monitorar para vender na exchange mais cara
        console.log(`🔍 FASE 3: Iniciando monitoramento para venda na exchange mais cara...`);
        
        // Aguardar 5 segundos para garantir que a ordem anterior foi executada
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Buscar saldos atualizados novamente
        const { data: finalPortfolio } = await supabase.functions.invoke('get-portfolio', {
          body: { user_id: user.id, real_mode: true, force_refresh: true }
        });

        if (finalPortfolio?.success) {
          const finalBinanceToken = finalPortfolio.data.portfolio.find(
            (i: any) => i.exchange === 'Binance' && i.symbol === token
          );
          const finalOkxToken = finalPortfolio.data.portfolio.find(
            (i: any) => i.exchange === 'OKX' && i.symbol === token
          );

          const finalBinanceBalance = finalBinanceToken ? parseFloat(finalBinanceToken.balance) : 0;
          const finalOkxBalance = finalOkxToken ? parseFloat(finalOkxToken.balance) : 0;

          console.log(`💰 Saldos finais - Binance: ${finalBinanceBalance} ${token}, OKX: ${finalOkxBalance} ${token}`);

          // Identificar onde o token está (exchange mais barata da compra)
          const tokenIsOnBinance = finalBinanceBalance >= minTokenBinance;
          const tokenIsOnOkx = finalOkxBalance >= minTokenOkx;

          // Buscar preços atualizados
          const { data: latestBinanceData } = await supabase.functions.invoke('binance-market-data', {
            body: { action: 'tickers', symbols: [`${token}USDT`] }
          });

          const { data: latestOkxData } = await supabase.functions.invoke('okx-api', {
            body: { action: 'get_prices' }
          });

          if (latestBinanceData?.success && latestOkxData?.success) {
            const latestBinancePrice = latestBinanceData.data?.[`${token}USDT`]?.lastPrice || 
                                      latestBinanceData.data?.[`${token}USDT`]?.price || binancePrice;
            const latestOkxPrice = latestOkxData.data?.[token] || okxPrice;
            const currentSpread = ((latestOkxPrice - latestBinancePrice) / latestBinancePrice) * 100;

            console.log(`📊 Preços atualizados - Binance: $${latestBinancePrice}, OKX: $${latestOkxPrice}, Spread: ${currentSpread.toFixed(3)}%`);

            // Se o spread ainda for favorável (>0.3%), vender na exchange mais cara
            if (Math.abs(currentSpread) > 0.3) {
              if (currentSpread > 0 && tokenIsOnBinance) {
                // OKX mais caro, mas token está na Binance - aguardar próximo ciclo
                console.log(`⏸️ Token está na Binance (mais barata), aguardando transferência ou próximo ciclo`);
              } else if (currentSpread < 0 && tokenIsOnOkx) {
                // Binance mais caro, mas token está na OKX - aguardar próximo ciclo
                console.log(`⏸️ Token está na OKX (mais barata), aguardando transferência ou próximo ciclo`);
              } else if (currentSpread > 0 && tokenIsOnOkx && finalOkxBalance >= minTokenOkx) {
                // OKX mais caro e token está na OKX - VENDER
                console.log(`🎯 FASE 3: Vendendo ${token} → USDT na OKX (mais cara: $${latestOkxPrice}) [LIMIT ORDER]`);
                const sellResponse = await supabase.functions.invoke('okx-swap-token', {
                  body: {
                    apiKey: okxCreds.api_key,
                    secretKey: okxCreds.secret_key,
                    passphrase: okxCreds.passphrase,
                    symbol: token,
                    direction: 'toUsdt',
                    orderType: 'limit'
                  }
                });

                if (sellResponse.data?.success) {
                  const sellProfit = sellResponse.data.executedQty * (latestOkxPrice - latestBinancePrice);
                  toast.success(`✅ Venda na exchange mais cara!`, {
                    description: `${token} → USDT na OKX | Lucro adicional: $${sellProfit.toFixed(2)}`,
                    duration: 7000
                  });
                  console.log(`✅ Venda executada na OKX, lucro adicional: $${sellProfit.toFixed(2)}`);
                }
              } else if (currentSpread < 0 && tokenIsOnBinance && finalBinanceBalance >= minTokenBinance) {
                // Binance mais caro e token está na Binance - VENDER
                console.log(`🎯 FASE 3: Vendendo ${token} → USDT na Binance (mais cara: $${latestBinancePrice}) [LIMIT ORDER]`);
                const sellResponse = await supabase.functions.invoke('binance-swap-token', {
                  body: {
                    apiKey: binanceCreds.api_key,
                    secretKey: binanceCreds.secret_key,
                    symbol: token,
                    direction: 'toUsdt',
                    orderType: 'limit'
                  }
                });

                if (sellResponse.data?.success) {
                  const sellProfit = sellResponse.data.executedQty * (latestBinancePrice - latestOkxPrice);
                  toast.success(`✅ Venda na exchange mais cara!`, {
                    description: `${token} → USDT na Binance | Lucro adicional: $${sellProfit.toFixed(2)}`,
                    duration: 7000
                  });
                  console.log(`✅ Venda executada na Binance, lucro adicional: $${sellProfit.toFixed(2)}`);
                }
              }
            } else {
              console.log(`⏸️ Spread insuficiente (${currentSpread.toFixed(3)}%) para venda - aguardando melhor momento`);
            }
          }
        }

        return;
      }

      // LÓGICA ORIGINAL: Se já tiver saldo do token em ambas, fazer arbitragem normal
      let result, error, executedAction;

      if (okxPrice > binancePrice && tokenPrices.spread > 0.3) {
        // OKX mais caro: vender na OKX, comprar na Binance
        if (okxTokenBalance >= minTokenOkx) {
          console.log(`🎯 Arbitragem: Vender ${token} → USDT na OKX ($${okxPrice}) [LIMIT ORDER]`);
          const response = await supabase.functions.invoke('okx-swap-token', {
            body: {
              apiKey: okxCreds.api_key,
              secretKey: okxCreds.secret_key,
              passphrase: okxCreds.passphrase,
              symbol: token,
              direction: 'toUsdt',
              orderType: 'limit'
            }
          });
          result = response.data;
          error = response.error;
          executedAction = `${token} → USDT (OKX)`;
        }
      } else if (binancePrice > okxPrice && Math.abs(tokenPrices.spread) > 0.3) {
        // Binance mais caro: vender na Binance, comprar na OKX
        if (binanceTokenBalance >= minTokenBinance) {
          console.log(`🎯 Arbitragem: Vender ${token} → USDT na Binance ($${binancePrice}) [LIMIT ORDER]`);
          const response = await supabase.functions.invoke('binance-swap-token', {
            body: {
              apiKey: binanceCreds.api_key,
              secretKey: binanceCreds.secret_key,
              symbol: token,
              direction: 'toUsdt',
              orderType: 'limit'
            }
          });
          result = response.data;
          error = response.error;
          executedAction = `${token} → USDT (Binance)`;
        }
      } else {
        console.log(`⏸️ Spread insuficiente (${tokenPrices.spread.toFixed(3)}%) - aguardando melhor oportunidade`);
        return;
      }

      if (error || !result?.success) {
        throw new Error(result?.error || error?.message || 'Erro na conversão');
      }

      const profit = result.executedQty * Math.abs(okxPrice - binancePrice);
      
      toast.success(`✅ Arbitragem executada!`, {
        description: `${executedAction} | Lucro: $${profit.toFixed(2)}`,
        duration: 7000
      });

      setLastExecution(new Date().toLocaleTimeString('pt-BR'));

    } catch (error: any) {
      console.error('Erro no rebalanceamento:', error);
      toast.error('Erro no rebalanceamento', {
        description: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="relative overflow-hidden border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PiggyBank className="h-5 w-5" />
            Saldo Total (Todas as Exchanges)
          </CardTitle>
          
          {/* Controles de Conversão Automatizada */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-primary/5 rounded border border-primary/20">
              <ArrowRightLeft className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-primary">{selectedToken}</span>
            </div>
            
            <Label htmlFor="auto-convert" className="text-sm font-normal cursor-pointer flex items-center gap-1">
              <Zap className={`h-4 w-4 ${autoConvertEnabled ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
              Auto
            </Label>
            <Switch
              id="auto-convert"
              checked={autoConvertEnabled}
              onCheckedChange={setAutoConvertEnabled}
              disabled={isProcessing}
            />
          </div>
        </div>
        
        {/* Status da Conversão Automática */}
        {autoConvertEnabled && (
          <div className="mt-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <RefreshCw className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''} text-primary`} />
                <span className="text-primary font-medium">
                  {isProcessing ? 'Executando conversão...' : `Monitorando ${selectedToken}`}
                </span>
                {!isProcessing && (
                  <span className="text-green-500 font-bold">
                    {selectedToken}: {tokenPrices.spread > 0 ? '+' : ''}{tokenPrices.spread.toFixed(3)}%
                  </span>
                )}
              </div>
              {lastExecution && (
                <span className="text-muted-foreground">
                  Última: {lastExecution}
                </span>
              )}
            </div>
            
            {tokenPrices.binance > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Binance</p>
                  <p className="font-mono font-semibold">${tokenPrices.binance.toFixed(tokenPrices.binance < 1 ? 6 : 2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">OKX</p>
                  <p className="font-mono font-semibold">${tokenPrices.okx.toFixed(tokenPrices.okx < 1 ? 6 : 2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Spread</p>
                  <p className={`font-mono font-semibold ${Math.abs(tokenPrices.spread) > 0.3 ? 'text-green-500' : ''}`}>
                    {tokenPrices.spread > 0 ? '+' : ''}{tokenPrices.spread.toFixed(3)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Total Value Display */}
        <div className="text-center py-6 border-2 rounded-lg bg-primary/5">
          <p className="text-sm text-muted-foreground mb-2">Patrimônio Total</p>
          <div className="flex items-center justify-center gap-3">
            <p className="text-4xl font-bold text-primary">
              US$ {totalValue.toFixed(2)}
            </p>
            {isProfit && (
              <TrendingUp className="h-8 w-8 text-green-500" />
            )}
            {isLoss && (
              <TrendingDown className="h-8 w-8 text-red-500" />
            )}
            {!isProfit && !isLoss && (
              <Minus className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          
          {/* Profit/Loss Indicator */}
          <div className="mt-3">
            <Badge 
              variant={isProfit ? "default" : isLoss ? "destructive" : "secondary"}
              className={`text-lg px-4 py-1 ${isProfit ? "bg-green-500" : isLoss ? "bg-red-500" : ""}`}
            >
              {profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(2)} USD ({profitLossPercent.toFixed(2)}%)
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              Base inicial: ${totalBaseline.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Exchange Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Binance</p>
            <p className="text-lg font-bold">
              ${binanceBalance.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalValue > 0 ? ((binanceBalance / totalValue) * 100).toFixed(1) : 0}% do total
            </p>
          </div>
          
          <div className="p-3 border rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">OKX</p>
            <p className="text-lg font-bold">
              ${okxBalance.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalValue > 0 ? ((okxBalance / totalValue) * 100).toFixed(1) : 0}% do total
            </p>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="pt-3 border-t">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Investido</p>
              <p className="text-sm font-semibold">${totalBaseline.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atual</p>
              <p className="text-sm font-semibold">${totalValue.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Retorno</p>
              <p className={`text-sm font-semibold ${isProfit ? 'text-green-500' : isLoss ? 'text-red-500' : ''}`}>
                {profitLossPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* Tokens por Exchange */}
        <div className="pt-4 border-t">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'binance' | 'okx')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="binance">
                Binance ({binanceTokens.length})
              </TabsTrigger>
              <TabsTrigger value="okx">
                OKX ({okxTokens.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="binance" className="space-y-2 mt-3">
              {loadingTokens ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
              ) : binanceTokens.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {binanceTokens.map((token) => (
                    <div 
                      key={token.symbol}
                      className="flex items-center justify-between p-2 border rounded-md text-sm bg-muted/20"
                    >
                      <div>
                        <p className="font-semibold">{token.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {token.balance.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          ${token.valueUsd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @${token.priceUsd.toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum token na Binance</p>
              )}
            </TabsContent>

            <TabsContent value="okx" className="space-y-2 mt-3">
              {loadingTokens ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
              ) : okxTokens.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {okxTokens.map((token) => (
                    <div 
                      key={token.symbol}
                      className="flex items-center justify-between p-2 border rounded-md text-sm bg-muted/20"
                    >
                      <div>
                        <p className="font-semibold">{token.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {token.balance.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          ${token.valueUsd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @${token.priceUsd.toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum token na OKX</p>
              )}
            </TabsContent>
          </Tabs>

          {/* Botões de Ação */}
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAllTokens}
              disabled={loadingTokens}
              className="flex-1"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingTokens ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              disabled={loadingTokens}
              className="flex-1"
            >
              <Repeat className="h-4 w-4 mr-2" />
              Converter
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};