import { cron } from "bun";
import { env } from "../config/env";

export function initCronJobs() {
  console.log("⏰ Inicializando rotinas agendadas (Cron)...");

  cron("0 * * * * ", async () => {
    console.log("🔄 [CRON] Executando sincronização automatizada com Minasul...");
    try {
      // Chama a própria rota interna que lida com o sync
      const response = await fetch(`http://localhost:${env.PORT}/api/crons/sync-minasul-vendas`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (response.ok) {
        console.log(`✅ [CRON] Sincronização concluída com sucesso:`, data);
      } else {
        console.error(`❌ [CRON] Falha na sincronização (Status ${response.status}):`, data);
      }
    } catch (err) {
      console.error("❌ [CRON] Erro na requisição de cron:", err);
    }
  });
}
