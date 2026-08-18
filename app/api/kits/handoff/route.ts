import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      kitId,
      memberId,
      note,
    }: {
      kitId?: string;
      memberId?: string;
      note?: string;
    } = body;

    if (!kitId || !memberId) {
      return NextResponse.json(
        {
          error:
            "Kit and receiving member are required.",
        },
        { status: 400 }
      );
    }

    // Find the kit
    const {
      data: kit,
      error: kitLookupError,
    } = await supabaseAdmin
      .from("club_kits")
      .select(
        "id, name, current_holder_member_id"
      )
      .eq("id", kitId)
      .maybeSingle();

    // Show the real Supabase error instead of hiding it as 404
    if (kitLookupError) {
      console.error(
        "Kit lookup error:",
        kitLookupError
      );

      return NextResponse.json(
        {
          error:
            `Kit lookup failed: ${kitLookupError.message}`,
        },
        { status: 500 }
      );
    }

    if (!kit) {
      return NextResponse.json(
        {
          error:
            `Kit not found for ID: ${kitId}`,
        },
        { status: 404 }
      );
    }

    // Verify the receiving person is an existing club member
    const {
      data: member,
      error: memberLookupError,
    } = await supabaseAdmin
      .from("members")
      .select("id, name")
      .eq("id", memberId)
      .maybeSingle();

    if (memberLookupError) {
      console.error(
        "Member lookup error:",
        memberLookupError
      );

      return NextResponse.json(
        {
          error:
            `Member lookup failed: ${memberLookupError.message}`,
        },
        { status: 500 }
      );
    }

    if (!member) {
      return NextResponse.json(
        {
          error:
            "Please choose a registered Starz Club member.",
        },
        { status: 400 }
      );
    }

    if (
      kit.current_holder_member_id ===
      memberId
    ) {
      return NextResponse.json(
        {
          error:
            `${member.name} already has this kit.`,
        },
        { status: 400 }
      );
    }

    // Save the handoff history
    const {
      error: handoffError,
    } = await supabaseAdmin
      .from("kit_handoffs")
      .insert({
        kit_id: kit.id,

        from_member_id:
          kit.current_holder_member_id,

        to_member_id:
          member.id,

        handoff_type: null,

        note:
          note?.trim() || null,
      });

    if (handoffError) {
      console.error(
        "Unable to save handoff:",
        handoffError
      );

      return NextResponse.json(
        {
          error:
            `Unable to record the kit handoff: ${handoffError.message}`,
        },
        { status: 500 }
      );
    }

    // Update the kit's current holder
    const {
      error: updateError,
    } = await supabaseAdmin
      .from("club_kits")
      .update({
        current_holder_member_id:
          member.id,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", kit.id);

    if (updateError) {
      console.error(
        "Unable to update kit holder:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            `Handoff was recorded, but the current holder could not be updated: ${updateError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        `${kit.name} handed to ${member.name}.`,
    });
  } catch (error) {
    console.error(
      "Kit handoff API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while updating the kit.",
      },
      { status: 500 }
    );
  }
}
