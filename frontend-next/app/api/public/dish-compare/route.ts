import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import type { DishCompareResponse } from "@/lib/api/public";
import { getApiServerUrl } from "@/lib/config/env";
import { loadDishCompareFallback } from "@/lib/data/dishCompareFallback";

export async function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang") ?? "pl";
  const upstream = `${getApiServerUrl()}/api/public/dish-compare?lang=${encodeURIComponent(lang)}`;

  try {
    const res = await fetch(upstream, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = (await res.json()) as DishCompareResponse;
      return NextResponse.json(data);
    }
  } catch {
    // fall through to bundled demo data
  }

  return NextResponse.json(loadDishCompareFallback(lang));
}
