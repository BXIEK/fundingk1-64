import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Globe, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/userUtils";
import { toast } from "sonner";

interface WhitelistIP {
  id: string;
  ip_address: unknown;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const OKXWhitelistManager: React.FC = () => {
  const [ips, setIps] = useState<WhitelistIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIP, setNewIP] = useState({ ip_address: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWhitelistIPs();
  }, []);

  const loadWhitelistIPs = async () => {
    try {
      const userId = await getUserId();

      const { data, error } = await supabase.functions.invoke('okx-whitelist-manager', {
        body: { action: 'list', user_id: userId },
      });

      if (error) throw error;
      setIps((data?.items as WhitelistIP[]) || []);
    } catch (error) {
      console.error('Erro ao carregar IPs da whitelist:', error);
      toast.error('Erro ao carregar IPs da whitelist');
    } finally {
      setLoading(false);
    }
  };

  const addIP = async () => {
    if (!newIP.ip_address.trim()) {
      toast.error('Por favor, insira um endereço IP válido');
      return;
    }

    setSaving(true);
    try {
      const userId = await getUserId();

      const { data, error } = await supabase.functions.invoke('okx-whitelist-manager', {
        body: {
          action: 'add',
          user_id: userId,
          ip_address: newIP.ip_address.trim(),
          description: newIP.description.trim(),
        },
      });

      const serverMsg = (error as any)?.context?.body?.error || (error as any)?.context?.error || data?.error || (error as any)?.message;
      if (error || !data?.success) throw new Error(serverMsg || 'Falha ao adicionar');

      toast.success('IP adicionado com sucesso!');
      setNewIP({ ip_address: '', description: '' });
      await loadWhitelistIPs();
    } catch (error: any) {
      console.error('Erro ao adicionar IP:', error);
      toast.error('Erro ao adicionar IP: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleIPStatus = async (id: string, currentStatus: boolean) => {
    try {
      const userId = await getUserId();
      const { data, error } = await supabase.functions.invoke('okx-whitelist-manager', {
        body: { action: 'toggle', id, currentStatus, user_id: userId },
      });
      const serverMsg = (error as any)?.context?.body?.error || (error as any)?.context?.error || data?.error || (error as any)?.message;
      if (error || !data?.success) throw new Error(serverMsg || 'Falha ao atualizar');

      toast.success(`IP ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
      loadWhitelistIPs();
    } catch (error: any) {
      console.error('Erro ao alterar status do IP:', error);
      toast.error('Erro ao alterar status: ' + error.message);
    }
  };

  const deleteIP = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este IP?')) return;

    try {
      const userId = await getUserId();
      const { data, error } = await supabase.functions.invoke('okx-whitelist-manager', {
        body: { action: 'delete', id, user_id: userId },
      });
      const serverMsg = (error as any)?.context?.body?.error || (error as any)?.context?.error || data?.error || (error as any)?.message;
      if (error || !data?.success) throw new Error(serverMsg || 'Falha ao deletar');

      toast.success('IP removido com sucesso!');
      loadWhitelistIPs();
    } catch (error: any) {
      console.error('Erro ao deletar IP:', error);
      toast.error('Erro ao deletar IP: ' + error.message);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Gerenciamento de Whitelist OKX</CardTitle>
          </div>
          <CardDescription>
            Gerencie os endereços IP autorizados para acessar a API da OKX. 
            As edge functions utilizarão apenas IPs ativos desta lista.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <Alert>
            <Globe className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Adicione aqui os IPs que você configurou na whitelist da sua conta OKX.
              As requisições da API só funcionarão com IPs válidos e ativos.
            </AlertDescription>
          </Alert>

          {/* Formulário para adicionar novo IP */}
          <div className="grid gap-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Novo IP
            </h3>
            
            <div className="grid gap-2">
              <Label htmlFor="ip-address">Endereço IP</Label>
              <Input
                id="ip-address"
                placeholder="Ex: 192.168.1.1 ou 0.0.0.0/0 (todos os IPs)"
                value={newIP.ip_address}
                onChange={(e) => setNewIP(prev => ({ ...prev, ip_address: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descrição (Opcional)</Label>
              <Textarea
                id="description"
                placeholder="Descrição do IP ou local de origem"
                value={newIP.description}
                onChange={(e) => setNewIP(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <Button 
              onClick={addIP} 
              disabled={saving || !newIP.ip_address.trim()}
              className="w-full"
            >
              {saving ? 'Adicionando...' : 'Adicionar IP'}
            </Button>
          </div>

          {/* Lista de IPs existentes */}
          <div className="space-y-3">
            <h3 className="font-semibold">IPs Configurados ({ips.length})</h3>
            
            {ips.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nenhum IP configurado. Adicione um IP da whitelist OKX para habilitar as requisições da API.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {ips.map((ip) => (
                  <div key={ip.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                          {String(ip.ip_address)}
                        </code>
                        <Badge variant={ip.is_active ? 'default' : 'secondary'}>
                          {ip.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      {ip.description && (
                        <p className="text-sm text-muted-foreground">{ip.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Adicionado: {new Date(ip.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={ip.is_active}
                        onCheckedChange={() => toggleIPStatus(ip.id, ip.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteIP(ip.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Informações adicionais */}
          <Alert>
            <AlertDescription>
              <div className="space-y-2 text-sm">
                <p><strong>Dica:</strong> Para permitir todos os IPs, use <code>0.0.0.0/0</code></p>
                <p><strong>Teste:</strong> Após adicionar um IP, teste a conexão com a OKX na aba de configuração da API</p>
                <p><strong>Segurança:</strong> Use IPs específicos sempre que possível para maior segurança</p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default OKXWhitelistManager;