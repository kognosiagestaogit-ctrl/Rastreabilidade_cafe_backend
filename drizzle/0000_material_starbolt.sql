CREATE TABLE "fazendas" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"proprietario" text,
	"cooperado_iniciais" text,
	"localizacao" text,
	"observacoes" text,
	"cor" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lotes" (
	"id" text PRIMARY KEY NOT NULL,
	"fazenda_id" text NOT NULL,
	"talhao_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safra" integer NOT NULL,
	"numero_lote_fazenda" text NOT NULL,
	"lote_colheita" text,
	"tipo_cafe" text,
	"colheita_tipo" text,
	"data_colheita_inicio" text,
	"data_colheita_fim" text,
	"status" text DEFAULT 'EM_COLHEITA' NOT NULL,
	"data_entrada_terreiro" text,
	"data_saida_terreiro" text,
	"data_entrada_secador" text,
	"data_saida_secador" text,
	"umidade" real,
	"numero_tulha" text,
	"data_beneficio" text,
	"data_envio_cooperativa" text,
	"numero_sacas" real,
	"numero_lote_cooperativa" text,
	"nf_remessa_cooperativa" text,
	"observacoes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talhoes" (
	"id" text PRIMARY KEY NOT NULL,
	"fazenda_id" text NOT NULL,
	"nome" text NOT NULL,
	"area_hectares" real,
	"variedade" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"password_hash" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'funcionario' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendas" (
	"id" text PRIMARY KEY NOT NULL,
	"fazenda_id" text NOT NULL,
	"lote_id" text,
	"numero_lote_cooperativa" text,
	"padrao" text,
	"quebra" real,
	"peneira" text,
	"amostra" text,
	"cliente" text,
	"nf_venda" text,
	"sacas_vendidas" real DEFAULT 0 NOT NULL,
	"tipo_venda" text,
	"data_venda" text,
	"vl_bruto" real,
	"vl_liquido" real,
	"a_receber_previsto" real,
	"valor_recebido" real,
	"data_recebimento" text,
	"premio_rainforest" real,
	"anuncio_venda" text,
	"nf_premio_rainforest" text,
	"premio_liquido_funrural" real,
	"observacoes" text,
	"cooperado" text,
	"data_envio_armazem" text,
	"sacas_do_lote" real,
	"nr_remessa_cooperativa" text,
	"lotes_agrupados" text,
	"descontos" real,
	"conta_corrente" text,
	"is_ds" integer,
	"data_recebimento_premio" text,
	"status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_fazenda_id_fazendas_id_fk" FOREIGN KEY ("fazenda_id") REFERENCES "public"."fazendas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talhoes" ADD CONSTRAINT "talhoes_fazenda_id_fazendas_id_fk" FOREIGN KEY ("fazenda_id") REFERENCES "public"."fazendas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_fazenda_id_fazendas_id_fk" FOREIGN KEY ("fazenda_id") REFERENCES "public"."fazendas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE set null ON UPDATE no action;