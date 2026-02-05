// Inventory Item Type Definition

// Game type for TCG games (matches GAME_CODES in lib/firebase/inventory.ts)
export type Game =
  | "pokemon"
  | "mtg"
  | "onepiece"
  | "lorcana"
  | "digimon"
  | "unionarena"
  | "grandarchive";

// Condition type for card conditions
export type Condition =
  | "NM"
  | "LP"
  | "MP"
  | "HP"
  | "DMG"
  | "Near Mint"
  | "Lightly Played"
  | "Moderately Played"
  | "Heavily Played"
  | "Damaged";

// Pricing strategy types
export type PricingStrategy = "bin" | "round" | "markup";

// Price binning parameters
export interface BinParams {
  bins: number[];
}

// Rounding parameters
export interface RoundingParams {
  roundTo: number;
  direction?: "up" | "down" | "nearest";
}

// Markup parameters
export interface MarkupParams {
  percentage: number;
  minProfit?: number;
}

// Pricing rule configuration
export interface PricingRule {
  condition: Condition;
  priceRange: {
    min: number;
    max: number;
  };
  strategy: PricingStrategy;
  params: BinParams | RoundingParams | MarkupParams;
  enabled: boolean;
}

export interface InventoryItem {
  // Core identification
  sku: string;
  id?: string;

  // Card information
  cardName?: string;
  name?: string;
  setName?: string;
  set?: string;
  number?: string;
  rarity?: string;
  game?: string;

  // Condition and printing
  condition?: string;
  printing?: string;
  language?: string;

  // Pricing
  marketPrice?: number;
  sellPrice?: number;
  costBasis?: number;
  profit?: number;

  // Inventory management
  quantity?: number;
  location?: string;
  displayLocation?: string;
  shelfNumber?: string;
  binderInfo?: string;

  // Acquisition
  acquisitionType?: "buy" | "trade" | "pull" | "consignment";
  acquisitionDate?: string;
  vendorCode?: string;
  customerVendorCode?: string;

  // Consignment specific
  customerId?: string;
  consignorPayoutPercent?: number;

  // Export tracking
  exportedAt?: any; // Firebase Timestamp or null
  exportBatchId?: string;
  lastExportDate?: string;

  // QR and customer interaction
  scanCount?: number;
  interestedCount?: number;
  lastScanned?: any;
  scans?: Array<{
    timestamp: any;
    userAgent?: string;
  }>;
  customerInterest?: Array<{
    timestamp: any;
    interested: boolean;
  }>;

  // Price history
  priceHistory?: Array<{
    oldPrice: number;
    newPrice: number;
    changeAmount: number;
    changePercent: number;
    updatedAt: string;
    source?: string;
  }>;
  lastPriceUpdate?: any;
  priceSource?: string;

  // Relabeling
  relabeled?: boolean;
  relabeledAt?: any;

  // Images
  imageUrl?: string;

  // Additional fields
  notes?: string;
  tcgplayerId?: string;
  cardtrader_id?: number;
  blueprint_id?: number;

  // Timestamps
  createdAt?: any;
  updatedAt?: any;

  // Catch-all for any other fields
  [key: string]: any;
}
