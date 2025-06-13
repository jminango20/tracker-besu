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


***
## `deprecateSchema`
### Descrição
COMO rede blockchain QUERO atualizar a situação de um esquema PARA descontinuado.

### Regras de Negócio
Como rede blockchain quero atualizar a situação de um esquema para descontinuado, motivo pelo qual como parâmetro de entrada deve ser informado o identificador do esquema e o nome do canal onde o esquema está armazenado.

#### Cumprimento das Regras de Negócio
- **Permissões:** `onlyChannelMember(channelName)` - garante que apenas membros autorizados do canal podem deprecar schemas.
- **Parâmetros obrigatórios:** Validação de `schemaId` (não pode ser zero) e `channelName` (validado por modifier).
- **Existência do schema:** `_schemaExistsByChannelName[channelName][schemaId]` - verifica se o schema existe no canal especificado.
- **Controle de propriedade:** `schema.owner != _msgSender()` - apenas o proprietário original pode deprecar o schema.
- **Status válido:** `schema.status != SchemaStatus.ACTIVE` - só permite deprecar schemas que estão ativos.
- **Atualização de situação:** `schema.status = SchemaStatus.DEPRECATED` - muda situação para descontinuado.
- **Timestamp:** `schema.updatedAt = block.timestamp` - registro automático da atualização.
- **Domínio público:** `SchemaDeprecated` event - visibilidade da operação na rede.

#### **Considerações Adicionais a Avaliar**
- Verificação de uso ativo: Considerar validar se o schema não está sendo usado em processos ativos antes de permitir depreciação.
- Dependências: Verificar se outros schemas ou processos dependem deste schema.
- Versionamento: Avaliar impacto em outras versões do mesmo schema (se existirem).
- Reversibilidade: Considerar se schemas depreciados podem voltar a ser ativos ou se é operação irreversível.
- Nota: Quando descontinuo um schema, todas as versões desse schema também são descontinuadas.

***
## `inactivateSchema`
### Descrição
COMO rede blockchain QUERO atualizar a situação de um esquema PARA inativo.

### Regras de Negócio
Como rede blockchain quero atualizar a situação de um esquema para inativo, motivo pelo qual como parâmetro de entrada deve ser informado o identificador do esquema, a
versão e o nome do canal onde o esquema está armazenado.

#### Cumprimento das Regras de Negócio

- **Permissões:** `onlyChannelMember(channelName)` - garante que apenas membros autorizados do canal podem inativar schemas.
- **Validação de canal:** `validChannelName(channelName)` - valida se o canal é válido.
- **Propriedade do schema:** `schema.owner != _msgSender()` - garante que apenas o proprietário original pode inativar o schema.
- **Parâmetros obrigatórios:** Validações de `schemaId` (não pode ser zero), `version` (não pode ser zero) e `channelName` (validado por modifiers).
- **Existência e versão:** `_schemaExistsByChannelName[channelName][schemaId][version]` - verifica se a versão específica existe no canal.
- **Status válido:** `schema.status != SchemaStatus.ACTIVE && schema.status != SchemaStatus.DEPRECATED` - permite inativação apenas de schemas ativos ou depreciados.
- **Atualização de situação:** `schema.status = SchemaStatus.INACTIVE` - muda situação para inativo.
- **Timestamp:** `schema.updatedAt = block.timestamp` - registro automático da transação.
- **Tipo da transação:** `SchemaInactivated` event - representa o tipo da operação na rede.