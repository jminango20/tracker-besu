# SCHEMAS

São estruturas de dados a serem definidas e utilizadas como questionários e para o registro de informações dos ativos a serem rastreados ao longo de uma cadeia produtiva, em JSON, no caso de Ethereum/Besu serão `bytes32 dataHash`.
Teremos um conjunto de métodos para que essas estruturas de dados possam ser mantidas: 
- `createSchema`, 
- `deprecateSchema`, 
- `inactivateSchema`, 
- `updateSchema`,
- `searchSchema`.

As estruturas de dados serão versionadas e poderão ser utilizadas em um ou mais processos.

## Documentação da interface e do contrato: 
- [`ISchemaRegistry`](../docs/interfaces/ISchemaRegistry.md)
- [`SchemaRegistry`](../docs/SchemaRegistry.md)

***
## `createSchema`
### Descrição
COMO rede blockchain QUERO validar os dados de um esquema PARA adicioná-lo na legder.

### Regras de Negócio
- O usuário que submeteu a transação na ledger deve possuir permissão para realizar a operação.
- Os parâmetros de entrada obrigatórios devem ser informados.
- O tipo da estrutura dos dados deve corresponder a um dos valores permitidos.
- A estrutura dos dados não conter erros de sintaxe: 
    - Para o tipo "XML": deve atender a especificação descrita em [-https://www.w3.org/XML/Schema-]
    - Para o tipo "JSON": deve atender a especificação descrita em https://json-schema.org/draft/2019-09/json-schema-validation.html
- O esquema deve ser único na legder por organização do usuário, identificador do schema, versão e situação igual a "ativo"
- Quando atendidas as regras descritas acima, adicionar o esquema na ledger para a organização com o campos descritos abaixo: 
    - Identificador da organização do usuário que submeteu a transação
    - Identificador do esquema
    - Nome 
    - Descrição
    - Versão
    - Tipo da estrutura dos dados
    - Estrutura dos dados
    - Situação: com o valor "ativo"
    - Tipo da transação: com o valor "createSchema"
    - Timestamp da transação
- O esquema adicionado deve ser de domínio público na rede

#### Cumprimento das Regras de Negócio
- **Permissões:** `onlyChannelMember(channelName)` - substitui validação por organização.
- **Parâmetros obrigatórios:** Validações de `id`, `name`, `dataHash`, `description`.
- **Unicidade:** `_schemaExistsByChannelName[channelName][schemaId]` - garante schema único por canal.
- **Armazenamento completo:** `Struct Schema` contém todos os campos requeridos.
- **Versão inicial: version:** 1 - sempre inicia em versão `1`.
- **Status ativo:**  `SchemaStatus.ACTIVE` - situação definida como ativo.
- **Timestamp:** `block.timestamp` - registro automático da transação.
- **Domínio público:** `SchemaCreated` event - visibilidade na rede.
