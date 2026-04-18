import { NextRequest } from "next/server";
import { auth } from "@/auth";

const CENTRAL_RELAY_URL = process.env.CENTRAL_RELAY_URL ?? "http://localhost:4000";
const RELAY_API_KEY = process.env.RELAY_API_KEY ?? "";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  try {
    const res = await fetch(`${CENTRAL_RELAY_URL}/api/command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(RELAY_API_KEY ? { "x-api-key": RELAY_API_KEY } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Relay unreachable";
    return Response.json({ ok: false, error: message }, { status: 503 });
  }
}
