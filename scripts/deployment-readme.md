# Scripts de Deploy de Smart Contracts

Deploy e gerenciamento dos contratos `AddressDiscovery`, `AccessChannelManager` e `SchemaRegistry`.

## Como Usar

### Deploy Completo (Todos os Contratos)

Deploy dos três contratos na ordem correta:

```bash
# Localmente (localhost)
npm run deploy:all:localhost
```

**O que é deployado:**

1. `AddressDiscovery` (com deployer como admin)
2. `AccessChannelManager` (independente)
3. `SchemaRegistry` (com endereço do AddressDiscovery)

### Deploy Individual de Contratos

Deploy de contratos um por vez:

```bash
# Deploy apenas AddressDiscovery
npm run deploy:address-discovery:localhost

# Deploy apenas AccessChannelManager
npm run deploy:access-channel-manager:localhost

# Deploy apenas SchemaRegistry (requer AddressDiscovery deployado primeiro)
npm run deploy:schema-registry:localhost
```

### Configuração do Sistema

Registrar contratos no `AddressDiscovery` para comunicação entre contratos:

```bash
# Registrar todos os contratos no AddressDiscovery
npm run address-discovery:all:localhost
```

**O que faz:**

- Registra `AccessChannelManager` no AddressDiscovery
- Registra `SchemaRegistry` no AddressDiscovery
- Usa `signers` administrativos com as roles necessárias

### Registro de Contrato Individual

Registrar um contrato específico no AddressDiscovery:

```bash
npm run address-discovery:single-contract:localhost --contract=ContractName
```

### Gerenciamento de Administradores

#### Gerenciar Admins do `AddressDiscovery`

```bash
# Adicionar admin
npm run address-discovery-admin:localhost --action=add --address=0x1234567890123456789012345678901234567890

# Remover admin
npm run address-discovery-admin:localhost --action=remove --address=0x1234567890123456789012345678901234567890
```

#### Gerenciar Admins do `AccessChannelManager`

```bash
# Adicionar channel admin
npm run access-channel-admin:localhostv --action=add --role=admin --address=0x1234567890123456789012345678901234567890

# Adicionar channel authority
npm run access-channel-admin:localhost --action=add --role=authority --address=0x1234567890123456789012345678901234567890

# Remover channel admin
npm run access-channel-admin:localhost --action=remove --role=admin --address=0x1234567890123456789012345678901234567890

# Remover channel authority
npm run access-channel-admin:localhost --action=remove --role=authority --address=0x1234567890123456789012345678901234567890
```

#### Gerenciar Admins do `SchemaRegistry`

```bash
# Adicionar schema admin
npm run schema-registry-admin:localhost --action=add --address=0x1234567890123456789012345678901234567890

# Remover schema admin
npm run schema-registry-admin:localhost --action=remove --address=0x1234567890123456789012345678901234567890
```

## 📁 Estrutura dos Arquivos

```
scripts/
├── lib/
│   ├── types.ts                    # Interfaces TypeScript comuns
│   ├── deploymentUtils.ts          # Utilitários de deploy
│   └── signerUtils.ts              # Gerenciamento de signers
├── single/
│   ├── deployAddressDiscovery.ts   # Deploy apenas AddressDiscovery
│   ├── deployAccessChannelManager.ts # Deploy apenas AccessChannelManager
│   ├── deploySchemaRegistry.ts     # Deploy apenas SchemaRegistry
│   └── contractToAddressDiscovery.ts # Registrar contrato individual
├── admin/
│   ├── addressDiscoveryAdmin.ts    # Gerenciar admins AddressDiscovery
│   ├── accessChannelAdmin.ts       # Gerenciar admins AccessChannelManager
│   └── schemaRegistryAdmin.ts      # Gerenciar admins SchemaRegistry
├── deploy.ts                       # Deploy todos os contratos
└── addToAddressDiscovery.ts        # Registrar todos os contratos

deployments/                        # Rastreamento automático de deploys
└── localhost.json                  # Endereços local
```

## Rastreamento de Deploys

Todos os deploys são automaticamente rastreados em arquivos JSON:

```json
// deployments/localhost.json
{
  "AddressDiscovery": {
    "contractName": "AddressDiscovery",
    "address": "0x1234567890123456789012345678901234567890",
    "deployer": "0x5678901234567890123456789012345678901234",
    "transactionHash": "0xabcd1234567890abcdef1234567890abcdef1234",
    "blockNumber": 12345678,
    "gasUsed": "1234567",
    "deploymentArgs": ["0x5678901234567890123456789012345678901234"],
    "timestamp": 1703721600000
  },
  "AccessChannelManager": { ... },
  "SchemaRegistry": { ... }
}
```

## Segurança e Roles

### Roles Necessárias

- **DEFAULT_ADMIN_ROLE**: Pode gerenciar outras roles admin
- **ADDRESS_DISCOVERY_ADMIN_ROLE**: Pode atualizar endereços de contratos no AddressDiscovery
- **CHANNEL_AUTHORITY_ROLE**: Pode criar/gerenciar canais no AccessChannelManager
- **CHANNEL_ADMIN_ROLE**: Pode gerenciar membros de canais
- **SCHEMA_ADMIN_ROLE**: Pode gerenciar admins de schema

### Gerenciamento de Chaves Privadas

Os scripts usam diferentes chaves privadas para diferentes roles:

- **DEPLOYER_PRIVATE_KEY**: Deploya contratos e recebe roles admin iniciais
- **DEFAULT_ADMIN_PRIVATE_KEY**: Gerencia roles admin nos contratos
- **ADDRESS_DISCOVERY_ADMIN_ROLE_PRIVATE_KEY**: Gerencia atualizações do AddressDiscovery

## Exemplo de Workflow Completo

### 1. Deploy Localmente

```bash
# 1. Deploy todos os contratos
npm run deploy:localhost

# 2. Registrar contratos no AddressDiscovery
npm run address-discovery:all:localhost

# 3. Adicionar admins adicionais se necessário
npm run address-discovery-admin:localhost --action=add --address=0x1234...
npm run access-channel-admin:localhost --action=add --role=authority --address=0x1234...
```

## Solução de Problemas

### Problemas Comuns

**"Missing contract addresses in deployment file"**

- Solução: Deploy os contratos primeiro usando os scripts de deploy

**"AddressDiscovery not found in deployments"**

- Solução: Deploy o `AddressDiscovery` primeiro: `npm run deploy:address-discovery:localhost`

**"does not have ADDRESS_DISCOVERY_ADMIN_ROLE"**

- Solução: Verificar sua `ADDRESS_DISCOVERY_ADMIN_ROLE_PRIVATE_KEY` no arquivo de ambiente

### Verificação

Para verificar se os deploys estão funcionando:

1. Verificar `deployments/{network}.json` para endereços dos contratos
2. Usar block explorer para verificar deploy do contrato
3. Testar funções admin para verificar atribuição de roles

## Referência Rápida

| Ação                                      | Comando                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Deploy todos os contratos                 | `npm run deploy:localhost`                                                            |
| Deploy contrato individual                | `npm run deploy:address-discovery:localhost`                                          |
| Configurar sistema                        | `npm run address-discovery:all:localhost`                                             |
| Adicionar contrato individual ao registry | `npm run address-discovery:single-contract:localhost --contract=NomeContrato`         |
| Adicionar admin                           | `npm run address-discovery-admin:localhost --action=add --address=0x...`              |
| Remover admin                             | `npm run access-channel-admin:localhost --action=remove --role=admin --address=0x...` |
