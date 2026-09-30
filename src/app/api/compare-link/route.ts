import { NextRequest, NextResponse } from "next/server";
import { inspectCompareLink, InvalidCompareUrl } from "../../../lib/compare-link";

const MAX_BODY_BYTES = 4096;

async function readBody(request: NextRequest): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) return null;
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export async function POST(request: NextRequest) {
  const text = await readBody(request);
  if (text === null) {
    return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Envía un JSON con el campo url." }, { status: 400 });
  }
  try {
    const url = body && typeof body === "object" && "url" in body ? body.url : undefined;
    return NextResponse.json(await inspectCompareLink(url));
  } catch (error) {
    if (error instanceof InvalidCompareUrl) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "No fue posible procesar el enlace." }, { status: 502 });
  }
}
