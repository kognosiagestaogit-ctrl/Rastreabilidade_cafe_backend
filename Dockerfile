# ==========================================
# Etapa 1: Builder
# ==========================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copiar os arquivos de dependência primeiro para aproveitar cache do Docker
COPY package.json bun.lock ./

# Instalar as dependências do projeto (não salvamos devDependencies na prod)
RUN bun install --frozen-lockfile --production

# Copiar os arquivos da aplicação
COPY src/ ./src/
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./
COPY tsconfig.json ./

# (Opcional) Caso o código precise ser "transpilado" pelo Bun, 
# podemos fazer isso na etapa builder. No nosso caso, o Bun roda TS nativamente.
# Mas rodar um check sintático é sempre bom:
# RUN bun --check src/index.ts

# ==========================================
# Etapa 2: Runner
# ==========================================
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Variáveis globais para garantir que frameworks rodem em modo de produção
ENV NODE_ENV=production

# Privilégios Mínimos: usar o usuário 'bun' ao invés do usuário 'root'
USER bun

# Copiar do estágio builder
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/src ./src
COPY --from=builder --chown=bun:bun /app/package.json ./

# Porta que a API vai rodar
EXPOSE 3001

# Comando de partida
CMD ["bun", "run", "src/index.ts"]
