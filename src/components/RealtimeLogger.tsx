import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Clock, CheckCircle, AlertCircle, Info, TrendingUp, Zap } from 'lucide-react';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error' | 'trade';
  message: string;
  details?: any;
  operation?: string;
  exchange?: string;
  symbol?: string;
  duration?: number;
}

interface RealtimeLoggerProps {
  logs: LogEntry[];
  maxLogs?: number;
}

const RealtimeLogger = ({ logs, maxLogs = 100 }: RealtimeLoggerProps) => {
  const [visibleLogs, setVisibleLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Manter apenas os logs mais recentes
    const recentLogs = logs.slice(-maxLogs);
    setVisibleLogs(recentLogs);
  }, [logs, maxLogs]);

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-3 w-3 text-yellow-500" />;
      case 'trade':
        return <TrendingUp className="h-3 w-3 text-blue-500" />;
      case 'info':
      default:
        return <Info className="h-3 w-3 text-blue-400" />;
    }
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return 'bg-green-500/10 border-green-500/20 text-green-200';
      case 'error':
        return 'bg-red-500/10 border-red-500/20 text-red-200';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200';
      case 'trade':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-200';
      case 'info':
      default:
        return 'bg-blue-400/10 border-blue-400/20 text-blue-100';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return null;
    if (duration < 1000) {
      return `${Math.round(duration)}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
  };

  return (
    <Card className="h-full border border-border bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className="relative">
            <Zap className="h-4 w-4 text-primary" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
          </div>
          Logs em Tempo Real
          <Badge variant="secondary" className="ml-auto text-xs">
            {visibleLogs.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="space-y-1 p-4">
            {visibleLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aguardando operações...
              </div>
            ) : (
              visibleLogs.map((log, index) => (
                <div key={log.id} className="space-y-1">
                  <div className={`p-2 rounded border text-xs ${getLevelColor(log.level)}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {getLevelIcon(log.level)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3 w-3 opacity-60" />
                          <span className="font-mono text-xs opacity-90">
                            {formatTimestamp(log.timestamp)}
                          </span>
                          
                          {log.operation && (
                            <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                              {log.operation}
                            </Badge>
                          )}
                          
                          {log.exchange && (
                            <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                              {log.exchange}
                            </Badge>
                          )}
                          
                          {log.symbol && (
                            <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                              {log.symbol}
                            </Badge>
                          )}
                          
                          {log.duration && (
                            <Badge variant="outline" className="text-xs px-1 py-0 h-4 ml-auto">
                              {formatDuration(log.duration)}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm leading-relaxed">
                          {log.message}
                        </div>
                        
                        {log.details && (
                          <div className="mt-1 p-2 bg-black/20 rounded border text-xs font-mono">
                            <pre className="whitespace-pre-wrap text-xs">
                              {typeof log.details === 'object' 
                                ? JSON.stringify(log.details, null, 2)
                                : log.details}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {index < visibleLogs.length - 1 && (
                    <Separator className="opacity-20" />
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default RealtimeLogger;