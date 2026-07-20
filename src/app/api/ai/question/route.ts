import { handleAiPost } from "@/lib/demo/request-guards";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleAiPost("question", request);
}
