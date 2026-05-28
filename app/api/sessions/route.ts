import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { MasterContext } from "@/types";

export const runtime = "nodejs";

// ─── GET /api/sessions — list user's sessions ─────────────────────────────────

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("sessions")
      .select("id, file_name, thumbnail_base64, master_context, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[GET /api/sessions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/sessions — create new session after pipeline ──────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { fileName, thumbnailBase64, masterContext, instrumentAnalyses, teachingSummary } = body;

    if (!fileName || !masterContext) {
      return NextResponse.json({ error: "Missing fileName or masterContext" }, { status: 400 });
    }

    // Strip sheetImage (full base64) before persisting — we only keep the thumbnail
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sheetImage: _dropped, ...contextToStore } = masterContext as MasterContext;

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id:              userId,
        file_name:            fileName,
        thumbnail_base64:     thumbnailBase64 ?? null,
        master_context:       contextToStore,
        instrument_analyses:  instrumentAnalyses ?? {},
        teaching_summary:     teachingSummary   ?? null,
        conversation_history: [],
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sessionId: data.id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/sessions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
