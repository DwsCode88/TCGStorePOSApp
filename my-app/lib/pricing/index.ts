import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Condition, PricingRule, BinParams, RoundingParams, MarkupParams } from '@/types/inventory';

export async function calculateSellPrice(marketPrice: number, condition: Condition): Promise<number> {
  if (!marketPrice || marketPrice <= 0) return 0;
  const rules = await getPricingRules();
  const rule = rules.find(r => r.condition === condition && marketPrice >= r.priceRange.min && marketPrice < r.priceRange.max && r.enabled);
  if (!rule) return roundToNearest(marketPrice, 0.50);
  
  switch (rule.strategy) {
    case 'bin': return applyBinPricing(marketPrice, rule.params as BinParams);
    case 'round': return applyRounding(marketPrice, rule.params as RoundingParams);
    case 'markup': return applyMarkup(marketPrice, rule.params as MarkupParams);
    default: return marketPrice;
  }
}

function applyBinPricing(price: number, params: BinParams): number {
  return params.bins.reduce((prev, curr) => Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev);
}

function applyRounding(price: number, params: RoundingParams): number {
  const { roundTo, direction } = params;
  switch (direction) {
    case 'up': return Math.ceil(price / roundTo) * roundTo;
    case 'down': return Math.floor(price / roundTo) * roundTo;
    default: return Math.round(price / roundTo) * roundTo;
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
  const rulesDoc = await getDoc(doc(db, 'pricingRules', 'default'));
  if (rulesDoc.exists()) return rulesDoc.data().rules || DEFAULT_RULES;
  return DEFAULT_RULES;
}

export const DEFAULT_RULES: PricingRule[] = [
  { condition: 'NM', priceRange: { min: 0, max: 5 }, strategy: 'bin', params: { bins: [0.25, 0.50, 1, 2, 3, 4, 5] }, enabled: true },
  { condition: 'NM', priceRange: { min: 5, max: 20 }, strategy: 'round', params: { roundTo: 0.50, direction: 'nearest' }, enabled: true },
  { condition: 'NM', priceRange: { min: 20, max: 100 }, strategy: 'round', params: { roundTo: 1.00, direction: 'nearest' }, enabled: true },
  { condition: 'NM', priceRange: { min: 100, max: Infinity }, strategy: 'round', params: { roundTo: 5.00, direction: 'up' }, enabled: true },
  { condition: 'LP', priceRange: { min: 0, max: Infinity }, strategy: 'markup', params: { percentage: -10 }, enabled: true },
  { condition: 'MP', priceRange: { min: 0, max: Infinity }, strategy: 'markup', params: { percentage: -20 }, enabled: true },
  { condition: 'HP', priceRange: { min: 0, max: Infinity }, strategy: 'markup', params: { percentage: -35 }, enabled: true },
  { condition: 'DMG', priceRange: { min: 0, max: Infinity }, strategy: 'markup', params: { percentage: -50 }, enabled: true },
];

export async function lockSellPrice(sku: string): Promise<void> {
  await updateDoc(doc(db, 'inventory', sku), { sellPriceLockedAt: new Date(), status: 'labeled' });
}
