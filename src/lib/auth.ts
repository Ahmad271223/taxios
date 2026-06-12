import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export type Role = "ADMIN" | "DRIVER";

export interface SessionPayload {
  sub: string; // user id (Driver-ID bzw. Company-ID)
  role: Role;
  name: string;
  username: string;
  companyId: string; // Mandant
  companySlug?: string;
}

export const SESSION_COOKIE = "tc_session";

function secret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret-bitte-aendern";
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: "7d" });
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, secret()) as SessionPayload;
  } catch {
    return null;
  }
}
