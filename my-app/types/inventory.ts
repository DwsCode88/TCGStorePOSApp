// Inventory Item Type Definition

// Game type for TCG games
export type Game =
  | "pokemon"
  | "magic"
  | "yugioh"
  | "onepiece"
  | "lorcana"
  | "flesh-and-blood";

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
