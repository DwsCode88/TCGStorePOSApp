/**
 * Unified Card API Adapter
 * Updated with card number search support
 */

import * as JustTCG from "./justtcg/client";
import * as TCGCodex from "./tcgcodex/client";

export type APIProvider = "justtcg" | "tcgcodex";

let currentProvider: APIProvider = "justtcg";

export function setAPIProvider(provider: APIProvider) {
  console.log("🔄 Switching API provider to:", provider);
  currentProvider = provider;
}

export function getAPIProvider(): APIProvider {
  return currentProvider;
}

function getClient() {
  return currentProvider === "justtcg" ? JustTCG : TCGCodex;
}

/**
 * Search for cards (unified interface)
 * Now supports card number search!
 */
export async function searchCards(params: {
  q?: string;
  number?: string; // NEW: Card number search
  game?: string;
  set?: string;
  limit?: number;
  offset?: number;
}) {
  const client = getClient();
  console.log(`🔍 Searching with ${currentProvider.toUpperCase()}`);
  return await client.searchCards(params);
}

export async function getCardById(cardId: string) {
  const client = getClient();
  return await client.getCardById(cardId);
}

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

export async function getGames() {
  const client = getClient();
  return await client.getGames();
}

export async function getSets(game: string) {
  const client = getClient();
  return await client.getSets(game);
}

export async function testConnection() {
  const client = getClient();
  return await client.testConnection();
}

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

export function getProviderName(provider: APIProvider): string {
  const names: Record<APIProvider, string> = {
    justtcg: "JustTCG",
    tcgcodex: "TCGCodex",
  };
  return names[provider];
}
