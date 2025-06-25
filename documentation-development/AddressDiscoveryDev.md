# Sistema de Descoberta de Endereços (IAddressDiscovery)

O [`IAddressDiscovery`](../docs/interfaces/IAddressDiscovery.md) resolve o problema de como os contratos encontram e se comunicam entre si sem *hardcoding* de endereços. Este componente atua como um *service registry* centralizado, permitindo que contratos descubram dinamicamente onde estão localizados outros contratos do ecossistema.

## Vantagens 
- Contratos podem ser atualizados sem afetar dependentes.
- Deployment incremental de novas versões.
- Rollback rápido em caso de problemas.
- Contratos não dependem de endereços específicos.

## Arquitetura 
```
IAddressDiscovery (Service Registry)
    ├── "AccessChannelManager" → 0xABC...
    ├── "SchemaRegistry" → 0xDEF...
    ├── "ProcessRegistry" → 0x123...
    ├── "AssetTracker" → 0x456...
    └── "TransactionOrchestrator" → 0x789...

```