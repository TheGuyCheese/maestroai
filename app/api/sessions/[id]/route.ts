import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

// ─── GET /api/sessions/[id] — load a full session for resuming ────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", userId) // ensures users can only access their own sessions
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/sessions/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
