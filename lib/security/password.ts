import { createHash, timingSafeEqual } from "node:crypto";

const hash = (input: string): Buffer => createHash("sha256").update(input).digest();

export const hashPassword = (plainTextPassword: string) => hash(plainTextPassword).toString("hex");

export const verifyPassword = (plainTextPassword: string, storedHash: string) => {
  const a = hash(plainTextPassword);
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};
