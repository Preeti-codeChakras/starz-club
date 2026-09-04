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

/*
 * =========================================================
 * GET
 *
 * Public-safe kit data loader.
 *
 * The caller must provide either:
 *
 *   /api/kits/handoff?kit=<KIT_ID>
 *
 * OR
 *
 *   /api/kits/handoff?club=<CLUB_SLUG>
 *
 * We first resolve ONE club and then return only:
 *   - that club
 *   - that club's kits
 *   - that club's members
 *
 * We intentionally do NOT return handoff history here.
 * Logged-in users can continue loading history through
 * normal authenticated Supabase/RLS access.
 * =========================================================
 */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const kitId =
      url.searchParams.get("kit");

    const clubSlug =
      url.searchParams.get("club");

    let clubId: string | null = null;

    /*
     * -----------------------------------------------------
     * OPTION 1
     * Resolve club from a specific kit QR code
     * -----------------------------------------------------
     */

    if (kitId) {
      const {
        data: requestedKit,
        error: requestedKitError,
      } = await supabaseAdmin
        .from("club_kits")
        .select("id, club_id")
        .eq("id", kitId)
        .maybeSingle();

      if (requestedKitError) {
        console.error(
          "Unable to resolve kit club:",
          requestedKitError
        );

        return NextResponse.json(
          {
            error:
              "Unable to load this kit.",
          },
          { status: 500 }
        );
      }

      if (!requestedKit) {
        return NextResponse.json(
          {
            error:
              "Kit not found.",
          },
          { status: 404 }
        );
      }

      clubId =
        requestedKit.club_id;
    }

    /*
     * -----------------------------------------------------
     * OPTION 2
     * Resolve club from club slug
     * Example: /kit?club=starz
     * -----------------------------------------------------
     */

    if (!clubId && clubSlug) {
      const {
        data: club,
        error: clubLookupError,
      } = await supabaseAdmin
        .from("clubs")
        .select("id")
        .eq("slug", clubSlug)
        .maybeSingle();

      if (clubLookupError) {
        console.error(
          "Unable to resolve club:",
          clubLookupError
        );

        return NextResponse.json(
          {
            error:
              "Unable to load this club.",
          },
          { status: 500 }
        );
      }

      if (!club) {
        return NextResponse.json(
          {
            error:
              "Club not found.",
          },
          { status: 404 }
        );
      }

      clubId = club.id;
    }

    /*
     * We never allow a completely unscoped public query.
     */

    if (!clubId) {
      return NextResponse.json(
        {
          error:
            "A kit or club is required.",
        },
        { status: 400 }
      );
    }

    /*
     * -----------------------------------------------------
     * Load club branding/basic identity
     * -----------------------------------------------------
     */

    const {
      data: club,
      error: clubError,
    } = await supabaseAdmin
      .from("clubs")
      .select(
        `
        id,
        name,
        slug,
        logo_url
        `
      )
      .eq("id", clubId)
      .maybeSingle();

    if (clubError) {
      console.error(
        "Unable to load club:",
        clubError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load club information.",
        },
        { status: 500 }
      );
    }

    if (!club) {
      return NextResponse.json(
        {
          error:
            "Club not found.",
        },
        { status: 404 }
      );
    }

    /*
     * -----------------------------------------------------
     * Load ONLY this club's kits
     * -----------------------------------------------------
     */

    const {
      data: kits,
      error: kitsError,
    } = await supabaseAdmin
      .from("club_kits")
      .select(
        `
        id,
        name,
        updated_at,
        current_holder_member_id,

        current_holder:members (
          id,
          name
        )
        `
      )
      .eq("club_id", clubId)
      .order("name");

    if (kitsError) {
      console.error(
        "Unable to load club kits:",
        kitsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load club kits.",
        },
        { status: 500 }
      );
    }

    /*
     * -----------------------------------------------------
     * Load ONLY this club's members
     *
     * We only expose id + name because that is all the
     * handoff form needs.
     * -----------------------------------------------------
     */

    const {
      data: members,
      error: membersError,
    } = await supabaseAdmin
      .from("members")
      .select("id, name")
      .eq("club_id", clubId)
      .order("name");

    if (membersError) {
      console.error(
        "Unable to load club members:",
        membersError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load club members.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      club,
      kits: kits ?? [],
      members: members ?? [],
    });
  } catch (error) {
    console.error(
      "Kit data API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load kit information.",
      },
      { status: 500 }
    );
  }
}

/*
 * =========================================================
 * POST
 *
 * Record a kit handoff.
 * =========================================================
 */

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

    /*
     * -----------------------------------------------------
     * Find the kit AND its club.
     * -----------------------------------------------------
     */

    const {
      data: kit,
      error: kitLookupError,
    } = await supabaseAdmin
      .from("club_kits")
      .select(
        `
        id,
        name,
        club_id,
        current_holder_member_id
        `
      )
      .eq("id", kitId)
      .maybeSingle();

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

    /*
     * -----------------------------------------------------
     * Verify receiving member belongs to SAME CLUB.
     *
     * This is important for the global multi-club version.
     * -----------------------------------------------------
     */

    const {
      data: member,
      error: memberLookupError,
    } = await supabaseAdmin
      .from("members")
      .select(
        `
        id,
        name,
        club_id
        `
      )
      .eq("id", memberId)
      .eq("club_id", kit.club_id)
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
            "Please choose a registered member of this club.",
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

    /*
     * -----------------------------------------------------
     * Save handoff history.
     *
     * We explicitly include club_id as an additional safety
     * measure even though your trigger can derive it from
     * kit_id.
     * -----------------------------------------------------
     */

    const {
      error: handoffError,
    } = await supabaseAdmin
      .from("kit_handoffs")
      .insert({
        kit_id: kit.id,

        club_id: kit.club_id,

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

    /*
     * -----------------------------------------------------
     * Update current holder.
     *
     * Also scope update to the kit's club.
     * -----------------------------------------------------
     */

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
      .eq("id", kit.id)
      .eq("club_id", kit.club_id);

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
