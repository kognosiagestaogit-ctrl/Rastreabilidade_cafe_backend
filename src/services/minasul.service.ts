/**
 * Service de integração com a API do Portal do Cooperado Minasul.
 *
 * Base URL: https://apiportaldocooperado.minasul.com.br
 * Auth: Bearer JWT + header fixo `access`
 */

const BASE_URL = "https://apiportaldocooperado.minasul.com.br";
const ACCESS_KEY = "rtxiH3c6WSpQgQYpVN1AURcKbkxojXBT";

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "content-type": "application/json",
  "access": ACCESS_KEY,
  "origin": "https://portaldocooperado.minasul.com.br",
  "referer": "https://portaldocooperado.minasul.com.br/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
};

// ─── Tipos de resposta ────────────────────────────────────────────────────────

function parseMinasulError(status: number, bodyText: string, context: string): Error {
  let errorMsg = "O serviço da Minasul pode estar indisponível no momento. Tente novamente mais tarde!";
  try {
    const errorData = JSON.parse(bodyText);
    if (status >= 400 && status < 500) {
      if (errorData.message) errorMsg = errorData.message;
      else if (errorData.error) errorMsg = errorData.error;
    } else {
      console.error(`[MINASUL ERROR] ${context} - HTTP ${status}:`, bodyText);
    }
  } catch {
    // Fallback genérico para erros em HTML ou fora do padrão (502, timeout, etc)
    console.error(`[MINASUL ERROR] ${context} - Falha no parser JSON (HTTP ${status}):`, bodyText);
  }
  return new Error(`${context}: ${errorMsg}`);
}

export type MinasulLoginResponse = {
  user: {
    token: {
      token: string;
    };
    [key: string]: any;
  };
  [key: string]: any;
};

export type MinasulVendaResumo = {
  salesId: string;
  coopBatchId: string;
  [key: string]: any; // campos variáveis da API
};

export type MinasulVendaDetalhe = {
  [key: string]: any; // estrutura completa retornada pela API
};

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Faz login na API da Minasul e retorna o token JWT.
 */
export async function minasulLogin(
  username: string,
  password: string
): Promise<{ token: string }> {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    throw parseMinasulError(res.status, bodyText, "Falha no login Minasul");
  }

  const data = await res.json() as MinasulLoginResponse;
  
  if (!data?.user?.token?.token) {
    throw new Error("Formato de token inesperado na resposta da Minasul");
  }

  return { token: data.user.token.token };
}

// ─── Buscar demonstrativos de vendas ──────────────────────────────────────────

/**
 * Busca a lista de demonstrativos de vendas em um período.
 *
 * @param token JWT obtido no login
 * @param dateIni Data início no formato YYYY-MM-DD
 * @param dateEnd Data fim no formato YYYY-MM-DD
 * @param typeSales Tipo de venda ("0" = todas)
 * @param coffeePremiation Inclui premiação de café
 */
export async function minasulFetchVendas(
  token: string,
  dateIni: string,
  dateEnd: string,
  typeSales: string = "0",
  coffeePremiation: boolean = false
): Promise<MinasulVendaResumo[]> {
  const res = await fetch(`${BASE_URL}/coffee/portal-sales-demonstrative-ax`, {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ dateIni, dateEnd, typeSales, coffeePremiation }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    throw parseMinasulError(res.status, bodyText, "Falha ao buscar vendas Minasul");
  }

  const data = await res.json();
  return data as MinasulVendaResumo[];
}

// ─── Buscar detalhes de uma venda ─────────────────────────────────────────────

/**
 * Busca os detalhes de uma venda específica.
 *
 * @param token JWT obtido no login
 * @param salesId ID da venda (ex: "AM-00311777")
 * @param coopBatchId ID do lote cooperativa (ex: "26270100028")
 */
export async function minasulFetchVendaDetalhes(
  token: string,
  salesId: string,
  coopBatchId: string
): Promise<MinasulVendaDetalhe> {
  const res = await fetch(`${BASE_URL}/coffee/portal-demonstrative-details-ax`, {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ salesId, coopBatchId }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    throw parseMinasulError(res.status, bodyText, "Falha ao buscar detalhes Minasul");
  }

  const data = await res.json();
  return data as MinasulVendaDetalhe;
}
