import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const HASH_PREFIX = "scrypt";

const deriveKey = (plainTextPassword: string, salt: string) =>
  scryptSync(plainTextPassword, salt, KEY_LENGTH).toString("hex");

export const hashPassword = (plainTextPassword: string) => {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = deriveKey(plainTextPassword, salt);
  return `${HASH_PREFIX}$${salt}$${derivedKey}`;
};

export const verifyPassword = (plainTextPassword: string, storedHash: string) => {
  const [prefix, salt, keyHex] = storedHash.split("$");
  if (prefix !== HASH_PREFIX || !salt || !keyHex) {
    return false;
  }

  const computedHex = deriveKey(plainTextPassword, salt);
  const a = Buffer.from(computedHex, "hex");
  const b = Buffer.from(keyHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};
