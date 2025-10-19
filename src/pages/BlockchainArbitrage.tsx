import { Header } from "@/components/Header";
import { BlockchainArbitrageExecutor } from "@/components/BlockchainArbitrageExecutor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const BlockchainArbitrage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-4xl font-bold mb-2">Arbitragem Blockchain</h1>
            <p className="text-muted-foreground">
              Execute arbitragem descentralizada via smart contracts usando n8n
            </p>
          </div>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este módulo permite executar arbitragem cross-DEX diretamente on-chain através de smart contracts,
              contornando restrições de exchanges centralizadas. O n8n orquestra as transações automaticamente.
            </AlertDescription>
          </Alert>

          {/* Documentation Links */}
          <Card>
            <CardHeader>
              <CardTitle>Documentação</CardTitle>
              <CardDescription>
                Guias para configurar o sistema completo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-between" asChild>
                <a href="/contracts/README.md" target="_blank" rel="noopener noreferrer">
                  Smart Contract - Deploy e Configuração
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" className="w-full justify-between" asChild>
                <a href="/n8n-workflows/SETUP-GUIDE.md" target="_blank" rel="noopener noreferrer">
                  n8n Workflow - Guia de Setup
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Main Executor */}
          <BlockchainArbitrageExecutor />

          {/* How it Works */}
          <Card>
            <CardHeader>
              <CardTitle>Como Funciona</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">1. Smart Contract</h3>
                <p className="text-sm text-muted-foreground">
                  Contrato Solidity gerencia a lógica de arbitragem cross-DEX, garantindo execução atômica e segura.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">2. n8n Orquestração</h3>
                <p className="text-sm text-muted-foreground">
                  Workflow n8n monitora oportunidades, simula operações e aciona o smart contract quando detecta lucro.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">3. Execução On-Chain</h3>
                <p className="text-sm text-muted-foreground">
                  Transação é executada diretamente na blockchain, sem depender de APIs de exchanges centralizadas.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BlockchainArbitrage;
