# 🚀 Guia Completo de Setup - SAAT + N8N + Smart Contract

Guia passo a passo para integrar tudo.

## 📋 Visão Geral

```
┌─────────────────┐
│  SAAT Frontend  │ (React/TypeScript)
└────────┬────────┘
         │ HTTP POST
         ↓
┌─────────────────┐
│   Edge Function │ (Supabase)
│  blockchain-    │
│  transfer       │
└────────┬────────┘
         │ Webhook
         ↓
┌─────────────────┐
│  N8N Workflow   │ (Automation)
└────────┬────────┘
         │ Web3 Call
         ↓
┌─────────────────┐
│ Smart Contract  │ (Solidity)
│ ArbitrageBot    │
└─────────────────┘
```

## 🎯 Passo 1: Deploy do Smart Contract

### 1.1 Instalar Dependências

```bash
cd contracts
npm install
```

### 1.2 Configurar .env

```bash
cp .env.example .env
nano .env
```

Preencha:
```env
PRIVATE_KEY=sua_private_key_aqui
ETHERSCAN_API_KEY=sua_api_key
BSCSCAN_API_KEY=sua_api_key
```

### 1.3 Compilar Contrato

```bash
npm run compile
```

### 1.4 Deploy

**Para BSC (recomendado - gas barato):**
```bash
npm run deploy:bsc
```

**Para Ethereum:**
```bash
npm run deploy:mainnet
```

**Para Polygon:**
```bash
npm run deploy:polygon
```

### 1.5 Copiar Endereço do Contrato

Após deploy bem-sucedido, você verá:
```
✅ ArbitrageBot deployed to: 0x1234567890abcdef...
```

**SALVE ESTE ENDEREÇO!** Você vai precisar dele.

### 1.6 Verificar Contrato (Opcional mas Recomendado)

```bash
npx hardhat verify --network bsc 0xSEU_ENDERECO_CONTRATO
```

Isso permite que outros vejam o código no BscScan.

---

## 🎯 Passo 2: Configurar N8N

### 2.1 Acesse seu N8N

Se não tem n8n:
- **Cloud**: https://n8n.io/ (criar conta)
- **Self-hosted**: https://docs.n8n.io/hosting/

### 2.2 Instalar Pacotes Node.js

No n8n self-hosted, instale:
```bash
cd ~/.n8n
npm install web3@latest
npm install ethers@latest
```

No n8n cloud, esses pacotes já estão disponíveis.

### 2.3 Importar Workflow

1. Download: `n8n-workflows/arbitrage-smart-contract.json`
2. N8N → **Workflows** → **Import from File**
3. Selecione o arquivo JSON
4. Clique **Import**

### 2.4 Configurar Credenciais

#### A. Supabase Auth

1. Clique no nó **"Save to Supabase"**
2. Credentials → **Create New** → **HTTP Header Auth**
3. Configure:

**Header 1:**
- Name: `apikey`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aGNzamxmd2tod2t2aGZhY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDEzMzQsImV4cCI6MjA2Njk3NzMzNH0.WLA9LhdQHPZJpTC1qasafl3Gb7IqRvXN61XVcKnzx0U`

**Header 2:**
- Name: `Authorization`
- Value: `Bearer [SERVICE_ROLE_KEY]`

Para obter SERVICE_ROLE_KEY:
- https://supabase.com/dashboard/project/uxhcsjlfwkhwkvhfacho/settings/api
- Copie o `service_role (secret)` key

#### B. Web3 Private Key

1. Credentials → **Create New** → **Generic**
2. Configure:
   - **Name**: `Web3 Private Key`
   - **Field Name**: `web3PrivateKey`
   - **Value**: Sua private key (com 0x)

**⚠️ ATENÇÃO:**
- NUNCA compartilhe sua private key
- Use uma wallet dedicada para o bot
- Mantenha apenas o capital necessário nela

### 2.5 Atualizar Endereços do Contrato

Nos nós **"Simulate Arbitrage"** e **"Execute Arbitrage"**, encontre:

```javascript
const contractAddresses = {
  ethereum: '0xYOUR_CONTRACT_ADDRESS_ETHEREUM',
  bsc: '0xYOUR_CONTRACT_ADDRESS_BSC',
  polygon: '0xYOUR_CONTRACT_ADDRESS_POLYGON'
};
```

Substitua pelos endereços reais dos seus contratos deployados.

### 2.6 Ativar Workflow

1. Toggle **Active** no topo (deve ficar verde)
2. Copie a **Production URL** do webhook
   - Exemplo: `https://sua-instancia.n8n.cloud/webhook/arbitrage-execute`

---

## 🎯 Passo 3: Integrar com SAAT Frontend

### 3.1 Salvar Webhook URL

No SAAT, vá para a página **N8N Integration** e:
1. Cole a URL do webhook copiada
2. Selecione tipo: **Arbitrage Execution**
3. Clique **Testar Webhook**
4. Clique **Salvar e Ativar**

### 3.2 Configurar Wallet Web3

No SAAT:
1. Vá para **Web3 Wallet Manager**
2. Conecte sua MetaMask
3. Certifique-se que está na network correta (BSC/Ethereum/Polygon)

### 3.3 Adicionar Fundos

Envie para a wallet do bot:
- **Gas**: ETH (Ethereum), BNB (BSC), ou MATIC (Polygon)
- **Capital**: USDT, USDC, ou tokens que vai arbitrar

**Valores recomendados para teste:**
- Gas: 0.1 BNB / 0.05 ETH / 10 MATIC
- Capital: $100-500 USDT

---

## 🎯 Passo 4: Teste Completo

### 4.1 Teste Manual no N8N

1. No workflow, clique **Execute Workflow**
2. Em **Manual**, cole payload de teste:

```json
{
  "userId": "test-user-id",
  "tokenIn": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  "tokenOut": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  "amountIn": "0.1",
  "buyDex": "pancakeswap",
  "sellDex": "biswap",
  "minProfit": "0.001",
  "network": "bsc"
}
```

3. Clique **Execute Node** em cada etapa
4. Verifique se não há erros

### 4.2 Teste via SAAT

1. No SAAT, vá para **Arbitrage Calculator**
2. Selecione:
   - Token: WBNB/BUSD
   - Network: BSC
   - Amount: 0.1
   - Buy DEX: PancakeSwap
   - Sell DEX: Biswap
3. Clique **Executar Arbitragem**
4. Confirme na MetaMask (se necessário)

### 4.3 Verificar Resultado

**No N8N:**
- Executions → Ver última execução
- Verificar se todos os nós passaram ✅

**No SAAT:**
- Blockchain Transfer Hub → Ver histórico
- Deve mostrar transação com status "completed"

**No Block Explorer:**
- BSCScan: https://bscscan.com/tx/[TX_HASH]
- Etherscan: https://etherscan.io/tx/[TX_HASH]
- PolygonScan: https://polygonscan.com/tx/[TX_HASH]

---

## 🔍 Monitoramento e Logs

### Ver Logs do N8N
```
N8N → Executions → Click na execução → Ver detalhes de cada nó
```

### Ver Logs do Supabase Edge Function
```
https://supabase.com/dashboard/project/uxhcsjlfwkhwkvhfacho/functions/blockchain-transfer/logs
```

### Ver Transações no Banco
```sql
SELECT * FROM blockchain_transfers 
ORDER BY created_at DESC 
LIMIT 20;
```

### Ver Eventos do Smart Contract

No block explorer, vá para o endereço do contrato:
- Aba **Events**
- Procure por `ArbitrageExecuted`

---

## ⚠️ Troubleshooting

### Erro: "Insufficient funds"
**Causa**: Wallet sem ETH/BNB/MATIC para gas
**Solução**: Envie gas para a wallet

### Erro: "Contract not deployed"
**Causa**: Endereço do contrato errado no n8n
**Solução**: Verifique e atualize os endereços

### Erro: "Transaction reverted"
**Causa**: Simulação OK mas execução falhou (slippage)
**Solução**: Aumente `maxSlippageBasisPoints` no contrato

### Erro: "Invalid private key"
**Causa**: Formato da private key incorreto
**Solução**: Certifique-se que começa com `0x`

### Erro: "Webhook not found"
**Causa**: Workflow não está ativo
**Solução**: Ative o workflow no n8n

### N8N não recebe chamadas
**Causa**: URL do webhook incorreta
**Solução**: Copie novamente a Production URL

---

## 🔐 Segurança

### ✅ Checklist de Segurança

- [ ] Private key armazenada apenas no n8n credentials
- [ ] Wallet do bot separada da principal
- [ ] Apenas capital necessário na wallet do bot
- [ ] Webhook com autenticação (opcional mas recomendado)
- [ ] IP whitelist no n8n (se self-hosted)
- [ ] Monitoramento de transações ativo
- [ ] Alertas de saldo baixo configurados

### Recomendações Adicionais

1. **Use Multi-Sig**
   - Configure o contrato com multi-sig para owner
   - Requer 2+ aprovações para mudanças críticas

2. **Monitore Constantemente**
   - Configure alertas via email/telegram
   - Use ferramentas como Tenderly para monitorar

3. **Limite de Perda**
   - Configure `stop_loss_percentage` no contrato
   - Pause se perder X% em um dia

4. **Teste em Testnet Primeiro**
   - Sempre teste com testnet tokens antes
   - Use faucets para obter tokens de teste

---

## 🎯 Próximos Passos

Agora você está pronto para:
1. ✅ Deploy do contrato
2. ✅ Configurar n8n workflow  
3. ⏳ **Integrar com interface SAAT** (Item 3 - próximo!)

Quer continuar para o Item 3?
