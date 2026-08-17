import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Criptografia AES-256-GCM para senhas de integrações.
 *
 * Diferente de hash (bcrypt), usa criptografia simétrica reversível
 * porque precisamos recuperar a senha original para fazer login
 * em APIs de terceiros (ex: Minasul).
 *
 * Formato armazenado: "iv:authTag:ciphertext" (tudo em hex)
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

import { env } from "../config/env";

function getEncryptionKey(): Buffer {
  const key = env.ENCRYPTION_KEY;
  // A chave deve ter exatamente 32 bytes (64 caracteres hex)
  return Buffer.from(key, "hex");
}

/**
 * Criptografa uma string (ex: senha em texto puro).
 * @returns string no formato "iv:authTag:ciphertext" (hex)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Descriptografa uma string criptografada com encrypt().
 * @param ciphertext string no formato "iv:authTag:encrypted" (hex)
 * @returns texto original
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Formato de texto criptografado inválido");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
