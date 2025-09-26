import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Plus, CheckCircle } from 'lucide-react';

const DETECTED_IPS = [
  '2600:1f1e:229:a902:dd9:531f:2243:158d',
  '2600:1f1e:229:a905:44d5:93b4:d4ea:bc7e',
  '2600:1f1e:229:a90b:397f:8ca:70b7:7fb8',
  '2600:1f1e:229:a909:c76c:f856:115a:9541',
  '2600:1f1e:229:a909:2a76:fe9a:30a4:4f2f',
  '2600:1f1e:229:a902:82cf:2097:c9de:3260'
];

export default function AutoIPWhitelistFixer() {
  const { toast } = useToast();
  const [fixing, setFixing] = useState(false);
  const [fixed, setFixed] = useState(false);

  const addAllIPs = async () => {
    setFixing(true);
    try {
      let successCount = 0;
      
      for (const ip of DETECTED_IPS) {
        try {
          const { error } = await supabase.functions.invoke('okx-whitelist-manager', {
            body: {
              action: 'add',
              ip_address: ip,
              description: `Edge Function IP detectado nos logs - ${ip.slice(-4)}`
            }
          });
          
          if (!error) {
            successCount++;
          }
        } catch (ipError) {
          console.log(`IP ${ip} já pode estar cadastrado`);
        }
      }
      
      toast({
        title: "✅ IPs Adicionados",
        description: `${successCount} IPs foram adicionados à whitelist automaticamente`,
        duration: 5000
      });
      
      setFixed(true);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao adicionar IPs à whitelist",
        variant: "destructive"
      });
    } finally {
      setFixing(false);
    }
  };

  if (fixed) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">IPs adicionados com sucesso!</span>
          </div>
          <p className="text-sm text-green-600 mt-2">
            Agora teste uma operação de arbitragem para verificar se o problema foi resolvido.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <Shield className="h-5 w-5" />
          Correção Automática de IP
        </CardTitle>
        <CardDescription className="text-blue-600">
          Detectamos {DETECTED_IPS.length} IPs IPv6 nos logs que precisam ser adicionados à whitelist
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-blue-700">
            <strong>IPs detectados:</strong>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {DETECTED_IPS.map((ip, index) => (
                <li key={index} className="bg-white/50 px-2 py-1 rounded">
                  {ip}
                </li>
              ))}
            </ul>
          </div>
          
          <Button 
            onClick={addAllIPs} 
            disabled={fixing}
            className="w-full"
          >
            {fixing ? (
              "Adicionando IPs..."
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Todos os IPs Automaticamente
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}