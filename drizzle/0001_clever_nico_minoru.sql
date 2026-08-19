CREATE TABLE "amostras" (
	"id" text PRIMARY KEY NOT NULL,
	"fazenda_id" text NOT NULL,
	"codigo_amostra" text NOT NULL,
	"total_sacas" real DEFAULT 0 NOT NULL,
	"descontos" real DEFAULT 0 NOT NULL,
	"observacoes" text,
	"a_receber_previsto" real,
	"valor_recebido" real,
	"data_recebimento" text,
	"conta_corrente" text,
	"is_ds" real DEFAULT 0 NOT NULL,
	"premio_rainforest" real DEFAULT 0 NOT NULL,
	"anuncio_venda" text,
	"v_funrural" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "amostras_codigo_amostra_unique" UNIQUE("codigo_amostra")
);
--> statement-breakpoint
CREATE TABLE "integracoes_credenciais" (
	"id" text PRIMARY KEY NOT NULL,
	"fazenda_id" text NOT NULL,
	"provider" text NOT NULL,
	"username" text NOT NULL,
	"password_encrypted" text NOT NULL,
	"access_token" text,
	"token_expires_at" timestamp,
	"last_sync_at" timestamp,
	"status" text DEFAULT 'ATIVO' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lotes" ADD COLUMN "amostra" text;--> statement-breakpoint
ALTER TABLE "vendas" ADD COLUMN "amostra_id" text;--> statement-breakpoint
ALTER TABLE "amostras" ADD CONSTRAINT "amostras_fazenda_id_fazendas_id_fk" FOREIGN KEY ("fazenda_id") REFERENCES "public"."fazendas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integracoes_credenciais" ADD CONSTRAINT "integracoes_credenciais_fazenda_id_fazendas_id_fk" FOREIGN KEY ("fazenda_id") REFERENCES "public"."fazendas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_amostra_id_amostras_id_fk" FOREIGN KEY ("amostra_id") REFERENCES "public"."amostras"("id") ON DELETE set null ON UPDATE no action;