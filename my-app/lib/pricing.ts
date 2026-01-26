import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  Condition,
  PricingRule,
  BinParams,
  RoundingParams,
  MarkupParams,
} from "@/types/inventory";

// Buy/Trade percentage settings
export const ACQUISITION_SETTINGS = {
  buyPercentage: 70, // Buy at 70% of market
  tradePercentage: 75, // Trade at 75% of market
};

/**
 * Calculate cost basis based on acquisition type
 */
export function calculateCostBasis(
  marketPrice: number,
  acquisitionType: "buy" | "trade" | "pull",
): number {
  if (acquisitionType === "pull") {
    return 0; // Pulled cards cost nothing
  }

  if (acquisitionType === "buy") {
    return marketPrice * (ACQUISITION_SETTINGS.buyPercentage / 100);
  }

  if (acquisitionType === "trade") {
    return marketPrice * (ACQUISITION_SETTINGS.tradePercentage / 100);
  }

  return 0;
}

/**
 * Get pricing breakdown for display
 */
export function getPricingBreakdown(
  marketPrice: number,
  acquisitionType: "buy" | "trade" | "pull",
  condition: Condition = "NM",
) {
  const costBasis = calculateCostBasis(marketPrice, acquisitionType);
  const sellPrice = calculateSellPriceSync(marketPrice, condition);
  const profit = sellPrice - costBasis;
  const profitPercentage = costBasis === 0 ? 100 : (profit / costBasis) * 100;

  return {
    marketPrice,
    costBasis,
    sellPrice,
    profit,
    profitPercentage,
    acquisitionType,
    condition,
  };
}

/**
 * Synchronous version of calculateSellPrice for immediate use
 */
function calculateSellPriceSync(
  marketPrice: number,
  condition: Condition,
): number {
  if (!marketPrice || marketPrice <= 0) return 0;

  // Condition multipliers
  const conditionMultipliers: Record<Condition, number> = {
    NM: 1.0,
    LP: 0.9,
    MP: 0.8,
    HP: 0.65,
    DMG: 0.5,
  };

  const adjustedPrice = marketPrice * (conditionMultipliers[condition] || 1.0);

  // Apply default rounding/binning logic
  if (adjustedPrice < 5) {
    // Bin to common prices
    const bins = [0.25, 0.5, 1, 2, 3, 4, 5];
    return bins.reduce((prev, curr) =>
      Math.abs(curr - adjustedPrice) < Math.abs(prev - adjustedPrice)
        ? curr
        : prev,
    );
  } else if (adjustedPrice < 20) {
    return roundToNearest(adjustedPrice, 0.5);
  } else if (adjustedPrice < 100) {
    return roundToNearest(adjustedPrice, 1.0);
  } else {
    return Math.ceil(adjustedPrice / 5.0) * 5.0;
  }
}

export async function calculateSellPrice(
  marketPrice: number,
  condition: Condition,
): Promise<number> {
  if (!marketPrice || marketPrice <= 0) return 0;
  const rules = await getPricingRules();
  const rule = rules.find(
    (r) =>
      r.condition === condition &&
      marketPrice >= r.priceRange.min &&
      marketPrice < r.priceRange.max &&
      r.enabled,
  );
  if (!rule) return roundToNearest(marketPrice, 0.5);

  switch (rule.strategy) {
    case "bin":
      return applyBinPricing(marketPrice, rule.params as BinParams);
    case "round":
      return applyRounding(marketPrice, rule.params as RoundingParams);
    case "markup":
      return applyMarkup(marketPrice, rule.params as MarkupParams);
    default:
      return marketPrice;
  }
}

function applyBinPricing(price: number, params: BinParams): number {
  return params.bins.reduce((prev, curr) =>
    Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev,
  );
}

function applyRounding(price: number, params: RoundingParams): number {
  const { roundTo, direction } = params;
  switch (direction) {
    case "up":
      return Math.ceil(price / roundTo) * roundTo;
    case "down":
      return Math.floor(price / roundTo) * roundTo;
    default:
      return Math.round(price / roundTo) * roundTo;
  }
}

function applyMarkup(price: number, params: MarkupParams): number {
  const markup = price * (params.percentage / 100);
  const sellPrice = price + Math.max(markup, params.minProfit || 0);
  return roundToNearest(sellPrice, 0.25);
}

function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

async function getPricingRules(): Promise<PricingRule[]> {
  try {
    const rulesDoc = await getDoc(doc(db, "pricingRules", "default"));
    if (rulesDoc.exists()) return rulesDoc.data().rules || DEFAULT_RULES;
  } catch (error) {
    console.warn("Could not fetch pricing rules, using defaults");
  }
  return DEFAULT_RULES;
}

export const DEFAULT_RULES: PricingRule[] = [
  {
    condition: "NM",
    priceRange: { min: 0, max: 5 },
    strategy: "bin",
    params: { bins: [0.25, 0.5, 1, 2, 3, 4, 5] },
    enabled: true,
  },
  {
    condition: "NM",
    priceRange: { min: 5, max: 20 },
    strategy: "round",
    params: { roundTo: 0.5, direction: "nearest" },
    enabled: true,
  },
  {
    condition: "NM",
    priceRange: { min: 20, max: 100 },
    strategy: "round",
    params: { roundTo: 1.0, direction: "nearest" },
    enabled: true,
  },
  {
    condition: "NM",
    priceRange: { min: 100, max: Infinity },
    strategy: "round",
    params: { roundTo: 5.0, direction: "up" },
    enabled: true,
  },
  {
    condition: "LP",
    priceRange: { min: 0, max: Infinity },
    strategy: "markup",
    params: { percentage: -10 },
    enabled: true,
  },
  {
    condition: "MP",
    priceRange: { min: 0, max: Infinity },
    strategy: "markup",
    params: { percentage: -20 },
    enabled: true,
  },
  {
    condition: "HP",
    priceRange: { min: 0, max: Infinity },
    strategy: "markup",
    params: { percentage: -35 },
    enabled: true,
  },
  {
    condition: "DMG",
    priceRange: { min: 0, max: Infinity },
    strategy: "markup",
    params: { percentage: -50 },
    enabled: true,
  },
];

export async function lockSellPrice(sku: string): Promise<void> {
  await updateDoc(doc(db, "inventory", sku), {
    sellPriceLockedAt: new Date(),
    status: "labeled",
  });
}
