import {
  pgTable,
  text,
  timestamp,
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
  data_colheita_inicio: text("data_colheita_inicio"), // ISO YYYY-MM-DD
  data_colheita_fim: text("data_colheita_fim"),
  status: text("status").notNull().default("EM_COLHEITA"),
  // EM_COLHEITA | NO_TERREIRO | NO_SECADOR | NA_TULHA | BENEFICIADO | ENVIADO_COOPERATIVA
  data_entrada_terreiro: text("data_entrada_terreiro"),
  data_saida_terreiro: text("data_saida_terreiro"),
  data_entrada_secador: text("data_entrada_secador"),
  data_saida_secador: text("data_saida_secador"),
  umidade: real("umidade"),
  numero_tulha: text("numero_tulha"),
  data_beneficio: text("data_beneficio"),
  data_envio_cooperativa: text("data_envio_cooperativa"),
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
  data_recebimento: text("data_recebimento"),
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
  data_venda: text("data_venda"),
  vl_bruto: real("vl_bruto"),
  vl_liquido: real("vl_liquido"),
  a_receber_previsto: real("a_receber_previsto"),
  valor_recebido: real("valor_recebido"),
  data_recebimento: text("data_recebimento"),
  premio_rainforest: real("premio_rainforest"),
  anuncio_venda: text("anuncio_venda"),
  nf_premio_rainforest: text("nf_premio_rainforest"),
  premio_liquido_funrural: real("premio_liquido_funrural"),
  observacoes: text("observacoes"),
  cooperado: text("cooperado"),
  data_envio_armazem: text("data_envio_armazem"),
  sacas_do_lote: real("sacas_do_lote"),
  nr_remessa_cooperativa: text("nr_remessa_cooperativa"),
  lotes_agrupados: text("lotes_agrupados"),
  descontos: real("descontos"),
  conta_corrente: text("conta_corrente"),
  is_ds: integer("is_ds"),
  data_recebimento_premio: text("data_recebimento_premio"),
  status: text("status"), // 'A_RECEBER' | 'RECEBIDO' | 'RAINFOREST' | etc.
  created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

// ─── Integrações (Credenciais) ────────────────────────────────────────────────
export const integracoesCredenciaisTable = pgTable("integracoes_credenciais", {
  id: text("id").primaryKey(),
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
