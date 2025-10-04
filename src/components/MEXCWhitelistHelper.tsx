import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Copy, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export default function MEXCWhitelistHelper() {
  const [detectedIPs, setDetectedIPs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const knownIPs = [
    "18.231.185.29",
    "18.231.121.117", 
    "18.230.103.141",
    "18.231.63.95",
    "18.231.180.236",
    "18.228.156.0",
    "18.231.153.4",
    "56.124.94.117",
    "18.231.62.219",
    "52.67.73.86",
    "18.231.115.43"
  ];

  const scanForNewIPs = async () => {
    setLoading(true);
    try {
      // Buscar logs recentes da função mexc-api
      const { data: logs } = await supabase.functions.invoke('supabase-edge-function-logs', {
        body: { 
          function_name: 'mexc-api',
          search: 'IP'
        }
      });

      if (logs) {
        // Extrair IPs dos logs
        const ipRegex = /IP\s+\[?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]?/g;
        const foundIPs = new Set<string>();
        
        const logsString = JSON.stringify(logs);
        let match;
        
        while ((match = ipRegex.exec(logsString)) !== null) {
          foundIPs.add(match[1]);
        }

        const allIPs = Array.from(new Set([...knownIPs, ...Array.from(foundIPs)])).sort();
        setDetectedIPs(allIPs);
        setLastUpdate(new Date());
        
        toast.success(`Scan completo: ${allIPs.length} IPs detectados`);
      }
    } catch (error: any) {
      console.error('Erro ao escanear IPs:', error);
      toast.error("Erro ao escanear logs: " + error.message);
      setDetectedIPs(knownIPs);
    } finally {
      setLoading(false);
    }
  };

  const copyAllIPs = () => {
    const ipsText = detectedIPs.join('\n');
    navigator.clipboard.writeText(ipsText);
    toast.success("Lista de IPs copiada!");
  };

  const copyIP = (ip: string) => {
    navigator.clipboard.writeText(ip);
    toast.success(`IP ${ip} copiado!`);
  };

  useEffect(() => {
    setDetectedIPs(knownIPs);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              MEXC IP Whitelist Helper
            </CardTitle>
            <CardDescription>
              Sistema automático de detecção de IPs do Supabase
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={scanForNewIPs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Escanear Logs
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            <strong>⚠️ ATENÇÃO:</strong> A MEXC não suporta CIDR ranges. Você precisa adicionar cada IP individualmente.
            <br />
            <br />
            <strong>Como adicionar na MEXC:</strong>
            <ol className="list-decimal ml-6 mt-2 space-y-1">
              <li>Acesse <a href="https://www.mexc.com/user/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">MEXC API Management</a></li>
              <li>Clique em "Edit" na sua API Key</li>
              <li>Em "IP Access Restrictions", selecione "Restrict access to trusted IPs only"</li>
              <li>Adicione cada IP da lista abaixo (um por vez)</li>
              <li>Clique em "Confirm"</li>
            </ol>
          </AlertDescription>
        </Alert>

        {lastUpdate && (
          <div className="text-sm text-muted-foreground">
            Última atualização: {lastUpdate.toLocaleString('pt-BR')}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            IPs Detectados ({detectedIPs.length})
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyAllIPs}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar Todos
          </Button>
        </div>

        <div className="grid gap-2 max-h-[400px] overflow-y-auto">
          {detectedIPs.map((ip, index) => (
            <div
              key={ip}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono">
                  #{index + 1}
                </Badge>
                <code className="text-sm font-mono">{ip}</code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyIP(ip)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <strong>💡 Dica:</strong> Execute o "Escanear Logs" periodicamente para detectar novos IPs do Supabase. 
            Os IPs podem mudar quando o Supabase faz rotação de infraestrutura.
          </AlertDescription>
        </Alert>

        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>⚠️ Problema Identificado:</strong> Devido à rotação dinâmica de IPs do Supabase, você precisará:
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Monitorar logs regularmente</li>
              <li>Adicionar novos IPs quando detectados</li>
              <li>Ou considerar usar um proxy com IP fixo</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
