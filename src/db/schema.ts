import {
  pgTable,
  text,
  timestamp,
  date,
  boolean,
  integer,
  real,
  jsonb,
} from "drizzle-orm/pg-core";

// ─── Usuários ──────────────────────────────────────────────────────────────────
export const usuariosTable = pgTable("usuarios", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  nome: text("nome").notNull(),
  password_hash: text("password_hash").notNull().default(""),
  role: text("role").notNull().default("funcionario"), // 'admin' | 'gerente' | 'funcionario'
  ativo: boolean("ativo").notNull().default(true),
  created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

// ─── Fazendas ─────────────────────────────────────────────────────────────────
export const fazendasTable = pgTable("fazendas", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  proprietario: text("proprietario"),
  cooperado_iniciais: text("cooperado_iniciais"),
  localizacao: text("localizacao"),
  observacoes: text("observacoes"),
  cor: text("cor"), // paleta de tema, ex: 'emerald', 'amber'
  created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

// ─── Talhões ──────────────────────────────────────────────────────────────────
export const talhoesTable = pgTable("talhoes", {
  id: text("id").primaryKey(),
  fazenda_id: text("fazenda_id")
    .notNull()
    .references(() => fazendasTable.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  area_hectares: real("area_hectares"),
  variedade: text("variedade"),
  created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

// ─── Lotes ────────────────────────────────────────────────────────────────────
export const lotesTable = pgTable("lotes", {
  id: text("id").primaryKey(),
  fazenda_id: text("fazenda_id")
    .notNull()
    .references(() => fazendasTable.id, { onDelete: "cascade" }),
  // talhao_ids armazena array de IDs de talhões vinculados ao lote
  talhao_ids: jsonb("talhao_ids").$type<string[]>().default([]).notNull(),
  safra: integer("safra").notNull(),
  numero_lote_fazenda: text("numero_lote_fazenda").notNull(),
  lote_colheita: text("lote_colheita"),
  tipo_cafe: text("tipo_cafe"),
  colheita_tipo: text("colheita_tipo"), // 'MANUAL' | 'MECANICA'
  data_colheita_inicio: date("data_colheita_inicio", { mode: "string" }), // ISO YYYY-MM-DD
  data_colheita_fim: date("data_colheita_fim", { mode: "string" }),
  status: text("status").notNull().default("EM_COLHEITA"),
  // EM_COLHEITA | NO_TERREIRO | NO_SECADOR | NA_TULHA | BENEFICIADO | ENVIADO_COOPERATIVA
  data_entrada_terreiro_inicio: date("data_entrada_terreiro_inicio", { mode: "string" }),
  data_entrada_terreiro_fim: date("data_entrada_terreiro_fim", { mode: "string" }),
  data_saida_terreiro: date("data_saida_terreiro", { mode: "string" }),
  data_entrada_secador: date("data_entrada_secador", { mode: "string" }),
  data_saida_secador: date("data_saida_secador", { mode: "string" }),
  umidade: real("umidade"),
  numero_tulha: text("numero_tulha"),
  data_beneficio: date("data_beneficio", { mode: "string" }),
  data_envio_cooperativa: date("data_envio_cooperativa", { mode: "string" }),
  numero_sacas: real("numero_sacas"),
  numero_lote_cooperativa: text("numero_lote_cooperativa"),
  amostra: text("amostra"),
  nf_remessa_cooperativa: text("nf_remessa_cooperativa"),
  observacoes: text("observacoes"),
  created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

// ─── Amostras ─────────────────────────────────────────────────────────────────
export const amostrasTable = pgTable("amostras", {
  id: text("id").primaryKey(),
  fazenda_id: text("fazenda_id")
    .notNull()
    .references(() => fazendasTable.id, { onDelete: "cascade" }),
  codigo_amostra: text("codigo_amostra").notNull().unique(),
  total_sacas: real("total_sacas").notNull().default(0), // soma total dos lotes (sacas ou equivalente)
  descontos: real("descontos").notNull().default(0),
  observacoes: text("observacoes"),
  a_receber_previsto: real("a_receber_previsto"),
  valor_recebido: real("valor_recebido"),
  data_recebimento: date("data_recebimento", { mode: "string" }),
  conta_corrente: text("conta_corrente"),
  is_ds: real("is_ds").notNull().default(0), // Valor financeiro
  premio_rainforest: real("premio_rainforest").notNull().default(0),
  anuncio_venda: text("anuncio_venda"),
  v_funrural: real("v_funrural").notNull().default(0),
  created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

// ─── Vendas ───────────────────────────────────────────────────────────────────
export const vendasTable = pgTable("vendas", {
  id: text("id").primaryKey(),
  fazenda_id: text("fazenda_id")
    .notNull()
    .references(() => fazendasTable.id, { onDelete: "cascade" }),
  lote_id: text("lote_id").references(() => lotesTable.id, { onDelete: "set null" }),
  numero_lote_cooperativa: text("numero_lote_cooperativa"),
  padrao: text("padrao"),
  quebra: real("quebra"),
  peneira: text("peneira"),
  amostra_id: text("amostra_id").references(() => amostrasTable.id, { onDelete: "set null" }), // Aponta para a nova entidade
  amostra: text("amostra"), // Mantido para armazenar o código bruto importado, se necessário
  cliente: text("cliente"),
  nf_venda: text("nf_venda"),
  sacas_vendidas: real("sacas_vendidas").notNull().default(0),
  tipo_venda: text("tipo_venda"), // 'CPR' | 'TERMO' | 'FISICA'
  data_venda: date("data_venda", { mode: "string" }),
  vl_bruto: real("vl_bruto"),
  vl_liquido: real("vl_liquido"),
  a_receber_previsto: real("a_receber_previsto"),
  valor_recebido: real("valor_recebido"),
  data_recebimento: date("data_recebimento", { mode: "string" }),
  premio_rainforest: real("premio_rainforest"),
  anuncio_venda: text("anuncio_venda"),
  nf_premio_rainforest: text("nf_premio_rainforest"),
  premio_liquido_funrural: real("premio_liquido_funrural"),
  observacoes: text("observacoes"),
  cooperado: text("cooperado"),
  data_envio_armazem: date("data_envio_armazem", { mode: "string" }),
  sacas_do_lote: real("sacas_do_lote"),
  sobra_sacas: real("sobra_sacas"),
  nr_remessa_cooperativa: text("nr_remessa_cooperativa"),
  lotes_agrupados: text("lotes_agrupados"),
  descontos: real("descontos"),
  conta_corrente: text("conta_corrente"),
  is_ds: integer("is_ds"),
  data_recebimento_premio: date("data_recebimento_premio", { mode: "string" }),
  status: text("status"), // 'A_RECEBER' | 'RECEBIDO' | 'RAINFOREST' | etc.
  created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

// ─── Integrações (Credenciais) ────────────────────────────────────────────────
export const integracoesCredenciaisTable = pgTable("integracoes_credenciais", {
  id: text("id").primaryKey(),
  fazenda_id: text("fazenda_id")
    .notNull()
    .references(() => fazendasTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // 'minasul' | futuramente outros
  username: text("username").notNull(), // login/matrícula do cooperado
  password_encrypted: text("password_encrypted").notNull(), // AES-256-GCM
  access_token: text("access_token"), // JWT obtido no login (cache)
  token_expires_at: timestamp("token_expires_at", { mode: "string" }),
  last_sync_at: timestamp("last_sync_at", { mode: "string" }),
  status: text("status").notNull().default("ATIVO"), // ATIVO | ERRO | DESATIVADO
  error_message: text("error_message"),
  created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});
