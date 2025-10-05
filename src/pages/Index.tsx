import { BinanceFundingArbitrage } from "@/components/BinanceFundingArbitrage";
import APIConfiguration from "@/components/APIConfiguration";
import ChatInterface from "@/components/ChatInterface";
import { SpotFuturesChart } from "@/components/SpotFuturesChart";
import { HybridStrategyDashboard } from "@/components/HybridStrategyDashboard";
import { TradingModeValidator } from "@/components/TradingModeValidator";
import { SmartProxyDashboard } from "@/components/SmartProxyDashboard";
import SyntheticPairsArbitrage from "@/components/SyntheticPairsArbitrage";
import MobileAPIManager from "@/components/MobileAPIManger";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Wallet, Settings, MessageCircle, ArrowRightLeft, BarChart3, Zap, DollarSign, Globe, Smartphone, Shield, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mobile-container pb-safe">
          {/* Mobile Header */}
          <div className="text-center space-y-4 mb-8">
            <div className="flex items-center justify-center gap-2">
              <Smartphone className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                FundingK1
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Plataforma de arbitragem móvel
            </p>
            <Badge className="bg-success text-success-foreground text-xs">
              📱 Versão Mobile Otimizada
            </Badge>
          </div>

          {/* Mobile Quick Actions */}
          <div className="grid gap-4 mb-8">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Funding Arbitrage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Spot ↔ Futures na Binance
                </p>
                <Button size="sm" className="w-full touch-target" onClick={() => navigate('/arbitrage-control')}>
                  Acessar Arbitragem
                  <ArrowRight className="h-3 w-3 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wallet className="h-4 w-4 text-primary" />
                  Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Monitore seus saldos
                </p>
                <Button size="sm" variant="outline" className="w-full touch-target" onClick={() => navigate('/portfolio')}>
                  Ver Portfolio
                  <ArrowRight className="h-3 w-3 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-4 w-4 text-primary" />
                  Configurações API
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Configure Binance e OKX abaixo
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Mobile API Manager */}
          <MobileAPIManager />

          {/* Mobile Features */}
          <div className="mt-8 space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  Chat IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChatInterface />
              </CardContent>
            </Card>
          </div>

          {/* Mobile Footer */}
          <div className="text-center mt-8 pb-safe">
            <p className="text-xs text-muted-foreground">
              Sistema otimizado para dispositivos móveis
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header com Logout */}
      <Header />
      
      <div className="p-2 sm:p-4">
      {/* Supabase Link - Top Right */}
      <div className="absolute top-16 right-4 z-50">
        <Button 
          variant="outline"
          size="sm"
          onClick={() => window.open('https://supabase.com/dashboard/project/uxhcsjlfwkhwkvhfacho', '_blank')}
          className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border-border hover:bg-accent hover:text-accent-foreground shadow-lg"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">Supabase Dashboard</span>
        </Button>
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Plataforma de Arbitragem Financeira
              </h1>
              <p className="mt-2 text-sm sm:text-lg text-muted-foreground">
                Oportunidades em tempo real - Operações internas da Binance (Spot ↔ Futures)
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate('/portfolio')}
              className="flex items-center gap-2 self-center sm:self-auto"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Meu Portfolio</span>
              <span className="sm:hidden">Portfolio</span>
            </Button>
          </div>
        </div>

        {/* Quick Access Cards - HFT & Triangular Arbitrage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card 
            className="border-2 border-primary/20 hover:border-primary/40 transition-all cursor-pointer bg-gradient-to-br from-card to-primary/5"
            onClick={() => navigate('/hft-trading')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-yellow-500" />
                HFT Trading System
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Sistema de alta frequência com REST API paralelo - Latência ultra-baixa (~100ms)
              </p>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="default">Multi-Exchange</Badge>
                <Badge variant="secondary">REST API</Badge>
                <Badge variant="outline">Execução Automática</Badge>
              </div>
              <Button className="w-full mt-4" variant="default">
                Acessar HFT Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="border-2 border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer bg-gradient-to-br from-card to-purple-500/5"
            onClick={() => navigate('/triangular-arbitrage')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-purple-500" />
                Arbitragem Triangular
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Ciclos triangulares em tempo real via WebSocket - Detecção instantânea
              </p>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="default" className="bg-purple-600">WebSocket</Badge>
                <Badge variant="secondary">Tempo Real</Badge>
                <Badge variant="outline">Ciclos BTC/ETH/BNB</Badge>
              </div>
              <Button className="w-full mt-4" variant="outline">
                Acessar Triangular Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="hybrid-strategy" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 mb-4 sm:mb-8 h-auto">
            <TabsTrigger value="hybrid-strategy" className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3 text-xs sm:text-sm">
              <Zap className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Sistema & Validação</span>
              <span className="sm:hidden">Sistema</span>
            </TabsTrigger>
            <TabsTrigger value="synthetic-pairs" className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3 text-xs sm:text-sm">
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Pares Sintéticos</span>
              <span className="sm:hidden">Sintético</span>
            </TabsTrigger>
            <TabsTrigger value="funding-arbitrage" className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3 text-xs sm:text-sm">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Funding (Spot ↔ Futures)</span>
              <span className="sm:hidden">Funding</span>
            </TabsTrigger>
            <TabsTrigger value="binance-hyperliquid" className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3 text-xs sm:text-sm">
              <ArrowRightLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Cross-Over</span>
              <span className="sm:hidden">C-O</span>
            </TabsTrigger>
            <TabsTrigger value="spot-futures-chart" className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3 text-xs sm:text-sm">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Análise Spot/Futures</span>
              <span className="sm:hidden">Análise</span>
            </TabsTrigger>
            <TabsTrigger value="api-config" className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3 text-xs sm:text-sm">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Configuração API</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3 text-xs sm:text-sm">
              <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Assistente</span>
              <span className="sm:hidden">Chat</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hybrid-strategy">
            <div className="grid grid-cols-1 gap-6">
              <TradingModeValidator />
              <HybridStrategyDashboard />
            </div>
          </TabsContent>

          <TabsContent value="synthetic-pairs">
            <SyntheticPairsArbitrage />
          </TabsContent>

          <TabsContent value="funding-arbitrage">
            <BinanceFundingArbitrage />
          </TabsContent>


          <TabsContent value="binance-hyperliquid">
            <div className="text-center p-4 sm:p-8 bg-card rounded-lg border">
              <h3 className="text-xl sm:text-2xl font-bold mb-4">Arbitragem Cross-Over</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">
                Configure suas credenciais da Hyperliquid na aba "Configuração API" para executar arbitragens cross-exchange.
              </p>
              <Button 
                variant="outline" 
                onClick={() => navigate('/arbitrage-control')}
                className="w-full sm:w-auto"
              >
                Acessar Painel de Controle
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="spot-futures-chart">
            <SpotFuturesChart />
          </TabsContent>

          <TabsContent value="api-config">
            <APIConfiguration />
          </TabsContent>

          <TabsContent value="chat">
            <ChatInterface />
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </div>
  );
};

export default Index;
