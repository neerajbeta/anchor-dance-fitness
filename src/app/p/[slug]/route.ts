import { NextRequest, NextResponse } from "next/server";
import { PROMO_COOKIE, recordPromotionClick } from "@/lib/services";
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANDING: Record<string, string> = {
  workshops: "/book/workshops",
  class: "/book/class",
  studio: "/book/studio",
  home: "/",
};

/**
 * A promotion link (/p/summer-bollywood): counts the click, remembers the
 * promotion for 30 days so an enquiry or booking made afterwards is credited
 * to it, then sends the visitor to its page.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const params = await ctx.params;
  const origin = publicOrigin(req);
  try {
    const promo = await recordPromotionClick(params.slug);
    const today = new Date().toISOString().slice(0, 10);
    const live =
      promo && promo.active && (!promo.startDate || promo.startDate <= today) && (!promo.endDate || promo.endDate >= today);
    if (!promo) return NextResponse.redirect(new URL("/book/workshops", origin));

    const path = promo.eventId ? `/book/workshops#event-${promo.eventId}` : LANDING[promo.landing] ?? "/book/workshops";
    const res = NextResponse.redirect(new URL(path, origin));
    if (live) {
      res.cookies.set(PROMO_COOKIE, promo.id, {
        maxAge: 30 * 24 * 3600,
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: origin.startsWith("https"),
      });
    }
    return res;
  } catch (err) {
    console.error("[p/:slug]", err);
    return NextResponse.redirect(new URL("/book/workshops", origin));
  }
}
