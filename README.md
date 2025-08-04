# ARQUITETURA GERAL

```
RASTREABILIDADE - BESU
├── ISchemaRegistry.sol
├── IProcessRegistry.sol 
├── IAssetRegistry.sol 
└── ITransactionOrchestrator.sol 
```

## FLUXO DE OPERAÇÃO PRINCIPAL
1. Cadastro de Schemas → Estruturas de dados versionadas
2. Cadastro de Processos → Regras de negócio vinculando schemas
3. Submissão de Transações → Orquestrador valida e executa operações
4. Gestão de Assets → Criação, movimentação e transformação de ativos

## PRINCIPAIS OPERAÇÕES DE ASSETS
- CREATE_ASSET - Criar novo item rastreável
- UPDATE_ASSET - Atualizar dados do asset
- TRANSFER_ASSET - Transferir ownership entre endereços
- TRANSFORM_ASSET - Mudar natureza do asset
- SPLIT_ASSET - Dividir asset em múltiplos
- GROUP_ASSETS - Agrupar múltiplos assets
- UNGROUP_ASSETS - Desagrupar assets
- INACTIVATE_ASSET - Inativar asset
- PARTIALLY_CONSUME - Consumo parcial de asset

## PONTO ENTRADA

```
TransactionOrchestrator.submitTransaction()
├── Valida processo + schemas + permissões
├── Roteia para operação específica no AssetRegistry  
└── Registra transação para auditoria completa
```

