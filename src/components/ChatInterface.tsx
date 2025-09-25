import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeLogger } from "@/hooks/useRealtimeLogger";
import RealtimeLogger from "@/components/RealtimeLogger";
import { Send, Bot, User, TrendingUp, AlertTriangle, CheckCircle2, MessageCircle, Activity } from "lucide-react";

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type?: 'info' | 'warning' | 'success' | 'trade';
}

const ChatInterface = () => {
  const { toast } = useToast();
  const { logs, addLog, addOperationLog, addTradeLog, addArbitrageLog, addConnectionLog } = useRealtimeLogger();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Olá! Sou seu assistente especializado em arbitragem financeira. Posso ajudá-lo a identificar oportunidades de lucro entre diferentes exchanges, executar trades automatizados e monitorar seu portfólio em tempo real. Como posso ajudá-lo hoje?',
      sender: 'bot',
      timestamp: new Date(),
      type: 'info'
    },
    {
      id: '2',  
      content: '🚀 Nova oportunidade detectada: BTC/USDT com spread de 0.85% entre Binance Spot ($113,245.67) e Binance Futures ($113,042.15). Investimento sugerido: $1,000 com lucro estimado de $8.50. Risco: BAIXO. Deseja executar esta operação de arbitragem?',
      sender: 'bot',
      timestamp: new Date(Date.now() - 300000),
      type: 'trade'
    },
    {
      id: '3',
      content: '📊 Resumo do seu portfólio atual: Saldo total de $10,074.52 distribuído em: BTC (0.1), ETH (2.5), SOL (25), BNB (10), USDT (10,017.99). Últimas 24h: +1.2% de performance com 2 trades executados com 100% de taxa de sucesso.',
      sender: 'bot',
      timestamp: new Date(Date.now() - 600000),
      type: 'success'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      // Multiple approaches to ensure reliable scrolling
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (scrollContainer) {
        // Immediate scroll
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        
        // Delayed scroll to ensure content is rendered
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 50);
        
        // Final scroll with animation frame
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        });
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const simulateBotResponse = (userMessage: string) => {
    setIsTyping(true);
    
    // Simular logs em tempo real durante o processamento
    const simulateOperationLogs = () => {
      const lowerMessage = userMessage.toLowerCase();
      
      if (lowerMessage.includes('arbitragem') || lowerMessage.includes('oportunidade')) {
        addOperationLog('scan', 'start', 'Buscando oportunidades de arbitragem em exchanges');
        
        setTimeout(() => {
          addConnectionLog('Binance', 'connected', '676 pares de preços obtidos');
          addConnectionLog('OKX', 'connected', '584 pares de preços obtidos');
        }, 500);
        
        setTimeout(() => {
          addArbitrageLog('SOL', 'Binance', 'OKX', 1.2, 12.70, 'detected');
          addArbitrageLog('ETH', 'Binance', 'OKX', 0.8, 8.25, 'detected');
          addArbitrageLog('BNB', 'Binance', 'OKX', 0.6, 6.12, 'detected');
          addOperationLog('scan', 'success', '5 oportunidades encontradas', { 
            details: { total_opportunities: 5, profitable: 3, high_risk: 1 }
          });
        }, 1000);
        
      } else if (lowerMessage.includes('executar') || lowerMessage.includes('sim')) {
        addOperationLog('execution', 'start', 'Preparando execução de arbitragem SOL/USDT');
        
        setTimeout(() => {
          addArbitrageLog('SOL', 'Binance', 'OKX', 1.2, 12.70, 'analyzing');
        }, 200);
        
        setTimeout(() => {
          addArbitrageLog('SOL', 'Binance', 'OKX', 1.2, 12.70, 'executing');
          addTradeLog('Binance', 'SOL', 'buy', 4.47, 223.45, 'pending');
        }, 600);
        
        setTimeout(() => {
          addTradeLog('Binance', 'SOL', 'buy', 4.47, 223.45, 'filled', { duration: 850 });
          addTradeLog('OKX', 'SOL', 'sell', 4.47, 226.15, 'pending');
        }, 1200);
        
        setTimeout(() => {
          addTradeLog('OKX', 'SOL', 'sell', 4.47, 226.15, 'filled', { duration: 1200 });
          addArbitrageLog('SOL', 'Binance', 'OKX', 1.2, 10.50, 'completed', { 
            duration: 2800,
            details: { 
              gross_profit: 12.70, 
              fees: 2.20, 
              net_profit: 10.50, 
              roi: '1.05%' 
            }
          });
        }, 1800);
      }
    };
    
    simulateOperationLogs();
    
    setTimeout(() => {
      let botResponse = '';
      let messageType: Message['type'] = 'info';
      
      const lowerMessage = userMessage.toLowerCase();
      
      if (lowerMessage.includes('arbitragem') || lowerMessage.includes('oportunidade')) {
        botResponse = '💡 Identifiquei 5 oportunidades ativas de arbitragem no momento:\n\n1. SOL/USDT: Spread 1.2% (Binance $223.45 → OKX $226.15) - Lucro estimado: $12.70\n2. ETH/USDT: Spread 0.8% (Binance $4,205.67 → OKX $4,238.92) - Lucro estimado: $8.25\n3. BNB/USDT: Spread 0.6% (Spot $1,017.30 → Futures $1,023.42) - Lucro estimado: $6.12\n\nTodas com risco BAIXO e execução estimada em menos de 30 segundos. Qual operação deseja executar?';
        messageType = 'trade';
      } else if (lowerMessage.includes('executar') || lowerMessage.includes('sim')) {
        botResponse = '⚡ Operação de arbitragem SOL/USDT executada com sucesso!\n\n✅ Ordem 1: Compra de 4.47 SOL na Binance por $223.45 - PREENCHIDA\n✅ Ordem 2: Venda de 4.47 SOL na OKX por $226.15 - PREENCHIDA\n\n💰 Resultado da operação:\nInvestimento: $1,000.00\nLucro bruto: $12.70\nTaxas: $2.20\nLucro líquido: $10.50\nROI: 1.05%\nTempo de execução: 2.8 segundos\n\nVerifique os logs detalhados na aba "Operações em Tempo Real".';
        messageType = 'success';
      } else if (lowerMessage.includes('risco') || lowerMessage.includes('perda')) {
        botResponse = '🛡️ Análise de Risco Completa:\n\nRisco Atual: BAIXO ✅\n• Slippage máximo configurado: 0.5%\n• Proteção MEV: ATIVADA\n• Stop-loss automático: 2%\n• Diversificação: 5 pares ativos\n• Liquidez mínima: $50,000 por operação\n\n📊 Histórico de segurança:\n• Taxa de sucesso: 94.7%\n• Maior drawdown: -1.2%\n• Tempo médio de recuperação: 3.5 dias\n\nRecomendação: Sistema seguro para continuar operações.';
        messageType = 'warning';
      } else if (lowerMessage.includes('portfolio') || lowerMessage.includes('carteira')) {
        botResponse = '📈 Portfólio Detalhado (Atualizado em tempo real):\n\n💰 Valor Total: $10,074.52 (+1.2% 24h)\n\n🪙 Ativos:\n• BTC: 0.1000 ($11,324.52) +0.8%\n• ETH: 2.5000 ($10,521.25) +1.5%\n• SOL: 25.0000 ($5,586.25) +2.1%\n• BNB: 10.0000 ($10,173.00) -0.3%\n• USDT: 10,017.99 (stablecoin)\n\n📊 Performance:\n• ROI mensal: +12.4%\n• Trades realizados: 47\n• Taxa de acerto: 94.7%\n• Melhor trade: +$89.45 (SOL/USDT)\n• Sharpe Ratio: 2.14';
        messageType = 'info';
      } else {
        botResponse = '🤖 Posso ajudá-lo com diversas funcionalidades avançadas:\n\n🔍 Análise de Oportunidades:\n• Monitoramento de 15+ exchanges\n• Detecção de spreads em tempo real\n• Cálculo automático de ROI\n\n⚡ Execução de Trades:\n• Arbitragem automática\n• Orders simultâneas\n• Proteção contra slippage\n\n📊 Gestão de Portfólio:\n• Acompanhamento em tempo real\n• Relatórios de performance\n• Análise de risco\n\n⚙️ Configurações:\n• Limites de risco personalizados\n• Alertas inteligentes\n• Backup automático\n\nO que você gostaria de fazer?';
        messageType = 'info';
      }

      const newMessage: Message = {
        id: Date.now().toString(),
        content: botResponse,
        sender: 'bot',
        timestamp: new Date(),
        type: messageType
      };

      setMessages(prev => [...prev, newMessage]);
      setIsTyping(false);
    }, 2000);
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    simulateBotResponse(inputMessage);
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageIcon = (type?: Message['type']) => {
    switch (type) {
      case 'trade':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-full h-[600px] flex flex-col max-w-none bg-card/30 rounded-lg border border-border p-2">
      <Tabs defaultValue="chat" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2 bg-muted border border-border/50 mb-4 p-1 rounded-lg">
          <TabsTrigger 
            value="chat" 
            className="flex items-center gap-2 text-white data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-primary/10"
          >
            <MessageCircle className="h-4 w-4" />
            Chat do Assistente
          </TabsTrigger>
          <TabsTrigger 
            value="logs" 
            className="flex items-center gap-2 text-white data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-primary/10"
          >
            <Activity className="h-4 w-4" />
            Operações Tempo Real
            {logs.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs bg-primary/20 text-white border-primary/30">
                {logs.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <Card className="h-full flex flex-col bg-card border border-border shadow-lg">
            <CardHeader className="flex-shrink-0 border-b border-border pb-3 bg-card/50">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                <div className="relative">
                  <Bot className="h-5 w-5 text-primary" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse"></div>
                </div>
                Assistente de Arbitragem
                <Badge variant="secondary" className="ml-auto text-xs bg-success/20 text-white border-success/30">
                  Online
                </Badge>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 py-4 overflow-y-auto chat-scroll">
                <div className="space-y-6 pb-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 items-start w-full ${
                        message.sender === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.sender === 'bot' && (
                        <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                          <AvatarFallback className="bg-primary/10 border border-primary/20">
                            <Bot className="h-4 w-4 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div
                        className={`max-w-[80%] w-auto rounded-xl px-4 py-3 shadow-sm border chat-message ${
                          message.sender === 'user'
                            ? 'bg-primary border-primary/20 shadow-primary/10'
                            : 'bg-muted/80 border-border shadow-muted/20'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {message.sender === 'bot' && message.type && (
                            <div className="flex-shrink-0 mt-1">
                              {getMessageIcon(message.type)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm leading-relaxed chat-text message-content text-white">
                              {message.content}
                            </div>
                            <div className="text-xs mt-3 opacity-75 font-medium text-right text-white/80">
                              {formatTimestamp(message.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {message.sender === 'user' && (
                        <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                          <AvatarFallback className="bg-secondary border border-border">
                            <User className="h-4 w-4 text-secondary-foreground" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="flex gap-3 justify-start">
                      <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                        <AvatarFallback className="bg-primary/10 border border-primary/20">
                          <Bot className="h-4 w-4 text-primary animate-pulse" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted/80 rounded-xl px-4 py-3 border border-border shadow-sm chat-message">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                          </div>
                          <span className="text-sm font-medium text-white">Digitando...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex-shrink-0 border-t border-border p-4 bg-card/30">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-background border-border focus:border-primary focus:ring-primary/20 text-white placeholder:text-white/60"
                    disabled={isTyping}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTyping}
                    size="sm"
                    className="flex-shrink-0 px-4 bg-primary hover:bg-primary/90 text-white shadow-sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-3 text-xs text-white/70">
                  <span className="font-medium">Pressione Enter para enviar</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                    Conectado
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="flex-1 mt-0 data-[state=active]:block">
          <RealtimeLogger logs={logs} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChatInterface;