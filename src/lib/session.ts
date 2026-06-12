import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE, type SessionPayload, type Role } from "./auth";

// Liest die aktuelle Session aus dem Cookie (in Route-Handlern / Server-Komponenten).
export function getSession(): SessionPayload | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

export function requireRole(role: Role): SessionPayload | null {
  const s = getSession();
  if (!s || s.role !== role) return null;
  return s;
}
