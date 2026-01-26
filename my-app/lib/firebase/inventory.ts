import { doc, setDoc } from "firebase/firestore";
import { db } from "./client";
import { InventoryItem, Game } from "@/types/inventory";

const GAME_CODES: Record<Game, string> = {
  pokemon: "PKM",
  mtg: "MTG",
  onepiece: "OPC",
  lorcana: "LOR",
  digimon: "DGM",
  unionarena: "UNA",
  grandarchive: "GAR",
};

/**
 * Generate SKU without Firebase transaction
 * Uses timestamp + random for uniqueness
 */
export async function generateSKU(game: Game): Promise<string> {
  const gameCode = GAME_CODES[game] || "UNK";
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `VT-${gameCode}-${timestamp}${random}`;
}

export async function createInventoryItem(
  data: Omit<
    InventoryItem,
    "sku" | "createdAt" | "updatedAt" | "priceLastUpdated"
  >,
): Promise<string> {
  const sku = await generateSKU(data.game);
  const now = new Date();

  const inventoryItem: InventoryItem = {
    ...data,
    sku,
    priceLastUpdated: now as any,
    createdAt: now as any,
    updatedAt: now as any,
  };

  await setDoc(doc(db, "inventory", sku), inventoryItem);

  return sku;
}
