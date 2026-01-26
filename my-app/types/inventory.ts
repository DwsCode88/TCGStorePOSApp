import { Timestamp } from 'firebase/firestore';

export type Game = 'pokemon' | 'mtg' | 'onepiece' | 'lorcana' | 'digimon' | 'unionarena' | 'grandarchive';
export type Condition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
export type AcquisitionType = 'buy' | 'trade' | 'pull';
export type InventoryStatus = 'pending' | 'priced' | 'labeled' | 'listed';
export type PricingStrategy = 'round' | 'bin' | 'markup' | 'fixed';

export interface Card {
  id: string;
  tcgPlayerId?: string;
  game: Game;
  name: string;
  setName: string;
  setCode: string;
  number: string;
  rarity: string;
  imageUrl?: string;
  variants: CardVariant[];
  lastUpdated: Timestamp;
}

export interface CardVariant {
  variantId: string;
  condition: Condition;
  printing: string;
  language: string;
  price: number;
  priceHistory7d?: number[];
  lastUpdated: Timestamp;
}

export interface InventoryItem {
  sku: string;
  cardId: string;
  game: Game;
  cardName: string;
  setName: string;
  condition: Condition;
  printing: string;
  language: string;
  quantity: number;
  location: string;
  costBasis: number;
  acquisitionType: AcquisitionType;
  acquisitionDate: Timestamp;
  marketPrice: number;
  sellPrice: number;
  sellPriceLockedAt?: Timestamp;
  priceLastUpdated: Timestamp;
  status: InventoryStatus;
  squareItemId?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Sale {
  id: string;
  squareOrderId: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  saleDate: Timestamp;
  profit: number;
}

export interface SaleItem {
  sku: string;
  cardName: string;
  quantity: number;
  sellPrice: number;
  costBasis: number;
}

export interface PricingRule {
  condition: Condition;
  priceRange: { min: number; max: number };
  strategy: PricingStrategy;
  params: RoundingParams | BinParams | MarkupParams | FixedParams;
  enabled: boolean;
}

export interface RoundingParams {
  roundTo: number;
  direction: 'up' | 'down' | 'nearest';
}

export interface BinParams {
  bins: number[];
}

export interface MarkupParams {
  percentage: number;
  minProfit?: number;
}

export interface FixedParams {
  price: number;
}
