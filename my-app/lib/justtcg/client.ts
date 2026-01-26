/**
 * JustTCG API Client
 * Direct implementation using fetch - no SDK needed
 */

const JUSTTCG_API_URL = "https://api.justtcg.com/v1";
const API_KEY = process.env.NEXT_PUBLIC_JUSTTCG_API_KEY;

/**
 * Make authenticated request to JustTCG API
 */
async function makeRequest(endpoint: string, params: Record<string, any> = {}) {
  if (!API_KEY) {
    throw new Error("JUSTTCG_API_KEY not configured. Add it to .env.local");
  }

  // Build query string
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.append(key, String(value));
    }
  });

  const url = `${JUSTTCG_API_URL}${endpoint}${queryParams.toString() ? "?" + queryParams.toString() : ""}`;

  console.log("🌐 JustTCG API Request:", endpoint, params);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log("📡 Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error:", response.status, errorText);

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Invalid API key. Check your NEXT_PUBLIC_JUSTTCG_API_KEY in .env.local",
        );
      }

      if (response.status === 429) {
        throw new Error(
          "Rate limit exceeded. Upgrade your plan at justtcg.com",
        );
      }

      if (response.status === 404) {
        return { data: [], _metadata: {} };
      }

      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("✅ Success:", data.data?.length || 0, "items returned");

    return data;
  } catch (error: any) {
    if (error.message?.includes("fetch")) {
      throw new Error("Network error. Check your internet connection.");
    }
    throw error;
  }
}

/**
 * Search for cards
 */
export async function searchCards(params: {
  q?: string;
  game?: string;
  set?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const response = await makeRequest("/cards", {
      q: params.q,
      game: params.game,
      set: params.set,
      limit: params.limit || 20,
      offset: params.offset || 0,
    });

    return response.data || [];
  } catch (error: any) {
    console.error("Search error:", error);
    throw error;
  }
}

/**
 * Get card by ID with variants
 */
export async function getCardById(cardId: string) {
  try {
    const response = await makeRequest("/cards", { cardId });

    if (!response.data || response.data.length === 0) {
      throw new Error("Card not found");
    }

    return response.data[0];
  } catch (error: any) {
    console.error("Get card error:", error);
    throw error;
  }
}

/**
 * Get specific variant pricing
 */
export async function getCardVariant(params: {
  cardId?: string;
  variantId?: string;
  tcgPlayerId?: string;
  condition?: string;
  printing?: string;
  language?: string;
}) {
  try {
    console.log("💰 Getting pricing:", params);

    const response = await makeRequest("/cards", {
      cardId: params.cardId,
      variantId: params.variantId,
      tcgPlayerId: params.tcgPlayerId,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("Card not found");
    }

    const card = response.data[0];

    // Find matching variant
    let variant = card.variants?.find((v: any) => {
      if (params.variantId) return v.id === params.variantId;

      let match = true;
      if (params.condition && v.condition !== params.condition) match = false;
      if (params.printing && v.printing !== params.printing) match = false;
      if (params.language && v.language !== params.language) match = false;
      return match;
    });

    // Use first variant if no exact match
    if (!variant && card.variants?.length > 0) {
      console.warn("⚠️  Using first available variant");
      variant = card.variants[0];
    }

    console.log("✅ Price:", variant?.price || 0);

    return {
      ...card,
      price: variant?.price || 0,
      selectedVariant: variant,
    };
  } catch (error: any) {
    console.error("Get variant error:", error);
    throw error;
  }
}

/**
 * Get all games
 */
export async function getGames() {
  try {
    const response = await makeRequest("/games");
    return response.data || [];
  } catch (error: any) {
    console.error("Get games error:", error);
    return [];
  }
}

/**
 * Get sets for a game
 */
export async function getSets(game: string, limit?: number) {
  try {
    const response = await makeRequest("/sets", {
      game,
      limit: limit || 100,
    });
    return response.data || [];
  } catch (error: any) {
    console.error("Get sets error:", error);
    return [];
  }
}

/**
 * Test API connection
 */
export async function testConnection() {
  try {
    console.log("🔌 Testing connection...");

    const response = await makeRequest("/games");

    if (response.data && response.data.length > 0) {
      console.log("✅ Connection successful!");
      return {
        success: true,
        gamesCount: response.data.length,
        metadata: response._metadata,
      };
    }

    throw new Error("No data returned");
  } catch (error: any) {
    console.error("❌ Connection failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Batch lookup
 */
export async function batchLookup(
  items: Array<{
    cardId?: string;
    variantId?: string;
    condition?: string;
    printing?: string;
  }>,
) {
  try {
    console.log("📦 Batch lookup:", items.length, "items");

    const results = await Promise.all(
      items.map((item) =>
        getCardVariant(item).catch((err) => {
          console.warn("Failed:", item, err.message);
          return null;
        }),
      ),
    );

    const successful = results.filter((r) => r !== null);
    console.log(`✅ ${successful.length}/${items.length} successful`);

    return successful;
  } catch (error: any) {
    throw new Error(`Batch lookup failed: ${error.message}`);
  }
}
