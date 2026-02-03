import { NextRequest, NextResponse } from "next/server";

// CardTrader API Base URL
const CARDTRADER_API_URL = "https://api.cardtrader.com/api/v2";
const CARDTRADER_TOKEN = process.env.CARDTRADER_API_TOKEN;

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

// Game ID mapping for CardTrader
const GAME_IDS: Record<string, string> = {
  magic: "1",
  mtg: "1",
  pokemon: "3",
  yugioh: "2",
  "yu-gi-oh": "2",
  "one piece": "6",
  onepiece: "6",
  "flesh and blood": "7",
  fab: "7",
};

function getGameId(game: string): string | null {
  const normalized = game.toLowerCase().trim();
  return GAME_IDS[normalized] || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, query, game, blueprintId, expansionId, limit = 10 } = body;

    if (!CARDTRADER_TOKEN) {
      return NextResponse.json(
        {
          error:
            "CardTrader API token not configured. Add CARDTRADER_API_TOKEN to your .env file.",
        },
        { status: 500 },
      );
    }

    await rateLimit();

    const headers = {
      Authorization: `Bearer ${CARDTRADER_TOKEN}`,
      "Content-Type": "application/json",
    };

    switch (action) {
      case "search": {
        // Search for cards by name
        const params = new URLSearchParams();

        if (query) params.append("name", query);
        if (game) {
          const gameId = getGameId(game);
          if (gameId) params.append("game_id", gameId);
        }

        const url = `${CARDTRADER_API_URL}/blueprints/export?${params}`;
        console.log(`🔍 CardTrader Search: ${url}`);

        const response = await fetch(url, { headers });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `❌ CardTrader API error: ${response.status}`,
            errorText,
          );
          return NextResponse.json(
            { error: `CardTrader API error: ${response.status}`, results: [] },
            { status: response.status },
          );
        }

        const data = await response.json();

        console.log(`✅ CardTrader found ${data.length || 0} results`);

        // Transform to standard format
        const results = (data || []).slice(0, limit).map((card: any) => ({
          id: card.id,
          name: card.name,
          set_name: card.expansion?.name || "",
          expansion_code: card.expansion?.code || "",
          game: card.game?.name || "",
          image: card.image_url || "",
          market_price: parseFloat(card.market_price) || 0,
          number: card.number || "",
          rarity: card.rarity || "",
          category: card.category_name || "",

          // Variants with price
          variants: [
            {
              name: "Market Price",
              price: parseFloat(card.market_price) || 0,
            },
          ],

          // CardTrader specific
          cardtrader_id: card.id,
          blueprint_id: card.id,

          // Raw data for debugging
          raw: card,
        }));

        return NextResponse.json({ results, count: data.length });
      }

      case "blueprint": {
        // Get specific blueprint by ID
        if (!blueprintId) {
          return NextResponse.json(
            { error: "blueprintId required" },
            { status: 400 },
          );
        }

        const url = `${CARDTRADER_API_URL}/blueprints/${blueprintId}`;
        console.log(`🔍 CardTrader Blueprint: ${url}`);

        const response = await fetch(url, { headers });

        if (!response.ok) {
          return NextResponse.json(
            { error: `CardTrader API error: ${response.status}` },
            { status: response.status },
          );
        }

        const blueprint = await response.json();

        return NextResponse.json({
          blueprint: {
            id: blueprint.id,
            name: blueprint.name,
            set_name: blueprint.expansion?.name,
            game: blueprint.game?.name,
            market_price: parseFloat(blueprint.market_price) || 0,
            image: blueprint.image_url,
            number: blueprint.number,
            rarity: blueprint.rarity,
            raw: blueprint,
          },
        });
      }

      case "marketplace": {
        // Get marketplace listings for a blueprint
        if (!blueprintId) {
          return NextResponse.json(
            { error: "blueprintId required" },
            { status: 400 },
          );
        }

        const url = `${CARDTRADER_API_URL}/marketplace/products?blueprint_id=${blueprintId}`;
        console.log(`🔍 CardTrader Marketplace: ${url}`);

        const response = await fetch(url, { headers });

        if (!response.ok) {
          return NextResponse.json(
            { error: `CardTrader API error: ${response.status}` },
            { status: response.status },
          );
        }

        const products = await response.json();

        return NextResponse.json({
          products: products.map((p: any) => ({
            id: p.id,
            price: parseFloat(p.price?.cents || 0) / 100,
            condition: p.properties_hash?.condition,
            language: p.properties_hash?.language,
            signed: p.properties_hash?.signed,
            altered: p.properties_hash?.altered,
            seller: p.user?.username,
            quantity: p.quantity,
          })),
        });
      }

      case "expansions": {
        // List all expansions for a game
        const params = new URLSearchParams();

        if (game) {
          const gameId = getGameId(game);
          if (gameId) params.append("game_id", gameId);
        }

        const url = `${CARDTRADER_API_URL}/expansions?${params}`;
        console.log(`🔍 CardTrader Expansions: ${url}`);

        const response = await fetch(url, { headers });

        if (!response.ok) {
          return NextResponse.json(
            { error: `CardTrader API error: ${response.status}` },
            { status: response.status },
          );
        }

        const expansions = await response.json();

        return NextResponse.json({
          expansions: expansions.map((exp: any) => ({
            id: exp.id,
            name: exp.name,
            code: exp.code,
            game: exp.game?.name,
            released_at: exp.released_at,
          })),
        });
      }

      case "games": {
        // List all supported games
        const url = `${CARDTRADER_API_URL}/games`;
        console.log(`🔍 CardTrader Games: ${url}`);

        const response = await fetch(url, { headers });

        if (!response.ok) {
          return NextResponse.json(
            { error: `CardTrader API error: ${response.status}` },
            { status: response.status },
          );
        }

        const games = await response.json();

        return NextResponse.json({
          games: games.map((g: any) => ({
            id: g.id,
            name: g.name,
            display_name: g.display_name,
          })),
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}. Supported: search, blueprint, marketplace, expansions, games`,
          },
          { status: 400 },
        );
    }
  } catch (error: any) {
    console.error("❌ CardTrader API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint
  return NextResponse.json({
    service: "CardTrader API",
    status: "ok",
    configured: !!CARDTRADER_TOKEN,
    base_url: CARDTRADER_API_URL,
    documentation: "https://www.cardtrader.com/api",
    supported_actions: {
      search: {
        description: "Search for cards by name",
        params: { action: "search", query: "card name", game: "pokemon" },
      },
      blueprint: {
        description: "Get card details by ID",
        params: { action: "blueprint", blueprintId: "12345" },
      },
      marketplace: {
        description: "Get marketplace listings for a card",
        params: { action: "marketplace", blueprintId: "12345" },
      },
      expansions: {
        description: "List expansions/sets for a game",
        params: { action: "expansions", game: "pokemon" },
      },
      games: {
        description: "List all supported games",
        params: { action: "games" },
      },
    },
    supported_games: GAME_IDS,
  });
}
