/**
 * TCGCodex API Client - With USD Conversion
 */

const TCGCODEX_API_URL = "https://tcgcodex.com/api/v1";
const TCGCODEX_BASE_URL = "https://tcgcodex.com";
const API_KEY = process.env.NEXT_PUBLIC_TCGCODEX_API_KEY;

// EUR to USD conversion rate
const EUR_TO_USD = 1.1;

/**
 * Convert EUR to USD
 */
function convertToUSD(eurPrice: number): number {
  return eurPrice * EUR_TO_USD;
}

async function makeRequest(endpoint: string, params: Record<string, any> = {}) {
  if (!API_KEY) {
    throw new Error("TCGCODEX_API_KEY not configured");
  }

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value)) {
        value.forEach((v) => queryParams.append(key, String(v)));
      } else {
        queryParams.append(key, String(value));
      }
    }
  });

  const url = `${TCGCODEX_API_URL}${endpoint}${queryParams.toString() ? "?" + queryParams.toString() : ""}`;

  console.log("🌐 TCGCodex:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid API key");
    }
    if (response.status === 404) {
      return { data: [] };
    }
    throw new Error(`API error ${response.status}`);
  }

  return await response.json();
}

async function getCardPrices(cardId: string | number) {
  try {
    const response = await makeRequest(`/cards/${cardId}/prices`);
    return response;
  } catch (error) {
    return null;
  }
}

function normalizeCard(card: any) {
  const attrs = card.attributes || {};
  const imageUrl = attrs.image ? `${TCGCODEX_BASE_URL}/${attrs.image}` : null;

  return {
    id: card.id,
    name: attrs.name,
    setName: attrs.set?.name || "Unknown Set",
    number: attrs.number,
    rarity: attrs.rarity?.rarity,
    game: attrs.game?.name,
    imageUrl: imageUrl,
    variants: [
      {
        condition: "NM",
        printing: "Normal",
        price: 0,
        currency: "USD", // Always USD after conversion
        language: "English",
      },
    ],
  };
}

export async function searchCards(params: {
  q?: string;
  number?: string;
  game?: string;
  set?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const gameIdMap: Record<string, string> = {
      pokemon: "1",
      lorcana: "2",
      "disney-lorcana": "2",
      mtg: "3",
      "magic-the-gathering": "3",
      "pokemon-japan": "4",
      "one-piece-card-game": "5",
      onepiece: "5",
      "star-wars-unlimited": "6",
    };

    const apiParams: Record<string, any> = {};

    if (params.q) {
      apiParams.card_name = params.q;
    }

    if (params.number) {
      apiParams.card_number = params.number;
    }

    if (params.game) {
      const gameId = gameIdMap[params.game.toLowerCase()] || params.game;
      apiParams["game_id[]"] = [gameId];
    }

    if (params.set) {
      apiParams["set_id[]"] = [params.set];
    }

    console.log("🔍 Search params:", apiParams);

    const response = await makeRequest("/cards", apiParams);
    const cards = response.data || [];

    const normalized = cards.map((card: any) => normalizeCard(card));

    // Fetch prices for first 3 cards
    for (let i = 0; i < Math.min(3, normalized.length); i++) {
      try {
        const prices = await getCardPrices(normalized[i].id);
        if (prices && prices.data && prices.data.length > 0) {
          const firstPrice = prices.data.find((p: any) => p.attributes?.price);
          if (firstPrice) {
            const eurPrice = firstPrice.attributes.price;
            const usdPrice = convertToUSD(eurPrice); // Convert EUR to USD

            console.log(
              `💰 Price conversion: €${eurPrice} → $${usdPrice.toFixed(2)}`,
            );

            normalized[i].variants[0].price = usdPrice; // Store as USD
            normalized[i].variants[0].printing =
              firstPrice.attributes.variant || "Normal";
            normalized[i].variants[0].originalPrice = eurPrice; // Keep EUR for reference
            normalized[i].variants[0].originalCurrency = "EUR";
          }
        }
      } catch (error) {
        console.warn("Could not fetch price for card", normalized[i].id);
      }
    }

    return normalized;
  } catch (error: any) {
    console.error("Search error:", error);
    throw error;
  }
}

export async function getCardById(cardId: string) {
  try {
    const response = await makeRequest(`/cards/${cardId}`);
    const card = response.data || response;

    if (!card) {
      throw new Error("Card not found");
    }

    const normalized = normalizeCard(card);

    const prices = await getCardPrices(cardId);
    if (prices && prices.data && prices.data.length > 0) {
      const firstPrice = prices.data.find((p: any) => p.attributes?.price);
      if (firstPrice) {
        const eurPrice = firstPrice.attributes.price;
        const usdPrice = convertToUSD(eurPrice);
        normalized.variants[0].price = usdPrice;
      }
    }

    return normalized;
  } catch (error: any) {
    console.error("Get card error:", error);
    throw error;
  }
}

export async function getCardVariant(params: {
  cardId?: string;
  condition?: string;
  printing?: string;
}) {
  try {
    const card = await getCardById(params.cardId!);
    return {
      ...card,
      price: card.variants[0].price,
      selectedVariant: card.variants[0],
    };
  } catch (error: any) {
    console.error("Get variant error:", error);
    throw error;
  }
}

export async function getGames() {
  try {
    const response = await makeRequest("/games");
    const games = response.data || [];
    return games.map((game: any) => ({
      id: game.id,
      name: game.attributes?.name || game.name,
      slug: game.attributes?.slug || game.slug,
    }));
  } catch (error: any) {
    console.error("Get games error:", error);
    return [];
  }
}

export async function getSets(game: string) {
  try {
    const gameIdMap: Record<string, string> = {
      pokemon: "1",
      lorcana: "2",
      mtg: "3",
      "one-piece-card-game": "5",
    };

    const gameId = gameIdMap[game] || game;

    const response = await makeRequest("/sets", { "game_id[]": [gameId] });
    const sets = response.data || [];
    return sets.map((set: any) => ({
      id: set.id,
      name: set.attributes?.name || set.name,
      slug: set.attributes?.slug || set.slug,
    }));
  } catch (error: any) {
    console.error("Get sets error:", error);
    return [];
  }
}

export async function testConnection() {
  try {
    const response = await makeRequest("/games");

    if (response && (response.data || response)) {
      return {
        success: true,
        provider: "TCGCodex",
      };
    }

    throw new Error("No data returned");
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
