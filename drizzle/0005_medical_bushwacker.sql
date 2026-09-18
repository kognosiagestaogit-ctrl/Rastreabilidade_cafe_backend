ALTER TABLE "lotes" RENAME COLUMN "data_entrada_terreiro" TO "data_entrada_terreiro_inicio";--> statement-breakpoint
ALTER TABLE "amostras" ALTER COLUMN "data_recebimento" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "lotes" ALTER COLUMN "data_colheita_inicio" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "lotes" ALTER COLUMN "data_colheita_fim" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "lotes" ALTER COLUMN "data_saida_terreiro" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "lotes" ALTER COLUMN "data_entrada_secador" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "lotes" ALTER COLUMN "data_saida_secador" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "lotes" ALTER COLUMN "data_beneficio" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "lotes" ALTER COLUMN "data_envio_cooperativa" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "vendas" ALTER COLUMN "data_venda" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "vendas" ALTER COLUMN "data_recebimento" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "vendas" ALTER COLUMN "data_envio_armazem" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "vendas" ALTER COLUMN "data_recebimento_premio" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "lotes" ADD COLUMN "data_entrada_terreiro_fim" date;--> statement-breakpoint
ALTER TABLE "vendas" DROP COLUMN "sobra_sacas";--> statement-breakpoint
ALTER TABLE "vendas" DROP COLUMN "sobras";