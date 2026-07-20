import "server-only";

import { createHmac, randomUUID as createRandomUUID } from "node:crypto";
import { isIP } from "node:net";

import type { AiRequestIdentity } from "@/lib/ai/provider";

export const DEMO_SESSION_COOKIE = "eum_demo_session";
export const DEMO_SESSION_MAX_AGE = 86_400;

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveAnonymousSession(
  cookieStore: CookieReader,
  randomUUID: () => string = createRandomUUID,
): { id: string; isNew: boolean } {
  const existing = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  if (existing && UUID_PATTERN.test(existing)) {
    return { id: existing, isNew: false };
  }
  return { id: randomUUID(), isNew: true };
}

export function resolveTrustedProxyIp(
  request: Request,
  allowedOrigin: string,
): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const candidate = forwarded.split(",").at(-1)?.trim();
    return candidate && isIP(candidate) ? candidate : undefined;
  }

  const hostname = new URL(allowedOrigin).hostname;
  if (hostname === "127.0.0.1" || hostname === "localhost") {
    return "127.0.0.1";
  }
  return undefined;
}

function hmac(value: string, namespace: "session" | "ip", secret: string) {
  return createHmac("sha256", secret)
    .update(`${namespace}:${value}`)
    .digest("hex");
}

export function createAiRequestIdentity(
  sessionId: string,
  ip: string,
  secret: string,
): AiRequestIdentity {
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("invalid-demo-hmac-secret");
  }
  return {
    sessionHash: hmac(sessionId, "session", secret),
    ipHash: hmac(ip, "ip", secret),
  };
}

export function serializeDemoSessionCookie(
  sessionId: string,
  secure: boolean,
): string {
  return [
    `${DEMO_SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    `Max-Age=${DEMO_SESSION_MAX_AGE}`,
    "HttpOnly",
    secure ? "Secure" : undefined,
    "SameSite=Lax",
  ]
    .filter(Boolean)
    .join("; ");
}
