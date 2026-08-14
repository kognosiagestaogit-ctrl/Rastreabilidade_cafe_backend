import { db } from "./client";
import { usuariosTable, fazendasTable, talhoesTable, lotesTable, vendasTable } from "./schema";
import { randomUUID } from "crypto";
import "dotenv/config";

// ─── Configuração do usuário inicial ──────────────────────────────────────────
const SEED_USER = {
  email: "admin@fazendapedranegra.com.br",
  nome: "Administrador",
  password: "admin123",
  role: "admin" as const,
};

async function seed() {
  console.log("🌱 Iniciando seed do banco de dados...\n");

  const now = new Date().toISOString();

  try {
    // 1. Cria Usuário
    const password_hash = await Bun.password.hash(SEED_USER.password, {
      algorithm: "bcrypt",
      cost: 10,
    });

    await db
      .insert(usuariosTable)
      .values({
        id: "admin-001",
        email: SEED_USER.email,
        nome: SEED_USER.nome,
        password_hash,
        role: SEED_USER.role,
        ativo: true,
        created_at: now,
        updated_at: now,
      })
      .onConflictDoNothing();
    
    console.log("✅ Usuário criado.");

    // 2. Cria Fazenda
    const fazendaId = "fazenda-001";
    await db
      .insert(fazendasTable)
      .values({
        id: fazendaId,
        nome: "Fazenda Pedra Negra (Seed)",
        proprietario: "Usuário",
        cooperado_iniciais: "FPN",
        localizacao: "Minas Gerais",
        observacoes: "Fazenda criada via script de seed.",
        cor: "emerald",
        created_at: now,
        updated_at: now,
      })
      .onConflictDoNothing();
      
    console.log("✅ Fazenda criada.");

    // 3. Cria Talhões
    const talhao1Id = randomUUID();
    const talhao2Id = randomUUID();
    
    await db.insert(talhoesTable).values([
      {
        id: talhao1Id,
        fazenda_id: fazendaId,
        nome: "Talhão 1 - Catucaí",
        area_hectares: 12.5,
        variedade: "Catucaí Amarelo",
        created_at: now,
      },
      {
        id: talhao2Id,
        fazenda_id: fazendaId,
        nome: "Talhão 2 - Mundo Novo",
        area_hectares: 15.0,
        variedade: "Mundo Novo",
        created_at: now,
      },
    ]);
    
    console.log("✅ Talhões criados.");

    // 4. Cria Lotes
    const lote1Id = randomUUID();
    const lote2Id = randomUUID();
    
    await db.insert(lotesTable).values([
      {
        id: lote1Id,
        fazenda_id: fazendaId,
        safra: 2026,
        numero_lote_fazenda: "100",
        tipo_cafe: "NATURAL",
        status: "NO_TERREIRO",
        data_colheita_inicio: "2026-08-01",
        data_entrada_terreiro: "2026-08-03",
        numero_sacas: 20,
        talhao_ids: [talhao1Id],
        colheita_tipo: "MANUAL",
        created_at: now,
        updated_at: now,
      },
      {
        id: lote2Id,
        fazenda_id: fazendaId,
        safra: 2026,
        numero_lote_fazenda: "101",
        tipo_cafe: "CEREJA DESCASCADO",
        status: "NO_SECADOR",
        data_entrada_secador: "2026-08-04",
        umidade: 11,
        talhao_ids: [talhao1Id, talhao2Id],
        created_at: now,
        updated_at: now,
      }
    ]);

    console.log("✅ Lotes criados.");

    // 5. Cria Vendas
    const venda1Id = randomUUID();
    const venda2Id = randomUUID();
    
    await db.insert(vendasTable).values([
      {
        id: venda1Id,
        fazenda_id: fazendaId,
        cliente: "Exportadora Guaxupé",
        numero_lote_cooperativa: "501",
        tipo_venda: "FISICA",
        data_venda: "2026-08-02",
        sacas_vendidas: 50,
        vl_bruto: 65000,
        vl_liquido: 64025,
        a_receber_previsto: 64025,
        status: "A_RECEBER",
        padrao: "Café Arábica Tipo 6",
        peneira: "17/18",
        amostra: "AM-01",
        nf_venda: "NF-1042",
        observacoes: "Venda de lote especial para exportação",
        cooperado: "FPN",
        data_envio_armazem: "2026-08-01",
        sacas_do_lote: 50,
        nr_remessa_cooperativa: "REM-882",
        lote_id: lote1Id,
        created_at: now,
        updated_at: now,
      },
      {
        id: venda2Id,
        fazenda_id: fazendaId,
        cliente: "Café Sul de Minas S/A",
        numero_lote_cooperativa: "502",
        tipo_venda: "CPR",
        data_venda: "2026-07-20",
        sacas_vendidas: 100,
        vl_bruto: 130000,
        vl_liquido: 128050,
        a_receber_previsto: 128050,
        valor_recebido: 128050,
        data_recebimento: "2026-08-01",
        premio_rainforest: 5000,
        premio_liquido_funrural: 4925,
        data_recebimento_premio: "2026-08-05",
        nf_premio_rainforest: "NF-PR-88",
        status: "RAINFOREST",
        padrao: "Café Especial FPN",
        peneira: "16",
        amostra: "AM-02",
        nf_venda: "NF-998",
        anuncio_venda: "AN-12",
        observacoes: "Pagamento e prêmio faturados com sucesso",
        cooperado: "FPN",
        data_envio_armazem: "2026-07-18",
        sacas_do_lote: 100,
        nr_remessa_cooperativa: "REM-880",
        conta_corrente: "Banco do Brasil - Ag. 1234",
        created_at: now,
        updated_at: now,
      }
    ]);

    console.log("✅ Vendas criadas.");

    console.log("\n🎉 Seed completo com sucesso!");
    console.log("\nDados de acesso:");
    console.log("  E-mail  :", SEED_USER.email);
    console.log("  Senha   :", SEED_USER.password);
    console.log("\n🚀 Agora rode: bun run dev");
  } catch (err: any) {
    console.error("❌ Erro durante o seed:", err.message);
    process.exit(1);
  }

  process.exit(0);
}

seed();
