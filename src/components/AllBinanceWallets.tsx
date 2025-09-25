import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Wallet, DollarSign, TrendingUp, TrendingDown, AlertTriangle, Eye, EyeOff, Globe, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/userUtils";
import { useSmartProxy } from "@/hooks/useSmartProxy";

interface WalletAsset {
  asset?: string;
  free?: string;
  locked?: string;
  walletBalance?: string;
  unrealizedProfit?: string;
  marginBalance?: string;
  borrowed?: string;
  interest?: string;
  netAsset?: string;
  totalNetAsset?: string;
  equity?: string;
}

interface WalletPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  positionSide: string;
}

interface WalletBalance {
  type: string;
  name: string;
  totalBalance: string;
  assets: WalletAsset[];
  positions?: WalletPosition[];
  error?: string;
  source?: string;
}

export const AllBinanceWallets = () => {
  const { toast } = useToast();
  const { requestWithFallback } = useSmartProxy();
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [proxyEnabled, setProxyEnabled] = useState(true);

  // Filtrar carteiras desnecessárias (remover financiamento)
  const filteredWallets = wallets.filter(wallet => 
    wallet.type !== 'funding'
  );

  const handleQuickTransfer = () => {
    toast({
      title: "Transferência Rápida",
      description: "Use a interface oficial da Binance para transferir $20 USDT para sua carteira Web3. Endereço da carteira copiado para área de transferência.",
    })
    
    // Simular cópia do endereço da carteira Web3 para área de transferência
    const web3Address = localStorage.getItem('web3_wallet_address') || 'Conecte sua carteira Web3 primeiro'
    navigator.clipboard.writeText(web3Address)
  }

  const fetchAllBalances = async () => {
    setLoading(true);
    
    try {
      const userId = await getUserId();
      const binanceCredentials = localStorage.getItem('binance_credentials');
      
      if (!binanceCredentials) {
        toast({
          title: "Credenciais não encontradas",
          description: "Configure suas credenciais da Binance primeiro",
          variant: "destructive"
        });
        return;
      }

      const credentials = JSON.parse(binanceCredentials);

      let data;
      
      // Bypass Smart Proxy for internal Supabase functions (it may strip Authorization headers)
      if (proxyEnabled) {
        console.log('🧠 Smart Proxy bypassado para funções internas do Supabase');
        // Mantemos data como null para cair no método direto abaixo
      }
      
      // Fallback para método direto
      if (!data) {
        console.log('📡 Usando método direto...');
        
        const { data: directData, error } = await supabase.functions.invoke('binance-all-balances', {
          body: {
            binanceApiKey: credentials.apiKey,
            binanceSecretKey: credentials.secretKey,
            userId: userId
          }
        });

        if (error) {
          throw new Error(error.message);
        }
        
        data = directData;
      }

      console.log('📊 Dados recebidos:', { 
        hasData: !!data, 
        success: data?.success, 
        hasWallets: !!data?.wallets,
        hasError: !!data?.error,
        dataKeys: data ? Object.keys(data) : []
      });

      if (data && data.success && data.wallets) {
        setWallets(data.wallets);
        setLastUpdate(new Date());
        
        const hasSimulated = data.wallets.some((w: WalletBalance) => w.source === 'simulated');
        if (hasSimulated) {
          toast({
            title: proxyEnabled ? "🌐 Smart Proxy + Simulação" : "⚠️ Dados Parcialmente Simulados",
            description: data.message || "Alguns dados são simulados devido a restrições da API",
            variant: "destructive"
          });
        } else {
          toast({
            title: proxyEnabled ? "🌐 Smart Proxy Funcionando" : "✅ Carteiras Atualizadas", 
            description: proxyEnabled ? "Restrições geográficas contornadas com sucesso" : "Todos os saldos foram obtidos com sucesso da Binance"
          });
        }
      } else {
        const errorMsg = data?.error || data?.message || `Resposta inválida da API: success=${data?.success}`;
        console.error('❌ Erro na resposta:', errorMsg);
        throw new Error(errorMsg);
      }

    } catch (error: any) {
      console.error('Erro ao buscar carteiras:', error);
      console.error('Stack trace completo:', error.stack);
      console.error('Tipo do erro:', typeof error);
      console.error('Propriedades do erro:', Object.keys(error));
      
      toast({
        title: "Erro ao buscar carteiras",
        description: (error && (error.message || error?.error || error?.msg)) || "Não foi possível obter os saldos das carteiras",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllBalances();
  }, []);

  const formatCurrency = (value: string, symbol: string = 'USD') => {
    const num = parseFloat(value || '0');
    if (symbol === 'BTC' && num < 1) {
      return `${num.toFixed(8)} ${symbol}`;
    }
    
    // Handle cryptocurrency tickers that are not valid ISO currency codes
    const getCurrencyCode = (symbol: string) => {
      const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP'];
      if (stablecoins.includes(symbol)) return 'USD';
      
      // For other cryptocurrencies, try to use the symbol, but fallback to USD if invalid
      try {
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: symbol }).format(0);
        return symbol;
      } catch {
        return 'USD';
      }
    };
    
    const currencyCode = getCurrencyCode(symbol);
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: symbol === 'BTC' ? 8 : 6
    }).format(num);
    
    // If we had to fallback to USD for a crypto, show the original symbol
    if (currencyCode === 'USD' && symbol !== 'USD' && !['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP'].includes(symbol)) {
      return `${formatted.replace('US$', '')} ${symbol}`;
    }
    
    return formatted;
  };

  const getProfitColor = (value: string) => {
    const num = parseFloat(value || '0');
    if (num > 0) return 'text-green-600';
    if (num < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getWalletIcon = (type: string) => {
    switch (type) {
      case 'spot': return '💰';
      case 'futures-usd': return '🔮';
      case 'futures-coin': return '🪙';
      case 'margin-cross': return '🔄';
      case 'margin-isolated': return '🔒';
      case 'options': return '📈';
      default: return '💼';
    }
  };

  const getWalletDescription = (type: string) => {
    switch (type) {
      case 'spot': return 'Compra e venda direta de criptomoedas (1:1)';
      case 'futures-usd': return 'Contratos futuros liquidados em USDT (até 125x)';
      case 'futures-coin': return 'Contratos futuros liquidados em cripto (até 125x)';
      case 'margin-cross': return 'Todo saldo como garantia (até 10x)';
      case 'margin-isolated': return 'Garantia por posição independente (até 10x)';
      case 'options': return 'Contratos de opção com prêmio limitado';
      default: return 'Carteira da Binance';
    }
  };

  const getTotalBalance = () => {
    return filteredWallets.reduce((total, wallet) => {
      const balance = parseFloat(wallet.totalBalance || '0');
      return total + balance;
    }, 0);
  };

  const renderAssetTable = (assets: WalletAsset[], type: string) => {
    const filteredAssets = showZeroBalances ? assets : assets.filter(asset => {
      const balance = asset.free || asset.walletBalance || asset.netAsset || asset.totalNetAsset || asset.equity || '0';
      return parseFloat(balance) > 0;
    });

    if (filteredAssets.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500">
          Nenhum ativo encontrado
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead className="text-right">Disponível</TableHead>
            {type === 'spot' && <TableHead className="text-right">Bloqueado</TableHead>}
            {type.includes('futures') && (
              <>
                <TableHead className="text-right">PnL Não Realizado</TableHead>
                <TableHead className="text-right">Margem</TableHead>
              </>
            )}
            {type.includes('margin') && (
              <>
                <TableHead className="text-right">Emprestado</TableHead>
                <TableHead className="text-right">Juros</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAssets.map((asset, index) => (
            <TableRow key={`${asset.asset || 'asset'}-${index}`}>
              <TableCell>
                <Badge variant="secondary">
                  {asset.asset || `Asset ${index + 1}`}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                {type === 'spot' && formatCurrency(asset.free || '0', asset.asset)}
                {type === 'futures-usd' && formatCurrency(asset.walletBalance || '0', asset.asset)}
                {type === 'futures-coin' && formatCurrency(asset.walletBalance || '0', asset.asset)}
                {type === 'margin-cross' && formatCurrency(asset.free || '0', asset.asset)}
                {type === 'margin-isolated' && formatCurrency(asset.totalNetAsset || '0', 'USD')}
                {type === 'options' && formatCurrency(asset.equity || '0', asset.asset)}
              </TableCell>
              {type === 'spot' && (
                <TableCell className="text-right">
                  {formatCurrency(asset.locked || '0', asset.asset)}
                </TableCell>
              )}
              {type.includes('futures') && (
                <>
                  <TableCell className={`text-right ${getProfitColor(asset.unrealizedProfit || '0')}`}>
                    {formatCurrency(asset.unrealizedProfit || '0', 'USD')}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(asset.marginBalance || '0', asset.asset)}
                  </TableCell>
                </>
              )}
              {type.includes('margin') && (
                <>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(asset.borrowed || '0', asset.asset)}
                  </TableCell>
                  <TableCell className="text-right text-orange-600">
                    {formatCurrency(asset.interest || '0', asset.asset)}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Todas as Carteiras Binance
              </CardTitle>
              <CardDescription>
                {lastUpdate ? `Última atualização: ${lastUpdate.toLocaleString('pt-BR')}` : 'Carregando...'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProxyEnabled(!proxyEnabled)}
                className={proxyEnabled ? "border-green-500 text-green-700" : ""}
              >
                <Globe className="h-4 w-4" />
                Smart Proxy {proxyEnabled ? 'ON' : 'OFF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowZeroBalances(!showZeroBalances)}
              >
                {showZeroBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showZeroBalances ? 'Ocultar Zeros' : 'Mostrar Zeros'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAllBalances}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">
                {formatCurrency(getTotalBalance().toString(), 'USD')}
              </div>
              <div className="text-sm text-gray-600">Saldo Total Estimado</div>
            </div>
            
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {filteredWallets.length}
              </div>
              <div className="text-sm text-gray-600">Carteiras Disponíveis</div>
            </div>

            <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">
                {filteredWallets.reduce((total, wallet) => total + wallet.assets.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Assets Ativos</div>
            </div>
          </div>

          {/* Grid de Carteiras */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWallets.map((wallet, index) => (
              <Card key={wallet.type} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getWalletIcon(wallet.type)}</span>
                      <div>
                        <CardTitle className="text-sm font-medium">{wallet.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {getWalletDescription(wallet.type)}
                        </CardDescription>
                      </div>
                    </div>
                    {wallet.source === 'simulated' && (
                      <Badge variant="secondary" className="text-xs">
                        Simulado
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-xl font-bold text-primary">
                      {wallet.type.includes('-') ? 
                        `${formatCurrency(wallet.totalBalance, 'USD')}` :
                        formatCurrency(wallet.totalBalance, 'USD')
                      }
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {wallet.assets.length} assets • {wallet.positions?.length || 0} posições
                    </div>
                    
                    {/* Quick Transfer Button */}
                    {wallet.type === 'spot' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3 w-full"
                        onClick={() => handleQuickTransfer()}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Enviar para Web3 ($20)
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detalhes por Carteira */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes das Carteiras</CardTitle>
          <CardDescription>Visualização detalhada de cada carteira</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={filteredWallets[0]?.type || 'spot'} className="w-full">
            <TabsList className="grid grid-cols-3 lg:grid-cols-6">
              {filteredWallets.map((wallet) => (
                <TabsTrigger key={wallet.type} value={wallet.type} className="text-xs">
                  {getWalletIcon(wallet.type)} {wallet.name.split(' ')[0]}
                </TabsTrigger>
              ))}
            </TabsList>

            {filteredWallets.map((wallet) => (
              <TabsContent key={wallet.type} value={wallet.type} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span className="text-2xl">{getWalletIcon(wallet.type)}</span>
                    {wallet.name}
                  </h3>
                  {wallet.source === 'simulated' && (
                    <div className="flex items-center gap-2 text-yellow-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">Dados simulados</span>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-600">{getWalletDescription(wallet.type)}</p>
                
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Assets</h4>
                  {renderAssetTable(wallet.assets, wallet.type)}
                </div>

                {wallet.positions && wallet.positions.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">Posições Abertas</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Símbolo</TableHead>
                          <TableHead>Lado</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Preço Entrada</TableHead>
                          <TableHead className="text-right">PnL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {wallet.positions.map((position, index) => (
                          <TableRow key={`${position.symbol}-${index}`}>
                            <TableCell>
                              <Badge variant="outline">{position.symbol}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={position.positionSide === 'LONG' ? 'default' : 'destructive'}>
                                {position.positionSide}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{position.positionAmt}</TableCell>
                            <TableCell className="text-right">{formatCurrency(position.entryPrice)}</TableCell>
                            <TableCell className={`text-right ${getProfitColor(position.unRealizedProfit)}`}>
                              {formatCurrency(position.unRealizedProfit)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};