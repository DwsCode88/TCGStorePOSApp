/**
 * Unified Card API Adapter
 * Switches between JustTCG and TCGCodex
 */

import * as JustTCG from "./justtcg/client";
import * as TCGCodex from "./tcgcodex/client";

export type APIProvider = "justtcg" | "tcgcodex";

// Store current provider (can be changed at runtime)
let currentProvider: APIProvider = "justtcg";

/**
 * Set the active API provider
 */
export function setAPIProvider(provider: APIProvider) {
  console.log("🔄 Switching API provider to:", provider);
  currentProvider = provider;
}

/**
 * Get current API provider
 */
export function getAPIProvider(): APIProvider {
  return currentProvider;
}

/**
 * Get the appropriate client based on current provider
 */
function getClient() {
  return currentProvider === "justtcg" ? JustTCG : TCGCodex;
}

/**
 * Search for cards (unified interface)
 */
export async function searchCards(params: {
  q?: string;
  number?: string;
  game?: string;
  set?: string;
  limit?: number;
  offset?: number;
}) {
  const client = getClient();
  console.log(`🔍 Searching with ${currentProvider.toUpperCase()}`, params);
  return await client.searchCards(params);
}

/**
 * Get card by ID (unified interface)
 */
export async function getCardById(cardId: string) {
  const client = getClient();
  return await client.getCardById(cardId);
}

/**
 * Get card variant/pricing (unified interface)
 */
export async function getCardVariant(params: {
  cardId?: string;
  variantId?: string;
  tcgPlayerId?: string;
  condition?: string;
  printing?: string;
  language?: string;
}) {
  const client = getClient();
  return await client.getCardVariant(params);
}

/**
 * Get all games (unified interface)
 */
export async function getGames() {
  const client = getClient();
  return await client.getGames();
}

/**
 * Get sets for a game (unified interface)
 */
export async function getSets(game: string) {
  const client = getClient();
  return await client.getSets(game);
}

/**
 * Test API connection (unified interface)
 */
export async function testConnection() {
  const client = getClient();
  return await client.testConnection();
}

/**
 * Check which API keys are configured
 */
export function getAvailableProviders(): APIProvider[] {
  const providers: APIProvider[] = [];

  if (process.env.NEXT_PUBLIC_JUSTTCG_API_KEY) {
    providers.push("justtcg");
  }

  if (process.env.NEXT_PUBLIC_TCGCODEX_API_KEY) {
    providers.push("tcgcodex");
  }

  return providers;
}

/**
 * Get provider display name
 */
export function getProviderName(provider: APIProvider): string {
  const names: Record<APIProvider, string> = {
    justtcg: "JustTCG",
    tcgcodex: "TCGCodex",
  };
  return names[provider];
}
