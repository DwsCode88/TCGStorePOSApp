import { NextRequest, NextResponse } from "next/server";

const TCGCODEX_API_URL = "https://tcgcodex.com/api/v1";
const TCGCODEX_API_KEY = process.env.TCGCODEX_API_KEY; // Server-side only

export async function POST(request: NextRequest) {
  if (!TCGCODEX_API_KEY) {
    return NextResponse.json(
      { error: "TCGCodex API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { action, cardName, cardNumber, cardId } = body;

    if (action === "search") {
      // Search for card
      const params = new URLSearchParams();
      if (cardName) params.append("card_name", cardName);
      if (cardNumber) params.append("card_number", cardNumber);
      params.append("game_id[]", "1"); // Pokemon

      const url = `${TCGCODEX_API_URL}/cards?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${TCGCODEX_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return NextResponse.json({ data: [] });
        }
        return NextResponse.json(
          { error: `TCGCodex API error: ${response.status}` },
          { status: response.status },
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    if (action === "prices") {
      // Get card prices
      if (!cardId) {
        return NextResponse.json(
          { error: "cardId required for prices" },
          { status: 400 },
        );
      }

      const url = `${TCGCODEX_API_URL}/cards/${cardId}/prices`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${TCGCODEX_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return NextResponse.json({ data: [] });
        }
        return NextResponse.json(
          { error: `TCGCodex API error: ${response.status}` },
          { status: response.status },
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "search" or "prices"' },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("TCGCodex proxy error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
