# SCHEMAS

São estruturas de dados a serem definidas e utilizadas como questionários e para o registro de informações dos ativos a serem rastreados ao longo de uma cadeia produtiva, em JSON, no caso de Ethereum/Besu serão `bytes32 dataHash`.
Teremos um conjunto de métodos para que essas estruturas de dados possam ser mantidas: 
- `createSchema`, 
- `deprecateSchema`, 
- `inactivateSchema`, 
- `updateSchema`,
- `getSchemaInfo`.

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
- **O schema deve ser completamente novo - não pode existir qualquer versão anterior do mesmo schemaId no canal**    
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
- **Schema único:** `_validateLatestVersion()` - garante que NÃO existe qualquer versão anterior do `schemaId`.
- **Armazenamento completo:** `Struct Schema` contém todos os campos requeridos e `_createNewSchema()` e `_storeNewSchema()` - cria e armazena schema completo.
- **Versão inicial:** `'version: 1` - sempre inicia na versão `1`.
- **Status ativo:**  `SchemaStatus.ACTIVE` - situação definida como ativo.
- **Timestamp:** `_getTimeStamp()` - registro automático da transação.
- **Domínio público:** `SchemaCreated` event - visibilidade na rede.


***
## `deprecateSchema`
### Descrição
COMO rede blockchain QUERO atualizar a situação de um esquema PARA descontinuado.

### Regras de Negócio
Como rede blockchain quero atualizar a situação de um esquema para descontinuado, motivo pelo qual como parâmetro de entrada deve ser informado o identificador do esquema e o nome do canal onde o esquema está armazenado.

- O usuário que submeteu a transação na ledger deve possuir permissão para realizar a operação.
- A organização a qual o usuário pertence deve ser a proprietária do esquema.
- Os parâmetros de entrada obrigatórios devem ser informados.
- **Apenas a versão ativa do schema será depreciada (não todas as versões)**.
- O esquema deve ter uma versão ativa para ser depreciado.
- A versão ativa deve estar com status "ativo".

#### Cumprimento das Regras de Negócio
- **Permissões:** `onlyChannelMember(channelName)` - garante que apenas membros autorizados do canal podem deprecar schemas.
- **Parâmetros obrigatórios:** Validação de `schemaId` (não pode ser zero) e `channelName` (validado por modifier).
- **Versão ativa:** `_getAndValidateActiveVersion()` - verifica se existe versão ativa do schema.
- **Propriedade:** `_validateSchemaOwnership()` - apenas o proprietário original pode deprecar.
- **Status válido:** `schema.status != SchemaStatus.ACTIVE` - só permite deprecar schemas que estão ativos.
- **Depreciação:** `_deprecateSchema()` - muda situação da versão ativa para descontinuado.
- **Limpeza:** `_clearActiveVersion()` - remove referência à versão ativa.
- **Timestamp:** `_getTimeStamp()` - registro automático da atualização.
- **Domínio público:** `SchemaDeprecated` event - visibilidade da operação na rede.

***
## `inactivateSchema`
### Descrição
COMO rede blockchain QUERO atualizar a situação de um esquema PARA inativo.

### Regras de Negócio
Como rede blockchain quero atualizar a situação de um esquema para inativo, motivo pelo qual como parâmetro de entrada deve ser informado o identificador do esquema, a
versão e o nome do canal onde o esquema está armazenado.

- O usuário que submeteu a transação na ledger deve possuir permissão para realizar a operação.
- A organização a qual o usuário pertence deve ser a proprietária do esquema.
- Os parâmetros de entrada obrigatórios devem ser informados.
- A versão específica do esquema deve existir no canal.
- A versão não pode estar já inativa.
- A versão deve estar ativa ou depreciada para ser inativada.

#### Cumprimento das Regras de Negócio

- **Permissões:** `onlyChannelMember(channelName)` - garante que apenas membros autorizados do canal podem inativar schemas.
- **Validação de canal:** `validChannelName(channelName)` - valida se o canal é válido.
- **Propriedade do schema:** `schema.owner != _msgSender()` - garante que apenas o proprietário original pode inativar o schema.
- **Parâmetros obrigatórios:** Validações de `schemaId` (não pode ser zero), `version` (não pode ser zero) e `channelName` (validado por modifiers).
- **Existência:** `_getExistingSchema()` - verifica se a versão específica existe no canal.
- **Propriedade:** `_validateSchemaOwnership()` - garante que apenas o proprietário pode inativar.
- **Status válido:** `_validateSchemaCanBeInactivated()` - impede inativação dupla.
- **Inativação:** `_inactivateSchemaVersion()` - muda situação para inativo.
- **Versão ativa:** Limpa `_activeVersions` se a versão inativada era a ativa.
- **Timestamp:** `_getTimeStamp()` - registro automático da transação.
- **Domínio público:** `SchemaInactivated` event - representa o tipo da operação na rede.

***
## `updateSchema`
### Descrição
COMO rede blockchain QUERO alterar os dados de um esquema cadastrado na ledger PARA uso em processos e padronização de dados.

### Regras de Negócio
- O usuário que submeteu a transação na ledger deve possuir permissão para realizar a operação.
- A organização a qual o usuário pertence deve ser a proprietária do esquema.
- Sobre os parâmetros de entada: 
    - Os parâmetros obrigatórios devem ser informados.
    - A estrutura dos dados não conter erros de sintaxe: 
        - Para o tipo "XML": deve atender a especificação descrita em [-https://www.w3.org/XML/Schema-].
        - Para o tipo "JSON": deve atender a especificação descrita em https://json-schema.org/draft/2019-09/json-schema-validation.html.
- O esquema deve existir cadastrado na ledger com estado atual igual a "ativo"
- A nova versão será automaticamente calculada como versão atual + 1.
- Quando atendidas as regras descritas acima.
    - Depreciar a versão ativa atual.
    - Criar nova versão com status "ativo".
    - Timestamp da transação para ambas operações.

#### Cumprimento das Regras de Negócio

- **Permissões:** `onlyChannelMember(schemaUpdateInput.channelName)` - garante que apenas membros autorizados do canal podem atualizar schemas.
- **Parâmetros obrigatórios**: `_validateSchemaUpdateInput()` - valida id, newDataHash, description.
- **Versão ativa**: `_getAndValidateActiveVersion()` - verifica se existe versão ativa.
- **Propriedade**: `_validateSchemaOwnership()` - apenas proprietário pode atualizar.
- **Status ativo**: `_validateSchemaStatus()` - só permite atualizar schemas ativos.
- **Versionamento automático**: `_updatedSchema()` - calcula nova versão como currentVersion + 1.
- **Operação atômica**: `_deprecateSchema() + _storeUpdatedSchema()` - deprecia atual e cria nova.
- **Timestamp**: `_getTimeStamp()` - registro automático para ambas operações.
- **Domínio público**: `SchemaUpdated` event - representa ambas operações na rede.

##### Adaptações Besu
- **Validação de sintaxe:** Responsabilidade off-chain antes do hash (limitações de gas).
- **Versão alfabética → numérica:** Usa validação numérica (`uint256`) ao invés de alfabética.
- **Operação atômica:** Ambas operações (deprecar + criar) executadas em uma única transação.

***
## `getSchemaByVersion`
### Descrição
COMO rede blockchain QUERO consultar uma versão específica de um esquema PARA verificar detalhes históricos ou comparar versões.

#### Parâmetros

- `channelName`: Nome do canal onde o schema está armazenado.
- `schemaId`: Identificador único do schema.
- `version`: Número da versão específica desejada.

#### Retorno

- `Schema memory`: Estrutura completa do schema na versão solicitada.

#### Validações
- **Permissões**: `onlyChannelMember(channelName)` - apenas membros do canal podem consultar (Não é necessário este controle em Besu).
- **Canal válido**: `validChannelName(channelName)` - valida se o canal existe.
- **Parâmetros:** `_validateSchemaId()` e `_validateVersion()` - valida entrada.
- **Existência**: Verifica se a versão específica existe no canal.

***
## `getActiveSchema`
### Descrição
COMO rede blockchain QUERO consultar o esquema ativo de um identificador PARA usar a versão atual em operações.

#### Parâmetros

- `channelName`: Nome do canal onde o schema está armazenado.
- `schemaId`: Identificador único do schema.

#### Retorno

- `Schema memory`: Estrutura completa do schema na versão ativa.

#### Validações
- **Permissões**: `onlyChannelMember(channelName)` - apenas membros do canal podem consultar (Não é necessário este controle em Besu).
- **Canal válido**: `validChannelName(channelName)` - valida se o canal existe.
- **Parâmetros:** `_validateSchemaId()` - valida entrada.
- **Versão ativa**: Verifica se existe uma versão ativa no canal.

***
## `getLatestSchema`
### Descrição
COMO rede blockchain QUERO consultar a última versão de um esquema PARA ter acesso à versão mais recente disponível.

#### Parâmetros

- `channelName`: Nome do canal onde o schema está armazenado.
- `schemaId`: Identificador único do schema.

#### Retorno

- `Schema memory`: Estrutura completa do schema na última versão.

#### Validações
- **Permissões**: `onlyChannelMember(channelName)` - apenas membros do canal podem consultar (Não é necessário este controle em Besu).
- **Canal válido**: `validChannelName(channelName)` - valida se o canal existe.
- **Parâmetros:** `_validateSchemaId()` - valida entrada.
- **Existência**: Verifica se o schema existe no canal.

***
## `getSchemaVersions`
### Descrição
COMO rede blockchain QUERO consultar todas as versões de um esquema PARA ter visão completa do histórico evolutivo.

#### Parâmetros

- `channelName`: Nome do canal onde o schema está armazenado.
- `schemaId`: Identificador único do schema.

#### Retorno

- `uint256[] memory versions`: Array com números de todas as versões existentes.
- `Schema[] memory schemas`: Array com estruturas completas de todos os schemas.

#### Validações
- **Permissões**: `onlyChannelMember(channelName)` - apenas membros do canal podem consultar (Não é necessário este controle em Besu).
- **Canal válido**: `validChannelName(channelName)` - valida se o canal existe.
- **Parâmetros:** `_validateSchemaId()` - valida entrada.
- **Existência**: Verifica se o schema existe no canal.

***
## `getSchemaInfo`
### Descrição
COMO rede blockchain QUERO consultar informações resumidas de um esquema PARA ter visão geral rápida sem carregar dados completos.

#### Parâmetros

- `channelName`: Nome do canal onde o schema está armazenado.
- `schemaId`: Identificador único do schema.

#### Retorno

- `uint256 latestVersion`: Número da última versão disponível.
- `uint256 activeVersion`: Número da versão ativa (0 = nenhuma ativa).
- `bool hasActiveVersion`: Indica se existe versão ativa.
- `address owner`: Endereço do proprietário (da última versão).
- `uint256 totalVersions`: Quantidade total de versões existentes.

#### Validações
- **Permissões**: `onlyChannelMember(channelName)` - apenas membros do canal podem consultar (Não é necessário este controle em Besu).
- **Canal válido**: `validChannelName(channelName)` - valida se o canal existe.
- **Parâmetros:** `_validateSchemaId()` - valida entrada.
- **Existência**: Verifica se o schema existe no canal.