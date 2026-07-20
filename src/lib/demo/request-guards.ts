import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import {
  AI_MAX_REQUEST_BYTES,
  type AiInterviewContextV1,
} from "@/lib/ai/contracts";
import {
  createMedGemmaProvider,
  type MedGemmaProvider,
} from "@/lib/ai/provider";
import {
  AiContractError,
  parseAiInterviewContextV1,
} from "@/lib/ai/validators";

import {
  createAiRequestIdentity,
  resolveAnonymousSession,
  resolveTrustedProxyIp,
  serializeDemoSessionCookie,
} from "./anonymous-session";
import { findDirectIdentifier } from "./direct-identifier";

export type AiPostKind = "question" | "summary";

type CookieStore = {
  get(name: string): { value: string } | undefined;
};

export type AiPostDependencies = {
  provider: MedGemmaProvider;
  allowedOrigin: string;
  hmacSecret: string;
  maxRequestBytes: number;
  isProduction: boolean;
  randomUUID: () => string;
  getCookieStore: () => Promise<CookieStore>;
};

function jsonResponse(value: unknown, status: number): Response {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(code: string, status: number): Response {
  return jsonResponse({ error: { code } }, status);
}

function hasDirectIdentifier(context: AiInterviewContextV1): boolean {
  const values = [
    ...Object.values(context.filledSlots),
    ...context.recentTurns.map((turn) => turn.answer),
  ];
  return values.some(
    (value) => value !== undefined && findDirectIdentifier(value) !== undefined,
  );
}

function readMaximumBytes(value: string | undefined): number {
  const maximum = Number(value ?? String(AI_MAX_REQUEST_BYTES));
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > AI_MAX_REQUEST_BYTES) {
    throw new Error("invalid-max-request-bytes");
  }
  return maximum;
}

async function createDefaultDependencies(): Promise<AiPostDependencies> {
  const allowedOrigin = process.env.DEMO_ALLOWED_ORIGIN?.trim();
  const hmacSecret = process.env.DEMO_HMAC_SECRET ?? "";
  if (!allowedOrigin) throw new Error("invalid-demo-config");
  new URL(allowedOrigin);

  return {
    provider: createMedGemmaProvider(),
    allowedOrigin,
    hmacSecret,
    maxRequestBytes: readMaximumBytes(process.env.MEDGEMMA_MAX_REQUEST_BYTES),
    isProduction: process.env.NODE_ENV === "production",
    randomUUID,
    getCookieStore: cookies,
  };
}

export async function handleAiPost(
  kind: AiPostKind,
  request: Request,
  dependencies?: AiPostDependencies,
): Promise<Response> {
  let config: AiPostDependencies;
  try {
    config = dependencies ?? (await createDefaultDependencies());
    if (new TextEncoder().encode(config.hmacSecret).byteLength < 32) {
      throw new Error("invalid-demo-config");
    }
  } catch {
    return errorResponse("service-unavailable", 503);
  }

  if (request.method !== "POST") return errorResponse("method-not-allowed", 405);
  if (request.headers.get("origin") !== config.allowedOrigin) {
    return errorResponse("origin-forbidden", 403);
  }
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") {
    return errorResponse("invalid-request", 400);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse("invalid-request", 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > config.maxRequestBytes) {
    return errorResponse("request-too-large", 413);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return errorResponse("invalid-request", 400);
  }

  let context: AiInterviewContextV1;
  try {
    context = parseAiInterviewContextV1(parsedBody);
  } catch (error) {
    if (error instanceof AiContractError && error.code === "request-too-large") {
      return errorResponse("request-too-large", 413);
    }
    return errorResponse("invalid-request", 400);
  }
  if (hasDirectIdentifier(context)) {
    return errorResponse("direct-identifier", 400);
  }

  const ip = resolveTrustedProxyIp(request, config.allowedOrigin);
  if (!ip) return errorResponse("invalid-request", 400);

  let cookieStore: CookieStore;
  try {
    cookieStore = await config.getCookieStore();
  } catch {
    return errorResponse("service-unavailable", 503);
  }
  const session = resolveAnonymousSession(cookieStore, config.randomUUID);
  const identity = createAiRequestIdentity(
    session.id,
    ip,
    config.hmacSecret,
  );

  try {
    const value =
      kind === "question"
        ? await config.provider.requestQuestion(context, request.signal, identity)
        : await config.provider.requestSummary(context, request.signal, identity);
    const response = jsonResponse(value, 200);
    if (session.isNew) {
      response.headers.set(
        "Set-Cookie",
        serializeDemoSessionCookie(session.id, config.isProduction),
      );
    }
    return response;
  } catch {
    return errorResponse("ai-unavailable", 502);
  }
}
