# Documentação do Sistema de Canais de Acesso (IAccessChannelManager)


## Visão Geral
O [`IAccessChannelManager`](../docs/interfaces/IAccessChannelManager.md) implementa um sistema de controle de acesso baseado em canais para substituir a funcionalidade nativa de `channels` do Hyperledger Fabric no ambiente Ethereum/Besu. Este componente gerencia permissões granulares e membership dinâmico, permitindo segregação de dados e operações por grupos de participantes.

### Motivação da Migração
Na transição Fabric → Ethereum/Besu, os canais nativos são substituídos por este sistema de canais virtuais que mantém:

- **Isolamento de dados**: Controle de acesso baseado em membership;
- **Permissões granulares**: Validação de participação antes de operações;
- **Auditabilidade completa**: Histórico imutável de mudanças de membership;

***

## Interface Funcional

### Gestão de Canais

#### Criação e Ciclo de Vida
```solidity
createChannel(bytes32 channelName)
activateChannel(bytes32 channelName) 
desactivateChannel(bytes32 channelName)
```

Estabelece contextos de negócio isolados onde diferentes grupos de participantes operam. Canais podem ser temporariamente desativados sem perda de dados históricos. Permitem o isolamento de processos.

### Gestão de Membership

#### Operações Individuais
```solidity	
addChannelMember(bytes32 channelName, address member)
removeChannelMember(bytes32 channelName, address member)
```

#### Operações em Lote
```solidity
addChannelMembers(bytes32 channelName, address[] calldata members)
removeChannelMembers(bytes32 channelName, address[] calldata members)
```
Mantém o controle dinâmico de quem pode participar de cada contexto de canal. Operações em lote otimizam custos de gas para operações massivas.

### Consultas e Validação

#### Verificação de Membership
```solidity	
isChannelMember(bytes32 channelName, address member) → bool
areChannelMembers(bytes32 channelName, address[] calldata members) → bool[]
```
Permite a validação de permissões em tempo de execução antes de operações sensíveis.

#### Relatórios
```solidity
getChannelInfo(bytes32 channelName) → (exists, isActive, creator, memberCount, createdAt)
getChannelMembersPaginated(channelName, page, pageSize) → (members[], totalMembers, totalPages, hasNextPage)
getAllChannelsPaginated(page, pageSize) → (channels[], totalChannels, totalPages, hasNextPage)
```
Provê informações detalhadas sobre canais e membros, permitindo relatórios e análises.

***
## Arquitetura 
```
IAccessChannelManager (Base Layer)
    ↓ Valida permissões para
├── SchemaRegistry (controla quem registra schemas)
├── ProcessRegistry (define participantes de processos)  
├── AssetTracker (gerencia acesso a ativos)
└── Transaction Orchestrator (valida antes de executar)
```
A seguir é descrito o fluxo de validação típico:

1. Request recebido em qualquer componente do sistema.
2. Extração do contexto (canal + participante).
3. Consulta ao `AccessChannelManager` (`isChannelMember`).
4. Decisão de autorização (permitir/rejeitar operação).

***
## Casos de Uso
### Agronegócio

```
Canal "Produtores" → Fazendeiros e cooperativas com acesso a commodities trading.
```

```
Canal "Tradings" → Cerealistas + produtores para negociação direta.
```

```
Canal "FinanceiraRural" → Bancos + cooperativas + produtores para crédito rural
```

```
Canal "Seguradoras" → Companhias de seguro + produtores para cobertura de safra
```	