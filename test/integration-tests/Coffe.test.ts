import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import hre from "hardhat";
import { deployTransactionOrchestrator } from "../fixture/deployTransactionOrchestrator";
import { getTestAccounts } from "../utils/index";
import { SupplyChainTracer } from "../utils/SupplyChainTracer";

describe.skip("COFFEE SUPPLY CHAIN - Complete Journey Integration Test", function () {

  //ACTORS
  let deployer: HardhatEthersSigner;
  let fazendeiro: HardhatEthersSigner;
  let beneficiadora: HardhatEthersSigner;
  let torrefacao: HardhatEthersSigner;
  let auditor: HardhatEthersSigner;

  //CONTRACTS
  let transactionOrchestrator: any;
  let processRegistry: any;
  let schemaRegistry: any;
  let assetRegistry: any;
  let accessChannelManager: any;

  //CHANNEL IDENTIFIERS
  const CANAL_CAFE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CANAL_CAFE_BRASIL"));
  
  //SCHEMAS
  const SCHEMA_PLANTIO = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_PLANTIO"));
  const SCHEMA_COLHEITA = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_COLHEITA"));
  const SCHEMA_BENEFICIAMENTO = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_BENEFICIAMENTO"));
  const SCHEMA_TORREFACAO = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_TORREFACAO"));
  const SCHEMA_BLEND = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SCHEMA_BLEND"));

  //PROCESSES
  const PROCESS_PLANTIO = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PLANTIO_ARABICA"));
  const PROCESS_COLHEITA = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("COLHEITA_SELETIVA"));
  const PROCESS_BENEFICIAMENTO = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BENEFICIAMENTO_LAVADO"));
  const PROCESS_TORREFACAO_TRANSFER = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TORREFACAO_TRANSFER"));
  const PROCESS_TORREFACAO = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TORREFACAO_ARTESANAL"));
  const PROCESS_BLEND = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BLEND_PREMIUM"));

  //NATURE & STAGES
  const NATURE_PRODUCAO = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PRODUCAO"));
  const NATURE_PROCESSAMENTO = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROCESSAMENTO"));
  const STAGE_INICIAL = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("INICIAL"));
  const STAGE_PROCESSAMENTO = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PROCESSAMENTO"));
  const STAGE_FINAL = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("FINAL"));

  //TRACKING VARIABLES
  let assetOriginalId: string;
  let lotesPremium: string[] = [];
  let lotesEspecial: string[] = [];
  let lotesComercial: string[] = [];
  let loteBeneficiado: string;
  let loteTorradoTransfer: string;
  let loteTorrado: string;
  let loteBlend: string;
  let massaTotal: number = 1000; // kg inicial

  //UTILITY FUNCTIONS
  async function logPhase(phaseName: string, details: any) {
    console.log(`\n  ${phaseName}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    if (details.massa) console.log(`      Massa: ${details.massa}kg`);
    if (details.local) console.log(`      Local: ${details.local}`);
    if (details.owner) console.log(`      Proprietário: ${details.owner}`);
    if (details.gasUsed) console.log(`      Gas Used: ${details.gasUsed.toLocaleString()}`);
  }

  async function validateMassConservation(expected: number, actual: number, tolerance: number = 0) {
    const difference = Math.abs(expected - actual);
    expect(difference).to.be.lte(tolerance, 
      `CONSERVAÇÃO DE MASSA VIOLADA! Esperado: ${expected}kg, Atual: ${actual}kg`);
    console.log(`Conservação de massa validada: ${actual}kg`);
  }

  async function getAssetDetails(assetId: string) {
    const asset = await assetRegistry.getAsset(CANAL_CAFE, assetId);
    return {
      id: assetId,
      owner: asset.owner,
      amount: Number(asset.amount),
      location: asset.idLocal,
      status: Number(asset.status),
      operation: Number(asset.operation)
    };
  }

  it("Complete Coffee Supply Chain Journey", async function () {    
    // ================================
    // FASE 0: SETUP INICIAL COMPLETO
    // ================================
    console.log("\n ========== SETUP INICIAL DA CADEIA DO CAFÉ ==========");
    
    const accounts = await getTestAccounts();
    deployer = accounts.deployer;
    fazendeiro = accounts.wallet1;
    beneficiadora = accounts.wallet2;
    torrefacao = accounts.wallet3; 
    auditor = accounts.wallet4;
    
    // Deploy all contracts
    const deployment = await loadFixture(deployTransactionOrchestrator);
    transactionOrchestrator = deployment.transactionOrchestrator;
    processRegistry = deployment.processRegistry;
    schemaRegistry = deployment.schemaRegistry;
    assetRegistry = deployment.assetRegistry;
    accessChannelManager = deployment.accessChannelManager;
    
    const tracer = new SupplyChainTracer(assetRegistry, CANAL_CAFE);

    console.log("   ✅ Contratos deployados com sucesso");

    // 1) CRIAR CANAL DO CAFÉ
    await accessChannelManager.connect(deployer).createChannel(CANAL_CAFE);
    console.log("   ✅ Canal do café criado");

    // 2) ADICIONAR TODOS OS ATORES
    await accessChannelManager.connect(deployer).addChannelMember(CANAL_CAFE, fazendeiro.address);
    await accessChannelManager.connect(deployer).addChannelMember(CANAL_CAFE, beneficiadora.address);
    await accessChannelManager.connect(deployer).addChannelMember(CANAL_CAFE, torrefacao.address);
    await accessChannelManager.connect(deployer).addChannelMember(CANAL_CAFE, auditor.address);
    console.log("   ✅ Todos os atores adicionados ao canal");

    // 3) REGISTRAR SCHEMAS
    const schemas = [
      { id: SCHEMA_PLANTIO, name: "Schema Plantio", hash: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("plantio_v1")) },
      { id: SCHEMA_COLHEITA, name: "Schema Colheita", hash: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("colheita_v1")) },
      { id: SCHEMA_BENEFICIAMENTO, name: "Schema Beneficiamento", hash: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("beneficiamento_v1")) },
      { id: SCHEMA_TORREFACAO, name: "Schema Torrefação", hash: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("torrefacao_v1")) },
      { id: SCHEMA_BLEND, name: "Schema Blend", hash: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("blend_v1")) }
    ];

    for (const schema of schemas) {
      await schemaRegistry.connect(fazendeiro).createSchema({
        id: schema.id,
        name: schema.name,
        dataHash: schema.hash,
        channelName: CANAL_CAFE,
        description: `Schema para ${schema.name}`
      });
    }
    console.log("   ✅ 5 schemas registrados");

    // 4) CRIAR PROCESSOS
    const processos = [
      { id: PROCESS_PLANTIO, schema: SCHEMA_PLANTIO, action: 0, nature: NATURE_PRODUCAO, stage: STAGE_INICIAL }, //CREATE_ASSET
      { id: PROCESS_COLHEITA, schema: SCHEMA_COLHEITA, action: 3, nature: NATURE_PRODUCAO, stage: STAGE_PROCESSAMENTO }, //SPLIT_ASSET
      { id: PROCESS_BENEFICIAMENTO, schema: SCHEMA_BENEFICIAMENTO, action: 2, nature: NATURE_PROCESSAMENTO, stage: STAGE_PROCESSAMENTO }, //TRANSFER_ASSET
      { id: PROCESS_TORREFACAO_TRANSFER, schema: SCHEMA_TORREFACAO, action: 2, nature: NATURE_PROCESSAMENTO, stage: STAGE_PROCESSAMENTO }, //TRANSFER_ASSET - TORREFACAO      
      { id: PROCESS_TORREFACAO, schema: SCHEMA_TORREFACAO, action: 6, nature: NATURE_PROCESSAMENTO, stage: STAGE_PROCESSAMENTO }, //TRANSFORM_ASSET
      { id: PROCESS_BLEND, schema: SCHEMA_BLEND, action: 4, nature: NATURE_PROCESSAMENTO, stage: STAGE_FINAL } //GROUP_ASSET
    ];

    for (const processo of processos) {
      await processRegistry.connect(fazendeiro).createProcess({
        processId: processo.id,
        natureId: processo.nature,
        stageId: processo.stage,
        schemas: [{ schemaId: processo.schema, version: 1 }],
        action: processo.action,
        description: `Processo ${processo.id}`,
        channelName: CANAL_CAFE
      });
    }
    console.log("   ✅ 6 processos criados");
    console.log("   🎯 Setup completo! Iniciando jornada do café...");

    // ================================
    // FASE 1: PLANTIO (FAZENDEIRO) - CREATE_ASSET
    // ================================
    console.log("\n ============================================================");
    await logPhase("🎯 FASE 1: PLANTIO - FAZENDA DAT", {
      massa: massaTotal,
      local: "Fazenda DAT - Local A",
      owner: "Fazendeiro"
    });

    const transactionPlantio = {
      processId: PROCESS_PLANTIO,
      natureId: NATURE_PRODUCAO,
      stageId: STAGE_INICIAL,
      channelName: CANAL_CAFE,
      targetAssetIds: [],
      operationData: {
        initialAmount: massaTotal,
        initialLocation: "Fazenda DAT - Local A",
        targetOwner: hre.ethers.ZeroAddress,
        externalIds: ["CERT-ORGANICO-2024", "ANALISE-SOLO-A1-2024"],
        splitAmounts: [],
        groupAmount: 0,
        newAmount: 0,
        newProcessId: hre.ethers.ZeroHash,
        newLocation: ""
      },
      dataHashes: [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("arabica_bourbon_mudas_organicas"))],
      description: "Plantio de 1000kg mudas Arábica Bourbon Amarelo certificadas orgânicas"
    };

    const txPlantio = await transactionOrchestrator.connect(fazendeiro).submitTransaction(transactionPlantio);
    const receiptPlantio = await txPlantio.wait();

    await tracer.captureAllEventsFromTransaction(receiptPlantio);

    // Extract asset ID from events
    const operationEvent = receiptPlantio?.logs.find((log: any) => {
      try {
        const parsed = transactionOrchestrator.interface.parseLog(log);
        return parsed?.name === "OperationExecuted";
      } catch { return false; }
    });
    const parsedOperation = transactionOrchestrator.interface.parseLog(operationEvent);
    assetOriginalId = parsedOperation?.args.affectedAssets[0];

    // Validate plantio
    const assetPlantio = await getAssetDetails(assetOriginalId);
    expect(assetPlantio.owner).to.equal(fazendeiro.address);
    expect(assetPlantio.amount).to.equal(massaTotal);
    expect(assetPlantio.status).to.equal(0); // ACTIVE
    expect(assetPlantio.operation).to.equal(0); // CREATE

    await logPhase("✅ PLANTIO CONCLUÍDO", {
      massa: assetPlantio.amount,
      local: assetPlantio.location,
      owner: assetPlantio.owner,
      gasUsed: receiptPlantio?.gasUsed
    });

    // ================================
    // FASE 2: COLHEITA (FAZENDEIRO) - SPLIT
    // ================================
    console.log("\n ============================================================");
    await logPhase("🎯 FASE 2: COLHEITA SELETIVA - SEPARAÇÃO POR QUALIDADE", {
      massa: massaTotal,
      local: "Fazenda DAT - Terreiro de Secagem - Local B",
      owner: "Fazendeiro"
    });

    const massaPremium = 300;
    const massaEspecial = 400;
    const massaComercial = 300;

    const transactionColheita = {
      processId: PROCESS_COLHEITA,
      natureId: NATURE_PRODUCAO,
      stageId: STAGE_PROCESSAMENTO,
      channelName: CANAL_CAFE,
      targetAssetIds: [assetOriginalId],
      operationData: {
        initialAmount: 0,
        initialLocation: "",
        targetOwner: hre.ethers.ZeroAddress,
        externalIds: [],
        splitAmounts: [massaPremium, massaEspecial, massaComercial],
        groupAmount: 0,
        newAmount: 0,
        newProcessId: hre.ethers.ZeroHash,
        newLocation: "Fazenda DAT - Terreiro de Secagem - Local B"
      },
      dataHashes: [
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("premium_cereja_descascado")),
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("especial_semi_lavado")),
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("comercial_natural"))
      ],
      description: "Colheita seletiva com separação por qualidade - Premium/Especial/Comercial"
    };

    const txColheita = await transactionOrchestrator.connect(fazendeiro).submitTransaction(transactionColheita);
    const receiptColheita = await txColheita.wait();

    await tracer.captureAllEventsFromTransaction(receiptColheita);

    // Validate split occurred
    const assetOriginalAposColheita = await assetRegistry.getAsset(CANAL_CAFE, assetOriginalId);
    expect(assetOriginalAposColheita.status).to.equal(1); // INACTIVE
    expect(assetOriginalAposColheita.childAssets.length).to.equal(3);

    // Get split asset IDs
    lotesPremium = [assetOriginalAposColheita.childAssets[0]];
    lotesEspecial = [assetOriginalAposColheita.childAssets[1]];
    lotesComercial = [assetOriginalAposColheita.childAssets[2]];

    // Validate each split asset
    const lotePremium = await getAssetDetails(lotesPremium[0]);
    const loteEspecial = await getAssetDetails(lotesEspecial[0]);
    const loteComercialData = await getAssetDetails(lotesComercial[0]);

    expect(lotePremium.amount).to.equal(massaPremium);
    expect(loteEspecial.amount).to.equal(massaEspecial);
    expect(loteComercialData.amount).to.equal(massaComercial);

    // Validate mass conservation
    const massaTotalAposColheita = lotePremium.amount + loteEspecial.amount + loteComercialData.amount;
    await validateMassConservation(massaTotal, massaTotalAposColheita);

    await logPhase("✅ COLHEITA CONCLUÍDA", {
      massa: `${massaPremium}kg Premium + ${massaEspecial}kg Especial + ${massaComercial}kg Comercial`,
      local: lotePremium.location,
      owner: lotePremium.owner,
      gasUsed: receiptColheita?.gasUsed
    }); 
    // ================================
    // FASE 3: BENEFICIAMENTO (FAZENDEIRO → BENEFICIADORA) - TRANSFERÊNCIA
    // ================================
    console.log("\n ============================================================");
    await logPhase("🎯 FASE 3: BENEFICIAMENTO - TRANSFERÊNCIA", {
      massa: massaPremium,
      local: "Beneficiadora Vale do Rio Doce - Local C",
      owner: "Beneficiadora",
    });

    const transactionBeneficiamento = {
      processId: PROCESS_BENEFICIAMENTO,
      natureId: NATURE_PROCESSAMENTO,
      stageId: STAGE_PROCESSAMENTO,
      channelName: CANAL_CAFE,
      targetAssetIds: [lotesPremium[0]],
      operationData: {
        initialAmount: 0,
        initialLocation: "",
        targetOwner: beneficiadora.address,
        externalIds: ["LOTE-BVR-2024-001", "CERT-LAVADO-24H"],
        splitAmounts: [],
        groupAmount: 0,
        newAmount: 0,
        newProcessId: hre.ethers.ZeroHash,
        newLocation: "Beneficiadora Vale do Rio Doce - Local C"
      },
      dataHashes: [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("lavado_fermentacao_24h_premium"))],
      description: "Transferência para beneficiamento - Processo lavado com fermentação controlada 24h"
    };

    const txBeneficiamento = await transactionOrchestrator.connect(fazendeiro).submitTransaction(transactionBeneficiamento);
    const receiptBeneficiamento = await txBeneficiamento.wait();

    await tracer.captureAllEventsFromTransaction(receiptBeneficiamento);

    // Validate transfer occurred
    const assetBeneficiado = await getAssetDetails(lotesPremium[0]);
    expect(assetBeneficiado.owner).to.equal(beneficiadora.address);
    expect(assetBeneficiado.location).to.include("Beneficiadora Vale do Rio Doce");
    loteBeneficiado = lotesPremium[0];

    await logPhase("✅ BENEFICIAMENTO CONCLUÍDO", {
      massa: assetBeneficiado.amount,
      local: assetBeneficiado.location,
      owner: assetBeneficiado.owner,
      gasUsed: receiptBeneficiamento?.gasUsed
    });
    
    // ================================
    // FASE 4: TORREFAÇÃO (BENEFICIADORA → TORREFÁCIA) - TRANSFORM
    // ================================
    console.log("\n ============================================================");
    await logPhase("🎯 FASE 4: TORREFAÇÃO - TRANSFORMAÇÃO TÉRMICA", {
      massa: `${massaPremium}kg → ~200kg (perda 33%)`,
      local: "Torrefação Specialty Coffee - Local D",
      owner: "Torrefação"
    });

    // TRANSFER BENEFICIADORA -> TORREFÁCIA
    const transactionTransferTorrefacao = {
      processId: PROCESS_TORREFACAO_TRANSFER,
      natureId: NATURE_PROCESSAMENTO,
      stageId: STAGE_PROCESSAMENTO,
      channelName: CANAL_CAFE,
      targetAssetIds: [loteBeneficiado],
      operationData: {
        initialAmount: 0,
        initialLocation: "",
        targetOwner: torrefacao.address,
        externalIds: ["TORREFACAO-2025-001"],
        splitAmounts: [],
        groupAmount: 0,
        newAmount: 0,
        newProcessId: hre.ethers.ZeroHash,
        newLocation: "Torrefação Specialty Coffee"
      },
      dataHashes: [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("transferencia_torrefacao"))],
      description: "Transferência para torrefação"
    };

    const txTransferTorrefacao = await transactionOrchestrator.connect(beneficiadora).submitTransaction(transactionTransferTorrefacao);
    const receiptTransferTorrefacao = await txTransferTorrefacao.wait();

    await tracer.captureAllEventsFromTransaction(receiptTransferTorrefacao);

    loteTorradoTransfer = loteBeneficiado;

    // Validate transfer occurred
    const assetTransferTorrado = await getAssetDetails(loteTorradoTransfer);
    expect(assetTransferTorrado.owner).to.equal(torrefacao.address);
    expect(assetTransferTorrado.location).to.include("Torrefação Specialty Coffee");

    // TRANSFORM TORRADA
    const massaTorrada = 200; // 33% de perda na torra
    
    const transactionTorrefacao = {
      processId: PROCESS_TORREFACAO,
      natureId: NATURE_PROCESSAMENTO,
      stageId: STAGE_PROCESSAMENTO,
      channelName: CANAL_CAFE,
      targetAssetIds: [loteTorradoTransfer],
      operationData: {
        initialAmount: 0,
        initialLocation: "",
        targetOwner: hre.ethers.ZeroAddress,
        externalIds: [],
        splitAmounts: [],
        groupAmount: 0,
        newAmount: massaTorrada,
        newProcessId: hre.ethers.ZeroHash,
        newLocation: "Torrefação Specialty Coffee - Stage 2"
      },
      dataHashes: [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("torrado_200c_12min_moagem_fina"))],
      description: "Torrefação artesanal - 200°C por 12min, resfriamento controlado, moagem fina"
    };

    const txTorrefacao = await transactionOrchestrator.connect(torrefacao).submitTransaction(transactionTorrefacao);
    const receiptTorrefacao = await txTorrefacao.wait();

    await tracer.captureAllEventsFromTransaction(receiptTorrefacao);

    // Validate transformation
    const assetOriginalTorrefacao = await assetRegistry.getAsset(CANAL_CAFE, loteTorradoTransfer);
    expect(assetOriginalTorrefacao.status).to.equal(1); // INACTIVE
    expect(assetOriginalTorrefacao.childAssets.length).to.equal(1);

    loteTorrado = assetOriginalTorrefacao.childAssets[0];
    const assetTorrado = await getAssetDetails(loteTorrado);
    expect(assetTorrado.amount).to.equal(massaTorrada);
    expect(assetTorrado.status).to.equal(0); // ACTIVE

    await logPhase("✅ TORREFAÇÃO CONCLUÍDA", {
      massa: assetTorrado.amount,
      local: assetTorrado.location,
      owner: assetTorrado.owner,
      gasUsed: receiptTorrefacao?.gasUsed
    });

    // ================================
    // FASE 5: CRIAÇÃO DE LOTES ADICIONAIS PARA BLEND
    // ================================
    console.log("\n ============================================================");    
    await logPhase("🎯 FASE 5A: CRIAÇÃO DE LOTES ADICIONAIS", {
      massa: "120kg Catuaí + 60kg Mundo Novo",
      local: "Simulação de outras fazendas"
    });

    // Create Catuaí lot (120kg for 30% of blend)
    const transactionCatuai = {
      processId: PROCESS_PLANTIO,
      natureId: NATURE_PRODUCAO,
      stageId: STAGE_INICIAL,
      channelName: CANAL_CAFE,
      targetAssetIds: [],
      operationData: {
        initialAmount: 120,
        initialLocation: "Fazenda Vale Verde - Catuaí Vermelho",
        targetOwner: hre.ethers.ZeroAddress,
        externalIds: ["CERT-CATUAI-2024"],
        splitAmounts: [],
        groupAmount: 0,
        newAmount: 0,
        newProcessId: hre.ethers.ZeroHash,
        newLocation: ""
      },
      dataHashes: [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("catuai_vermelho_torrado"))],
      description: "Lote Catuaí Vermelho já torrado - 120kg"
    };

    const txCatuai = await transactionOrchestrator.connect(torrefacao).submitTransaction(transactionCatuai);
    const receiptCatuai = await txCatuai.wait();

    // Create Mundo Novo lot (60kg for 10% of blend)
    const transactionMundoNovo = {
      processId: PROCESS_PLANTIO,
      natureId: NATURE_PRODUCAO,
      stageId: STAGE_INICIAL,
      channelName: CANAL_CAFE,
      targetAssetIds: [],
      operationData: {
        initialAmount: 60,
        initialLocation: "Fazenda Horizonte - Mundo Novo",
        targetOwner: hre.ethers.ZeroAddress,
        externalIds: ["CERT-MUNDO-NOVO-2024"],
        splitAmounts: [],
        groupAmount: 0,
        newAmount: 0,
        newProcessId: hre.ethers.ZeroHash,
        newLocation: ""
      },
      dataHashes: [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("mundo_novo_torrado"))],
      description: "Lote Mundo Novo já torrado - 60kg"
    };

    const txMundoNovo = await transactionOrchestrator.connect(torrefacao).submitTransaction(transactionMundoNovo);
    const receiptMundoNovo = await txMundoNovo.wait();

    // Extract asset IDs
    const eventCatuai = receiptCatuai?.logs.find((log: any) => {
      try {
        const parsed = transactionOrchestrator.interface.parseLog(log);
        return parsed?.name === "OperationExecuted";
      } catch { return false; }
    });
    const parsedEventCatuai = transactionOrchestrator.interface.parseLog(eventCatuai);
    const loteCatuai = parsedEventCatuai?.args.affectedAssets[0];

    const eventMundoNovo = receiptMundoNovo?.logs.find((log: any) => {
      try {
        const parsed = transactionOrchestrator.interface.parseLog(log);
        return parsed?.name === "OperationExecuted";
      } catch { return false; }
    });
    const parsedEventMundoNovo = transactionOrchestrator.interface.parseLog(eventMundoNovo);
    const loteMundoNovo = parsedEventMundoNovo?.args.affectedAssets[0];

    console.log("   ✅ Lotes adicionais criados para blend");

    // ================================
    // FASE 6: BLEND (TORREFAÇÃO) - GROUP_ASSET
    // ================================
    console.log("\n ============================================================");    
    await logPhase("🎯 FASE 6: BLEND PREMIUM - COMPOSIÇÃO FINAL", {
      massa: "200kg Bourbon + 120kg Catuaí + 60kg Mundo Novo = 380kg",
      local: "Torrefação Specialty Coffee - Linha de Blend",
      owner: "Torrefação"
    });

    const transactionBlend = {
      processId: PROCESS_BLEND,
      natureId: NATURE_PROCESSAMENTO,
      stageId: STAGE_FINAL,
      channelName: CANAL_CAFE,
      targetAssetIds: [loteTorrado, loteCatuai, loteMundoNovo],
      operationData: {
        initialAmount: 0,
        initialLocation: "",
        targetOwner: hre.ethers.ZeroAddress,
        externalIds: [],
        splitAmounts: [],
        groupAmount: 0,
        newAmount: 0,
        newProcessId: hre.ethers.ZeroHash,
        newLocation: "Torrefação Specialty Coffee - Blend Premium Santa Clara"
      },
      dataHashes: [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("blend_premium_santa_clara_60_30_10"))],
      description: "Blend Premium Santa Clara - 60% Bourbon + 30% Catuaí + 10% Mundo Novo"
    };

    const txBlend = await transactionOrchestrator.connect(torrefacao).submitTransaction(transactionBlend);
    const receiptBlend = await txBlend.wait();

    await tracer.captureAllEventsFromTransaction(receiptBlend);

    // Extract blend asset ID
    const eventBlend = receiptBlend?.logs.find((log: any) => {
      try {
        const parsed = transactionOrchestrator.interface.parseLog(log);
        return parsed?.name === "OperationExecuted";
      } catch { return false; }
    });
    const parsedEventBlend = transactionOrchestrator.interface.parseLog(eventBlend);
    const affectedAssetsBlend = parsedEventBlend?.args.affectedAssets;
    
    // The group asset is the last one in the affected assets array
    loteBlend = affectedAssetsBlend[affectedAssetsBlend.length - 1];

    // Validate blend creation
    const assetBlend = await getAssetDetails(loteBlend);
    expect(assetBlend.amount).to.equal(380); // 200 + 120 + 60
    expect(assetBlend.status).to.equal(0); // ACTIVE

    // Validate original assets are now inactive
    const assetTorradoFinal = await getAssetDetails(loteTorrado);
    const assetCatuaiFinal = await getAssetDetails(loteCatuai);
    const assetMundoNovoFinal = await getAssetDetails(loteMundoNovo);

    expect(assetTorradoFinal.status).to.equal(1); // INACTIVE
    expect(assetCatuaiFinal.status).to.equal(1); // INACTIVE
    expect(assetMundoNovoFinal.status).to.equal(1); // INACTIVE

    await logPhase("✅ BLEND PREMIUM CONCLUÍDO", {
      massa: assetBlend.amount,
      gasUsed: receiptBlend?.gasUsed
    });

    // ================================
    // 🔍 FASE 7: AUDITORIA COMPLETA (AUDITOR)
    // ================================
    console.log("\n ============================================================");    
    await logPhase("🔍 FASE 7: AUDITORIA ENHANCED - API LIMPA", {
      local: "Verificação end-to-end com biblioteca"
    });

    // Event capture statistics
    console.log("\n   📊 ESTATÍSTICAS DOS EVENTOS:");
    const eventStats = tracer.getCacheStats();
    console.log(`      Total eventos capturados: ${Object.values(eventStats.events).reduce((a: number, b: unknown) => a + (b as number), 0)}`);
    console.log(`      Cache hits: ${eventStats.cache.paths} caminhos, ${eventStats.cache.origins} origens`);
   
    // Traceability analysis
    console.log("\n   🔍 RASTREABILIDADE COMPLETA:");
    const composition = await tracer.getComposition(loteBlend);

    if (composition) {
      console.log(`      Blend Final: ${composition.componentCount} componentes (${composition.totalAmount}kg)`);
      
      for (let i = 0; i < composition.components.length; i++) {
        const component = composition.components[i];
        console.log(`     └─ Componente ${i + 1}: ${component.amount}kg (${component.percentage.toFixed(1)}%) - ${component.location}`);
        
        // Complete traceability path
        const fullPath = await tracer.getCompleteTraceabilityPath(component.assetId);
        console.log(`          Caminho: ${fullPath.totalSteps} etapas (${fullPath.genealogyDepth} genealógicas)`);
        console.log(`          Origem: ${fullPath.origins.length} origem(s)`);
        
        if (fullPath.summary.massLoss) {
          console.log(`          Perda: ${fullPath.summary.massLoss.lossPercentage.toFixed(1)}% (${fullPath.summary.massLoss.initial}kg → ${fullPath.summary.massLoss.final}kg)`);
        }
      }
    }
  
    // Detailed path analysis
    console.log("\nDetailed Path Analysis:");
    const detailedPath = await tracer.getDetailedAssetPath(loteBlend);

    console.log('\nComplete Asset Path JSON:');
    tracer.displayDetailedPathJSON(detailedPath);

    // Formatted table output
    console.log('\nAsset Lifecycle Table:');
    console.log('\n   Step | Type      | Amount | Location              | Owner    | Operation');
    console.log('   -----|-----------|--------|-----------------------|----------|----------');
    detailedPath.steps.forEach(step => {
      console.log(`   ${step.stepNumber.toString().padEnd(4)} | ${step.stepType.padEnd(9)} | ${step.asset.amount.toString().padEnd(6)} | ${step.asset.idLocal.padEnd(20)} | ${step.asset.owner.substring(0, 8)} | ${step.operation}`);
    });

    console.log("\nCritical System Validations:");
    
    expect(assetBlend.status).to.equal(0, "Final blend deve estar ativo");
    expect(assetBlend.amount).to.equal(380, "Massa do blend deve ser 380kg");
    expect(assetOriginalAposColheita.status).to.equal(1, "Asset original deve estar inativo");
    expect(assetBeneficiado.owner).to.equal(beneficiadora.address, "Asset beneficiado deve pertencer ao beneficiador");


    console.log("\n   ✅ RASTREABILIDADE COMPLETA VALIDADA COM API ENHANCED!");   
  });
});