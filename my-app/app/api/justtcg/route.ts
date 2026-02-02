import { NextRequest, NextResponse } from "next/server";

const JUSTTCG_API_URL = "https://api.justtcg.com/v1";
const JUSTTCG_API_KEY = process.env.JUSTTCG_API_KEY; // Server-side only

export async function POST(request: NextRequest) {
  if (!JUSTTCG_API_KEY) {
    return NextResponse.json(
      { error: "JustTCG API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { action, cardName, cardNumber, cardId } = body;

    if (action === "search") {
      // Search for card
      const params = new URLSearchParams();

      // Build search query
      if (cardName && cardNumber) {
        // Search by name and number
        params.append("q", `${cardName} ${cardNumber}`);
      } else if (cardName) {
        // Search by name only
        params.append("q", cardName);
      }

      params.append("game", "pokemon"); // Default to Pokemon
      params.append("limit", "10");

      const url = `${JUSTTCG_API_URL}/cards/search?${params.toString()}`;

      console.log("🔍 JustTCG Search:", url);

      const response = await fetch(url, {
        headers: {
          "x-api-key": JUSTTCG_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return NextResponse.json({ data: [] });
        }
        const errorText = await response.text();
        console.error("JustTCG API error:", response.status, errorText);
        return NextResponse.json(
          { error: `JustTCG API error: ${response.status}` },
          { status: response.status },
        );
      }

      const data = await response.json();
      console.log(`✅ Found ${data.data?.length || 0} results`);
      return NextResponse.json(data);
    }

    if (action === "variant") {
      // Get card variant/pricing
      if (!cardId) {
        return NextResponse.json(
          { error: "cardId required for variant" },
          { status: 400 },
        );
      }

      // Add game filter as required by JustTCG
      const url = `${JUSTTCG_API_URL}/cards/${cardId}/variant?game=pokemon`;

      console.log("💵 JustTCG Variant Request:", url);

      const response = await fetch(url, {
        headers: {
          "x-api-key": JUSTTCG_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      console.log(`💵 JustTCG Variant Response:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("JustTCG Variant API error:", response.status, errorText);
        if (response.status === 404) {
          return NextResponse.json({ data: null });
        }
        return NextResponse.json(
          { error: `JustTCG API error: ${response.status}` },
          { status: response.status },
        );
      }

      const data = await response.json();
      console.log(
        "💵 FULL JustTCG Variant Response:",
        JSON.stringify(data, null, 2),
      );
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "search" or "variant"' },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("JustTCG proxy error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
