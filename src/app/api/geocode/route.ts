import { NextResponse } from "next/server";
import { geocode } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const results = await geocode(q, 6);
  return NextResponse.json({ results });
}
