import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import hre from "hardhat";
import { deployTransactionOrchestrator } from "../fixture/deployTransactionOrchestrator";
import { getTestAccounts } from "../utils/index";

describe.only("COFFEE SUPPLY CHAIN - Complete Journey Integration Test", function () {

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

  //EVENT STORAGE FOR TRACEABILITY
  let lineageEvents: any[] = [];
  let relationshipEvents: any[] = [];
  let compositionEvents: any[] = [];
  let depthEvents: any[] = [];
  let custodyEvents: any[] = []; 
  let stateEvents: any[] = []; 



  //HELPER FUNCTIONS
  async function logPhase(phase: string, details: any) {
    console.log(`\n  ${phase}`);
    console.log(`     Timestamp: ${new Date().toISOString()}`);
    if (details.massa) console.log(`      Massa: ${details.massa}kg`);
    if (details.local) console.log(`      Local: ${details.local}`);
    if (details.owner) console.log(`      Proprietário: ${details.owner}`);
    if (details.gasUsed) console.log(`      Gas Used: ${details.gasUsed.toLocaleString()}`);
  }

  async function validateMassConservation(expectedMass: number, actualMass: number, tolerance: number = 0) {
    const difference = Math.abs(expectedMass - actualMass);
    expect(difference).to.be.lte(tolerance, 
      `❌ CONSERVAÇÃO DE MASSA VIOLADA! Esperado: ${expectedMass}kg, Atual: ${actualMass}kg`);
    console.log(`      Conservação de massa validada: ${actualMass}kg`);
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

  //EVENT CAPTURE FUNCTIONS
  async function captureEventsByTransaction(receipt: any, eventType: string) {
    const events = receipt.logs
      .filter((log: any) => {
        try {
          const parsed = assetRegistry.interface.parseLog(log);
          return parsed?.name === eventType;
        } catch { return false; }
      })
      .map((log: any) => assetRegistry.interface.parseLog(log));
    
    // Store events for later analysis
    if (eventType === 'AssetLineage') {
      lineageEvents.push(...events);
    } else if (eventType === 'AssetRelationship') {
      relationshipEvents.push(...events);
    } else if (eventType === 'AssetComposition') {
      compositionEvents.push(...events);
    } else if (eventType === 'AssetDepthCalculated') {
      depthEvents.push(...events);
    } else if (eventType === 'AssetCustodyChanged') { 
      custodyEvents.push(...events);
    } else if (eventType === 'AssetStateChanged') {
      stateEvents.push(...events);
    }
    
    return events;
  }

  async function buildTraceabilityGraphFromEvents() {
    console.log("\n   CONSTRUINDO GRAFO DE RASTREABILIDADE A PARTIR DOS EVENTOS:");
    
    //Mostrar todos os eventos de lineage
    /*
    console.log(`       DEBUG - Todos os eventos de lineage:`);
    lineageEvents.forEach((event, idx) => {
      const relType = Number(event.args.relationshipType);
      const relTypeNames = ["SPLIT", "TRANSFORM", "GROUP_COMPONENT", "TRANSFER", "UPDATE"];
      console.log(`         ${idx + 1}. Parent: ${event.args.parentAssetId.substring(0, 10)}... → Child: ${event.args.childAssetId.substring(0, 10)}... (${relTypeNames[relType]})`);
    });
    */
    
    // Create adjacency map for lineage
    const lineageMap = new Map<string, any[]>();
    const reverseLineageMap = new Map<string, any[]>();
    
    lineageEvents.forEach(event => {
      const parent = event.args.parentAssetId;
      const child = event.args.childAssetId;
      const relType = Number(event.args.relationshipType);
      const timestamp = Number(event.args.timestamp);
      
      // Forward lineage (parent -> children)
      if (!lineageMap.has(parent)) {
        lineageMap.set(parent, []);
      }
      lineageMap.get(parent)!.push({ child, relType, timestamp });
      
      // Reverse lineage (child -> parents)
      if (!reverseLineageMap.has(child)) {
        reverseLineageMap.set(child, []);
      }
      reverseLineageMap.get(child)!.push({ parent, relType, timestamp });
    });
    
    //Mostrar mapas construídos
    /*
    console.log(`         DEBUG - Forward lineage map:`);
    for (const [parent, children] of lineageMap.entries()) {
      console.log(`         ${parent.substring(0, 10)}... → ${children.length} filhos`);
    }
    
    console.log(`        DEBUG - Reverse lineage map:`);
    for (const [child, parents] of reverseLineageMap.entries()) {
      console.log(`         ${child.substring(0, 10)}... ← ${parents.length} pais`);
    }
    */
    
    return { lineageMap, reverseLineageMap };
  }

  async function traceAssetToOrigins(assetId: string, reverseLineageMap: Map<string, any[]>): Promise<string[]> {
    const visited = new Set<string>();
    const origins: string[] = [];
    
    async function dfs(currentId: string, depth: number = 0) {
      
      if (visited.has(currentId) || depth > 10) {
        return;
      }
      visited.add(currentId);
      
      const parents = reverseLineageMap.get(currentId) || [];
      
      if (parents.length === 0) {
        // This is an origin asset
        origins.push(currentId);
        return;
      }
      
      for (const parentInfo of parents) {
        await dfs(parentInfo.parent, depth + 1);
      }
    }
    
    await dfs(assetId);
    return origins;
  }

  async function buildCompleteTransformationPath(assetId: string): Promise<any[]> {
    console.log(`          🔍 CONSTRUINDO CAMINHO COMPLETO para: ${assetId.substring(0, 10)}...`);
    
    const completePath: any[] = [];
    
    // 1. Build genealogical backbone from lineage events
    const genealogyPath = await traceGenealogyToOrigin(assetId);
    
    // 2. For each asset in genealogy, find custody/state changes
    for (let i = 0; i < genealogyPath.length; i++) {
      const currentAssetId = genealogyPath[i];
      const assetDetails = await getAssetDetails(currentAssetId);
      
      // Add the asset to path
      completePath.push({
        type: i === 0 ? 'ORIGIN' : 'GENEALOGY',
        assetId: currentAssetId,
        location: assetDetails.location,
        amount: assetDetails.amount,
        step: i + 1
      });
      
      // Find custody changes for this asset
      const assetCustodyChanges = custodyEvents.filter(e => e.args.assetId === currentAssetId);
      assetCustodyChanges.forEach((custodyEvent, idx) => {
        completePath.push({
          type: 'CUSTODY',
          assetId: currentAssetId,
          location: custodyEvent.args.newLocation,
          amount: assetDetails.amount,
          previousOwner: custodyEvent.args.previousOwner,
          newOwner: custodyEvent.args.newOwner,
          step: `${i + 1}.${idx + 1}`
        });
      });
      
      // Find state changes for this asset
      const assetStateChanges = stateEvents.filter(e => e.args.assetId === currentAssetId);
      assetStateChanges.forEach((stateEvent, idx) => {
        completePath.push({
          type: 'STATE',
          assetId: currentAssetId,
          location: stateEvent.args.newLocation,
          amount: Number(stateEvent.args.newAmount),
          previousLocation: stateEvent.args.previousLocation,
          step: `${i + 1}.${idx + 1}`
        });
      });
    }
    
    // 3. Sort by step order to maintain chronology
    completePath.sort((a, b) => {
      const stepA = parseFloat(a.step.toString());
      const stepB = parseFloat(b.step.toString());
      return stepA - stepB;
    });
    
    console.log(`          🎯 Caminho completo construído com ${completePath.length} etapas`);
    return completePath;
  }

  // Helper function for genealogy-only path
  async function traceGenealogyToOrigin(assetId: string): Promise<string[]> {
    const { lineageMap, reverseLineageMap } = await buildTraceabilityGraphFromEvents();
    const path: string[] = [];
    const visited = new Set<string>();
    
    async function tracePath(currentId: string) {
      if (visited.has(currentId) || path.length > 10) return;
      visited.add(currentId);
      path.unshift(currentId);
      
      const parents = reverseLineageMap.get(currentId) || [];
      
      // Only follow genealogical parents (exclude TRANSFER/UPDATE)
      const genealogicalParents = parents.filter(p => p.relType !== 3 && p.relType !== 4);
      
      if (genealogicalParents.length > 0) {
        // Follow first genealogical parent
        await tracePath(genealogicalParents[0].parent);
      }
    }
    
    await tracePath(assetId);
    return path;
  }

  it("COMPLETE COFFEE SUPPLY CHAIN", async function () {
    
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

    const depthEventsPlantio = await captureEventsByTransaction(receiptPlantio, 'AssetDepthCalculated');
    
    if (depthEventsPlantio.length > 0) {
      const depthEvent = depthEventsPlantio[0];
      console.log(`      Asset ID: ${depthEvent.args.assetId}`);
      console.log(`      Profundidade: ${depthEvent.args.depth} (origem)`);
      console.log(`      Origins: ${depthEvent.args.originAssets.length} (vazio para origem)`);
    }

    // Extract asset ID from events
    const eventPlantio = receiptPlantio?.logs.find((log: any) => {
      try {
        const parsed = transactionOrchestrator.interface.parseLog(log);
        return parsed?.name === "OperationExecuted";
      } catch { return false; }
    });
    const parsedEventPlantio = transactionOrchestrator.interface.parseLog(eventPlantio);
    assetOriginalId = parsedEventPlantio?.args.affectedAssets[0];

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
        newLocation: "Terreiro de Secagem - Separação Manual Seletiva"
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

    //CAPTURAR EVENTOS DE LINEAGE
    const lineageEventsColheita = await captureEventsByTransaction(receiptColheita, 'AssetLineage');
    console.log(`   📊 Eventos de lineage capturados: ${lineageEventsColheita.length}`);

    lineageEventsColheita.forEach((event: any, idx: any) => {
      const relType = Number(event.args.relationshipType);
      const relTypeNames = ["SPLIT", "TRANSFORM", "GROUP_COMPONENT", "TRANSFER", "UPDATE"];
      console.log(`      ${idx + 1}. ${event.args.childAssetId} ← ${event.args.parentAssetId} (${relTypeNames[relType] || relType})`);
    });

    //CAPTURAR EVENTOS DE RELATIONSHIP
    const relationshipEventsColheita = await captureEventsByTransaction(receiptColheita, 'AssetRelationship');
    console.log(`   📊 Eventos de relacionamento capturados: ${relationshipEventsColheita.length}`);
    
    if (relationshipEventsColheita.length > 0) {
      const relEvent = relationshipEventsColheita[0];
      console.log(`      Operação: SPLIT (${relEvent.args.operationType})`);
      console.log(`      Asset principal: ${relEvent.args.primaryAssetId}`);
      console.log(`      Assets relacionados: ${relEvent.args.relatedAssets.length}`);
    }

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
      local: "Beneficiadora Vale do Rio Doce",
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
        newLocation: "Beneficiadora Vale do Rio Doce - Linha Lavado"
      },
      dataHashes: [hre.ethers.keccak256(hre.ethers.toUtf8Bytes("lavado_fermentacao_24h_premium"))],
      description: "Transferência para beneficiamento - Processo lavado com fermentação controlada 24h"
    };

    const txBeneficiamento = await transactionOrchestrator.connect(fazendeiro).submitTransaction(transactionBeneficiamento);
    const receiptBeneficiamento = await txBeneficiamento.wait();

    //CAPTURAR EVENTOS DE TRANSFER
    const lineageEventsBeneficiamento = await captureEventsByTransaction(receiptBeneficiamento, 'AssetLineage');
    console.log(`   📊 Eventos de lineage (transfer) capturados: ${lineageEventsBeneficiamento.length}`);
    
    if (lineageEventsBeneficiamento.length > 0) {
      const transferEvent = lineageEventsBeneficiamento[0];
      console.log(`      Transfer: ${transferEvent.args.childAssetId} ← ${transferEvent.args.parentAssetId} (ownership change)`);
    }

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
      local: "Torrefação Specialty Coffee - Local C",
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

    //CAPTURAR EVENTOS DE TRANSFER
    const lineageEventsTorrefacaoTransfer = await captureEventsByTransaction(receiptTransferTorrefacao, 'AssetLineage');
    console.log(`   📊 Eventos de lineage (transfer) capturados: ${lineageEventsBeneficiamento.length}`);
    
    if (lineageEventsTorrefacaoTransfer.length > 0) {
      const transferEvent = lineageEventsTorrefacaoTransfer[0];
      console.log(`      Transfer: ${transferEvent.args.childAssetId} ← ${transferEvent.args.parentAssetId} (ownership change)`);
    }
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

    //CAPTURAR EVENTOS DE TRANSFORM
    const lineageEventsTorrefacao = await captureEventsByTransaction(receiptTorrefacao, 'AssetLineage');
    console.log(`   📊 Eventos de lineage (transform) capturados: ${lineageEventsTorrefacao.length}`);
    
    if (lineageEventsTorrefacao.length > 0) {
      const transformEvent = lineageEventsTorrefacao[0];
      console.log(`      Transform: ${transformEvent.args.childAssetId} ← ${transformEvent.args.parentAssetId} (thermal transformation)`);
    }

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

    //CAPTURAR EVENTOS DE GROUP/COMPOSITION
    const lineageEventsBlend = await captureEventsByTransaction(receiptBlend, 'AssetLineage');
    console.log(`   📊 Eventos de lineage (group) capturados: ${lineageEventsBlend.length}`);
    
    lineageEventsBlend.forEach((event: any, idx: any) => {
      console.log(`      ${idx + 1}. Group component: ${event.args.childAssetId} ← ${event.args.parentAssetId}`);
    });

    const compositionEventsBlend = await captureEventsByTransaction(receiptBlend, 'AssetComposition');
    console.log(`   📊 Eventos de composição capturados: ${compositionEventsBlend.length}`);
    
    if (compositionEventsBlend.length > 0) {
      const compEvent = compositionEventsBlend[0];
      console.log(`      Blend asset: ${compEvent.args.assetId}`);
      console.log(`      Components: ${compEvent.args.componentAssets.length}`);
      console.log(`      Amounts: ${compEvent.args.componentAmounts.map((a: any) => Number(a)).join(', ')}kg`);
    }

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
    await logPhase("🔍 FASE 7: AUDITORIA COMPLETA - RASTREABILIDADE TOTAL", {
      massa: assetBlend.amount,
      local: "Verificação end-to-end"
    });

    // 7.1 - BUILD TRACEABILITY GRAPH FROM EVENTS
    console.log("\n   🔗 CONSTRUINDO GRAFO DE RASTREABILIDADE:");
    const { lineageMap, reverseLineageMap } = await buildTraceabilityGraphFromEvents();
    
    console.log(`      Total eventos de lineage processados: ${lineageEvents.length}`);
    console.log(`      Assets com filhos: ${lineageMap.size}`);
    console.log(`      Assets com pais: ${reverseLineageMap.size}`);

    // 7.2 - ENHANCED REVERSE TRACEABILITY
    console.log("\n   🔍 RASTREABILIDADE REVERSA ENHANCED:");
    
    // Get blend composition from events
    const blendComposition = compositionEvents.find(e => e.args.assetId === loteBlend);
    if (blendComposition) {
      console.log(`      Blend Final: ${blendComposition.args.componentAssets.length} lotes componentes`);
      
      for (let i = 0; i < blendComposition.args.componentAssets.length; i++) {
        const componentId = blendComposition.args.componentAssets[i];
        const componentAmount = Number(blendComposition.args.componentAmounts[i]);
        
        // Get component details
        const component = await getAssetDetails(componentId);
        console.log(`     └─ Componente ${i + 1}: ${componentAmount}kg - ${component.location}`);
        
        // 🎯 TRACE TO ORIGINS USING EVENTS
        const origins = await traceAssetToOrigins(componentId, reverseLineageMap);
        console.log(`          Origens encontradas: ${origins.length}`);
        
        for (const originId of origins) {
          const originAsset = await getAssetDetails(originId);
          console.log(`         🌱 Origem: ${originAsset.location} (${originAsset.amount}kg inicial)`);
          
          // Show transformation path from events
          const completePath = await buildCompleteTransformationPath(componentId);
          if (completePath.length > 1) {
            console.log(`          Caminho completo: ${completePath.length} etapas`);
            completePath.forEach((step, j) => {
              let stepIcon = '';
              let stepDesc = '';
              
              if (step.type === 'ORIGIN') {
                stepIcon = '🌱';
                stepDesc = `${step.location} (${step.amount}kg)`;
              } else if (step.type === 'GENEALOGY') {
                stepIcon = '→';
                stepDesc = `${step.location} (${step.amount}kg)`;
              } else if (step.type === 'CUSTODY') {
                stepIcon = '👥';
                stepDesc = `Custody: ${step.previousOwner.substring(0, 10)}... → ${step.newOwner.substring(0, 10)}... @ ${step.location}`;
              } else if (step.type === 'STATE') {
                stepIcon = '📍';
                stepDesc = `Location: ${step.previousLocation} → ${step.location} (${step.amount}kg)`;
              }
              
              console.log(`         ${j + 1}. ${stepIcon} ${stepDesc}`);
            });
          }
        }
      }
    }

    // 7.3 - MASS CONSERVATION VALIDATION FROM EVENTS
    /*
    console.log("\n   ⚖️ VALIDAÇÃO DE CONSERVAÇÃO DE MASSA VIA EVENTOS:");
    
    let totalInitialMass = 0;
    let totalFinalMass = 0;
    
    // Calculate from depth events (origins)
    for (const depthEvent of depthEvents) {
      if (Number(depthEvent.args.depth) === 0) { // Origin assets
        const originAsset = await getAssetDetails(depthEvent.args.assetId);
        totalInitialMass += originAsset.amount;
        console.log(`      🌱 Massa inicial detectada: ${originAsset.amount}kg (${depthEvent.args.assetId.substring(0, 10)}...)`);
      }
    }
    
    // Calculate final mass from blend composition
    if (blendComposition) {
      totalFinalMass = blendComposition.args.componentAmounts.reduce((sum: number, amount: any) => sum + Number(amount), 0);
    }
      
    console.log(`      📏 Massa total inicial (eventos): ${totalInitialMass}kg`);
    console.log(`      📏 Massa total final (blend): ${totalFinalMass}kg`);
    console.log(`      📏 Perda na cadeia: ${totalInitialMass - totalFinalMass}kg (${((totalInitialMass - totalFinalMass) / totalInitialMass * 100).toFixed(1)}%)`);

    // 7.4 - NETWORK TOPOLOGY ANALYSIS
    console.log("\n   🕸️ ANÁLISE DE TOPOLOGIA DA REDE:");
    
    const uniqueAssets = new Set([
      ...lineageEvents.map(e => e.args.parentAssetId),
      ...lineageEvents.map(e => e.args.childAssetId)
    ]);
    
    const leafAssets = Array.from(uniqueAssets).filter(assetId => !lineageMap.has(assetId));
    const rootAssets = Array.from(uniqueAssets).filter(assetId => !reverseLineageMap.has(assetId));
    
    console.log(`      🌐 Assets únicos na rede: ${uniqueAssets.size}`);
    console.log(`      🌱 Assets origem (sem pais): ${rootAssets.length}`);
    console.log(`      🍃 Assets folha (sem filhos): ${leafAssets.length}`);

    // 7.5 - FINAL VALIDATIONS
    console.log("\n   ✅ VALIDAÇÕES FINAIS ENHANCED:");

    // Validate all major operations created proper events
    expect(lineageEvents.length).to.be.greaterThan(0, "Eventos de lineage devem existir");
    expect(relationshipEvents.length).to.be.greaterThan(0, "Eventos de relacionamento devem existir");
    expect(compositionEvents.length).to.be.greaterThan(0, "Eventos de composição devem existir");
    expect(depthEvents.length).to.be.greaterThan(0, "Eventos de profundidade devem existir");
    
    // Validate mass conservation is trackable through events
    expect(totalFinalMass).to.equal(380, "Massa final deve ser rastreável via eventos");
    expect(totalInitialMass).to.be.greaterThan(totalFinalMass, "Deve haver perda natural detectada");
    
    // Validate graph connectivity
    expect(uniqueAssets.size).to.be.greaterThan(5, "Rede deve ter múltiplos assets conectados");
    expect(rootAssets.length).to.be.greaterThan(0, "Deve haver assets origem");
    expect(leafAssets.length).to.be.greaterThan(0, "Deve haver assets finais");
    
    console.log("     ✅ Todas as validações de eventos passaram!");

    // Final assertion to mark test as successful
    expect(true).to.be.true;
    */
  });
});