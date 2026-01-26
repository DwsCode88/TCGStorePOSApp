import { Client, Environment } from 'square';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment: IS_PRODUCTION ? Environment.Production : Environment.Sandbox,
});

export async function createSquareItem(inventoryItem: any) {
  const response = await squareClient.catalogApi.upsertCatalogObject({
    idempotencyKey: inventoryItem.sku,
    object: {
      type: 'ITEM',
      id: `#${inventoryItem.sku}`,
      itemData: {
        name: `${inventoryItem.cardName} - ${inventoryItem.condition}`,
        description: `${inventoryItem.setName} | ${inventoryItem.printing}`,
        variations: [{
          type: 'ITEM_VARIATION',
          id: `#${inventoryItem.sku}-VAR`,
          itemVariationData: {
            itemId: `#${inventoryItem.sku}`,
            name: inventoryItem.condition,
            pricingType: 'FIXED_PRICING',
            priceMoney: { amount: BigInt(Math.round(inventoryItem.sellPrice * 100)), currency: 'USD' },
            sku: inventoryItem.sku,
            trackInventory: true,
          },
        }],
        categoryId: getCategoryId(inventoryItem.game),
      },
    },
  });
  return response.result.catalogObject?.id;
}

function getCategoryId(game: string): string {
  const categories: Record<string, string> = {
    pokemon: process.env.SQUARE_CATEGORY_POKEMON || '',
    mtg: process.env.SQUARE_CATEGORY_MTG || '',
    onepiece: process.env.SQUARE_CATEGORY_ONEPIECE || '',
    lorcana: process.env.SQUARE_CATEGORY_LORCANA || '',
  };
  return categories[game as keyof typeof categories] || '';
}
