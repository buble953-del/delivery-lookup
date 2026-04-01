import "server-only";
import crypto from "crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export function hashProtectedPassword(password: string) {
  const salt = crypto.randomBytes(SALT_LENGTH).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");

  return `${salt}:${hash}`;
}

export function verifyProtectedPassword(
  password: string,
  storedHash: string | null | undefined
) {
  if (!storedHash) return false;

  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) return false;

  const hashBuffer = crypto.scryptSync(password, salt, KEY_LENGTH);
  const originalHashBuffer = Buffer.from(originalHash, "hex");

  if (hashBuffer.length !== originalHashBuffer.length) return false;

  return crypto.timingSafeEqual(hashBuffer, originalHashBuffer);
}