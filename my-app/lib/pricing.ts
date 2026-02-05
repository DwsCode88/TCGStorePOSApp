import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase/client";
import {
  Condition,
  PricingRule,
  BinParams,
  RoundingParams,
  MarkupParams,
} from "@/types/inventory";

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

// Condition-based buy percentages
const CONDITION_BUY_PERCENTS: Record<string, number> = {
  NM: 65,
  "NEAR MINT": 65,
  LP: 55,
  "LIGHTLY PLAYED": 55,
  MP: 45,
  "MODERATELY PLAYED": 45,
  HP: 30,
  "HEAVILY PLAYED": 30,
  DMG: 20,
  DAMAGED: 20,
  GRADED: 70,
};

export function calculateCostBasis(
  marketPrice: number,
  acquisitionType: "buy" | "trade" | "pull" | "consignment",
  condition: string = "NM",
): number {
  if (!marketPrice || marketPrice <= 0) return 0;

  const normalizedCondition = condition.toUpperCase().trim();
  const buyPercent =
    CONDITION_BUY_PERCENTS[normalizedCondition] || CONDITION_BUY_PERCENTS["NM"];

  switch (acquisitionType) {
    case "buy":
      return marketPrice * (buyPercent / 100);
    case "trade":
      // Trade gives 5% more than cash
      return marketPrice * ((buyPercent + 5) / 100);
    case "pull":
      // Pulls have no cost
      return 0;
    case "consignment":
      // Consignment cost is handled separately by payout percent
      return 0;
    default:
      return marketPrice * (buyPercent / 100);
  }
}

// Synchronous version for bulk upload (doesn't fetch Firestore rules)
export function calculateSellPriceSync(
  marketPrice: number,
  condition: string = "NM",
  markup: number = 30,
): number {
  if (!marketPrice || marketPrice <= 0) return 0;

  // Apply condition discount
  const normalizedCondition = condition.toUpperCase().trim();
  let adjustedPrice = marketPrice;

  switch (normalizedCondition) {
    case "LP":
    case "LIGHTLY PLAYED":
      adjustedPrice = marketPrice * 0.9; // -10%
      break;
    case "MP":
    case "MODERATELY PLAYED":
      adjustedPrice = marketPrice * 0.8; // -20%
      break;
    case "HP":
    case "HEAVILY PLAYED":
      adjustedPrice = marketPrice * 0.65; // -35%
      break;
    case "DMG":
    case "DAMAGED":
      adjustedPrice = marketPrice * 0.5; // -50%
      break;
    default:
      adjustedPrice = marketPrice; // NM, no adjustment
  }

  // Apply markup
  const sellPrice = adjustedPrice * (1 + markup / 100);

  // Smart rounding based on price
  if (sellPrice < 5) {
    return roundToNearest(sellPrice, 0.25);
  } else if (sellPrice < 20) {
    return roundToNearest(sellPrice, 0.5);
  } else if (sellPrice < 100) {
    return roundToNearest(sellPrice, 1.0);
  } else {
    return Math.ceil(sellPrice / 5) * 5; // Round up to nearest $5
  }
}

function applyBinPricing(price: number, params: BinParams): number {
  return params.bins.reduce((prev, curr) =>
    Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev,
  );
}

function applyRounding(price: number, params: RoundingParams): number {
  const { roundTo, direction = "nearest" } = params;

  switch (direction) {
    case "up":
      return Math.ceil(price / roundTo) * roundTo;
    case "down":
      return Math.floor(price / roundTo) * roundTo;
    case "nearest":
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
    if (rulesDoc.exists()) {
      const data = rulesDoc.data();
      return (data?.rules as PricingRule[]) || DEFAULT_RULES;
    }
  } catch (error) {
    console.error("Error fetching pricing rules:", error);
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
  try {
    await updateDoc(doc(db, "inventory", sku), {
      sellPriceLockedAt: new Date(),
      status: "labeled",
    });
  } catch (error) {
    console.error("Error locking sell price:", error);
    throw error;
  }
}
