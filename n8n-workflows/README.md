# N8N Workflow - SAAT Arbitrage Smart Contract

Workflow completo para executar arbitragem via smart contract usando n8n.

## 🎯 Fluxo de Execução

```
SAAT Frontend → Webhook n8n → Validação → Simulação (Web3) → 
Verificação Lucro → Execução On-Chain → Salvar Supabase → Resposta
```

## 📦 Pré-requisitos

1. **N8N instalado** (cloud ou self-hosted)
2. **Smart contract deployado** (veja `/contracts/README.md`)
3. **Node.js packages** instalados no n8n:
   - `web3` (para interagir com blockchain)
   - `ethers` (alternativa ao web3, opcional)

## 🚀 Como Importar o Workflow

### 1. Acesse seu n8n
```
https://sua-instancia.n8n.cloud
```

### 2. Importe o Workflow
1. Clique em **Workflows** → **Import from File**
2. Selecione `arbitrage-smart-contract.json`
3. Clique em **Import**

### 3. Configure as Credenciais

#### A. Supabase Credentials
1. Clique no nó **"Save to Supabase"**
2. Em **Credentials**, crie novo **HTTP Header Auth**:
   - **Name**: `Supabase Header Auth`
   - **Header Name**: `apikey`
   - **Header Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aGNzamxmd2tod2t2aGZhY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDEzMzQsImV4cCI6MjA2Njk3NzMzNH0.WLA9LhdQHPZJpTC1qasafl3Gb7IqRvXN61XVcKnzx0U`
   - Adicione outro header:
     - **Header Name**: `Authorization`
     - **Header Value**: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (service role key)

#### B. Web3 Private Key (Credencial Personalizada)
1. Em **Credentials** → **Create New**
2. Selecione tipo: **Generic Credential**
3. Configure:
   - **Name**: `Web3 Private Key`
   - **Field Name**: `web3PrivateKey`
   - **Value**: Sua private key (NUNCA compartilhe!)

### 4. Atualizar Endereços do Contrato

No código dos nós **"Simulate Arbitrage"** e **"Execute Arbitrage"**, atualize:

```javascript
const contractAddresses = {
  ethereum: '0xSEU_CONTRATO_ETHEREUM',
  bsc: '0xSEU_CONTRATO_BSC',
  polygon: '0xSEU_CONTRATO_POLYGON'
};
```

Com os endereços reais após o deploy.

### 5. Ativar o Workflow
1. Clique no toggle **"Active"** no topo
2. Copie a **Production URL** do webhook
3. Cole no SAAT (componente N8NIntegration)

## 🔧 Configuração Manual (Alternativa)

Se preferir criar manualmente:

### Node 1: Webhook
- **Type**: Webhook
- **HTTP Method**: POST
- **Path**: `arbitrage-execute`

### Node 2: Extract Parameters
- **Type**: Set
- Extrair: `tokenIn`, `tokenOut`, `amountIn`, `buyDex`, `sellDex`, `minProfit`, `userId`, `network`

### Node 3: Validate Parameters
- **Type**: IF
- Verificar se todos os campos estão preenchidos

### Node 4: Simulate Arbitrage
- **Type**: Function
- **Code**: Ver `arbitrage-smart-contract.json` → node "Simulate Arbitrage (Web3)"

### Node 5: Check Profitability
- **Type**: IF
- Verificar se `profitable === true`

### Node 6: Execute Arbitrage
- **Type**: Function
- **Code**: Ver `arbitrage-smart-contract.json` → node "Execute Arbitrage (Web3)"

### Node 7: Save to Supabase
- **Type**: HTTP Request
- **Method**: POST
- **URL**: `https://uxhcsjlfwkhwkvhfacho.supabase.co/rest/v1/blockchain_transfers`

### Node 8: Respond
- **Type**: Respond to Webhook
- Retornar resultado da execução

## 📊 Exemplo de Payload

```json
{
  "userId": "uuid-do-usuario",
  "tokenIn": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "tokenOut": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "amountIn": "1.0",
  "buyDex": "uniswap",
  "sellDex": "sushiswap",
  "minProfit": "0.005",
  "network": "ethereum"
}
```

## 🔐 Segurança

### IMPORTANTE! Proteja sua Private Key

1. **NUNCA** exponha a private key no código
2. Use credenciais do n8n
3. Configure IP whitelist no n8n
4. Use webhook authentication (Bearer token)

### Adicionar Auth no Webhook

No nó Webhook, adicione:
- **Authentication**: Header Auth
- **Header Name**: `X-API-Key`
- **Value**: Gere um token seguro

No SAAT, adicione o header:
```typescript
headers: {
  'X-API-Key': 'seu-token-secreto'
}
```

## 📈 Monitoramento

### Ver Logs no n8n
1. Clique no workflow
2. **Executions** → Ver histórico de execuções
3. Clique em uma execução para ver detalhes

### Ver Logs no Supabase
```sql
SELECT * FROM blockchain_transfers 
ORDER BY created_at DESC 
LIMIT 10;
```

## ⚠️ Troubleshooting

### Erro: "Insufficient funds"
- Verifique saldo da wallet conectada
- Certifique-se que há ETH/BNB/MATIC para gas

### Erro: "Contract address not found"
- Verifique se atualizou os endereços no código
- Confirme que o contrato foi deployado na network correta

### Erro: "Transaction reverted"
- Simulação indicou lucro mas execução falhou
- Provavelmente slippage ou mudança de preço
- Aumente o slippage tolerance no contrato

### Erro: "Invalid private key"
- Verifique formato da private key (deve começar com 0x)
- Certifique-se que configurou a credencial corretamente

## 🎯 Testing

### Teste com Testnet primeiro!

1. Deploy o contrato em Goerli/Mumbai
2. Use faucets para obter ETH de teste
3. Execute arbitragem com valores pequenos
4. Monitore logs e transações

### Faucets Testnet
- Goerli: https://goerlifaucet.com/
- Mumbai: https://faucet.polygon.technology/
- BSC Testnet: https://testnet.binance.org/faucet-smart

## 📚 Recursos

- [N8N Docs](https://docs.n8n.io/)
- [Web3.js Docs](https://web3js.readthedocs.io/)
- [Smart Contract Code](/contracts/ArbitrageBot.sol)

## 🆘 Suporte

Se encontrar problemas:
1. Verifique logs do n8n
2. Verifique transações no block explorer
3. Consulte documentação do smart contract
