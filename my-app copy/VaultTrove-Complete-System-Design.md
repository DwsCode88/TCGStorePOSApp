# VaultTrove TCG Singles Management System
## Complete System Design - Next.js + Vercel + Firebase + JustTCG + Square

**Version**: 1.0  
**Date**: January 2026  
**Stack**: Next.js 14, Firebase, JustTCG API, Square POS

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Data Model (Firestore Collections)](#2-data-model-firestore-collections)
3. [Singles Intake Workflow](#3-singles-intake-workflow)
4. [Pricing Service Architecture](#4-pricing-service-architecture)
5. [POS Integration (Square)](#5-pos-integration-square)
6. [Rate Limiting & Caching Strategy](#6-rate-limiting--caching-strategy)
7. [Label System & Print Formats](#7-label-system--print-formats)
8. [Show Mode vs Store Mode](#8-show-mode-vs-store-mode)
9. [Implementation Guide](#9-implementation-guide)
10. [Error Handling & Monitoring](#10-error-handling--monitoring)

---

## 1. System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VaultTrove System                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Next.js    │───▶│   Vercel     │───▶│  Firebase    │     │
│  │   App        │    │   Hosting    │    │  Firestore   │     │
│  │              │    │              │    │              │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         │                                        │             │
│         │                                        │             │
│         ▼                                        ▼             │
│  ┌──────────────┐                    ┌──────────────┐         │
│  │   Firebase   │                    │   Firebase   │         │
│  │   Auth       │                    │   Storage    │         │
│  │              │                    │   (Labels)   │         │
│  └──────────────┘                    └──────────────┘         │
│                                                                 │
│         ┌──────────────┐    ┌──────────────┐                  │
│         │   JustTCG    │    │   Square     │                  │
│         │   API        │    │   POS API    │                  │
│         │   (Pricing)  │    │   (Sales)    │                  │
│         └──────────────┘    └──────────────┘                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐      │
│  │         Firebase Cloud Functions (Cron)             │      │
│  │  - Price updates (batch refresh every 6 hours)      │      │
│  │  - Cache cleanup (daily)                            │      │
│  │  - Square webhook handlers                          │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) | UI, SSR, API routes |
| **Hosting** | Vercel | Fast global CDN, edge functions |
| **Database** | Firebase Firestore | NoSQL document store |
| **Functions** | Firebase Cloud Functions | Scheduled tasks, webhooks |
| **Auth** | Firebase Auth | User authentication |
| **Storage** | Firebase Storage | PDF labels, images |
| **Pricing API** | JustTCG | Real-time TCG pricing |
| **POS** | Square API | Point of sale integration |
| **Forms** | React Hook Form + Zod | Type-safe form validation |
| **UI** | shadcn/ui + Tailwind | Modern component library |
| **PDF** | jsPDF | Label generation |
| **Barcodes** | bwip-js | SKU barcode generation |

---

## 2. Data Model (Firestore Collections)

### Collection Structure

```
firestore/
├── cards/                      # Card metadata cache from JustTCG
│   └── {justTcgCardId}/
│       ├── id                  # JustTCG card ID
│       ├── tcgPlayerId        
│       ├── game               # "pokemon", "mtg", "onepiece", "lorcana"
│       ├── name
│       ├── setName
│       ├── setCode
│       ├── number
│       ├── rarity
│       ├── imageUrl
│       ├── variants[]         # All variants with pricing
│       └── lastUpdated
│
├── inventory/                  # Your physical inventory
│   └── {sku}/
│       ├── sku                # Generated: "VT-PKM-001234"
│       ├── cardId             # Reference to cards/{id}
│       ├── game
│       ├── cardName
│       ├── setName
│       ├── condition          # "NM", "LP", "MP", "HP", "DMG"
│       ├── printing           # "Normal", "Foil", "Reverse Holo", etc.
│       ├── language           # "English", "Japanese", etc.
│       ├── quantity           # Current stock
│       ├── location           # Bin location in store (e.g., "A-12")
│       ├── costBasis          # What you paid for it
│       ├── acquisitionType    # "buy", "trade", "pull"
│       ├── acquisitionDate
│       ├── marketPrice        # Latest from JustTCG
│       ├── sellPrice          # YOUR price (locked at label print)
│       ├── sellPriceLockedAt  # Timestamp when price was locked
│       ├── priceLastUpdated   # When market price was refreshed
│       ├── status             # "pending", "priced", "labeled", "listed"
│       ├── squareItemId       # Reference to Square catalog item
│       ├── notes
│       ├── createdAt
│       └── updatedAt
│
├── priceHistory/              # Historical pricing data
│   └── {sku}/
│       └── history/           # Subcollection
│           └── {timestamp}/
│               ├── marketPrice
│               ├── sellPrice
│               ├── source     # "justtcg", "manual"
│               └── timestamp
│
├── sales/                     # Sales records from Square
│   └── {saleId}/
│       ├── squareOrderId
│       ├── items[]            # Array of sold items
│       │   ├── sku
│       │   ├── cardName
│       │   ├── quantity
│       │   ├── sellPrice
│       │   └── costBasis
│       ├── subtotal
│       ├── tax
│       ├── total
│       ├── paymentMethod
│       ├── saleDate
│       └── profit            # Calculated: (sellPrice - costBasis) * qty
│
├── pricingRules/              # Your pricing strategies
│   └── default/
│       ├── rules[]
│       │   ├── condition      # "NM", "LP", etc.
│       │   ├── priceRange     # { min: 0, max: 5 }
│       │   ├── strategy       # "round", "bin", "markup"
│       │   ├── params         # Strategy-specific params
│       │   └── enabled
│       └── updatedAt
│
├── priceCache/                # Short-lived JustTCG response cache
│   └── {cacheKey}/
│       ├── data              # API response
│       ├── expiresAt        # TTL timestamp
│       └── createdAt
│
└── systemConfig/              # App configuration
    ├── settings/
    │   ├── skuCounter        # Auto-increment counter
    │   ├── defaultMarkup     # Default profit margin
    │   ├── taxRate
    │   ├── showModeSettings
    │   └── storeModeSettings
    │
    ├── rateLimitState/
    │   ├── requestCount      # Current month's count
    │   ├── resetDate        # End of month
    │   ├── plan             # "hobby", "pro", "enterprise"
    │   └── limit            # Monthly limit
    │
    └── modeSettings/
        ├── currentMode       # "store" or "show"
        ├── show              # Show mode config
        └── store             # Store mode config
```

### TypeScript Interfaces

```typescript
// types/inventory.ts

import { Timestamp } from 'firebase/firestore';

export type Game = 'pokemon' | 'mtg' | 'onepiece' | 'lorcana' | 'digimon' | 'unionarena' | 'grandarchive';
export type Condition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
export type AcquisitionType = 'buy' | 'trade' | 'pull';
export type InventoryStatus = 'pending' | 'priced' | 'labeled' | 'listed';
export type PricingStrategy = 'round' | 'bin' | 'markup' | 'fixed';

export interface Card {
  id: string;                    // JustTCG card ID
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
  variantId: string;             // JustTCG variant ID
  condition: Condition;
  printing: string;              // "Normal", "Foil", "Reverse Holo", "1st Edition"
  language: string;
  price: number;
  priceHistory7d?: number[];
  lastUpdated: Timestamp;
}

export interface InventoryItem {
  sku: string;                   // "VT-PKM-001234"
  cardId: string;                // Reference to JustTCG card
  game: Game;
  cardName: string;
  setName: string;
  condition: Condition;
  printing: string;
  language: string;
  quantity: number;
  location: string;              // Physical location (e.g., "Bin A-12")
  costBasis: number;
  acquisitionType: AcquisitionType;
  acquisitionDate: Timestamp;
  marketPrice: number;           // From JustTCG
  sellPrice: number;             // After applying pricing rules
  sellPriceLockedAt?: Timestamp; // When price was locked at label print
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
  roundTo: number;              // 0.25, 0.50, 1.00, etc.
  direction: 'up' | 'down' | 'nearest';
}

export interface BinParams {
  bins: number[];               // [0.25, 0.50, 1, 2, 3, 4, 5]
}

export interface MarkupParams {
  percentage: number;           // 20 (for 20% markup) or -10 (for 10% discount)
  minProfit?: number;           // Minimum $ profit
}

export interface FixedParams {
  price: number;
}
```

---

## 3. Singles Intake Workflow

### User Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    INTAKE WORKFLOW                          │
└─────────────────────────────────────────────────────────────┘

Step 1: Search for Card
    ↓
    User enters: "Charizard Base Set"
    ↓
    App calls: JustTCG /cards?q=charizard&set=base-set&game=pokemon
    ↓
    Display results with images (cached 1 hour)

Step 2: Select Card & Variant
    ↓
    User selects: Charizard (Holo Rare)
    User selects: Condition (NM, LP, MP, HP, DMG)
    User selects: Printing (1st Edition, Unlimited, Shadowless)
    User selects: Language (English, Japanese, etc.)
    ↓
    Fetch pricing: JustTCG /cards?variantId={id} (cached 5 min)

Step 3: Capture Acquisition Details
    ↓
    Acquisition Type: ○ Buy  ○ Trade  ● Pull
    Cost Basis: $50.00
    Quantity: 1
    Location: Bin A-12
    Notes: (optional, e.g., "Slightly off-center")

Step 4: Generate SKU
    ↓
    Auto-increment counter from Firestore
    Format: VT-{GAME_CODE}-{6_DIGITS}
    Example: VT-PKM-001234
    ↓
    Create Firestore document: inventory/{sku}

Step 5: Calculate Sell Price
    ↓
    Market Price: $75.00 (from JustTCG)
    ↓
    Apply Pricing Rules:
      IF price < $5:
        → Snap to bins: [0.25, 0.50, 1, 2, 3, 4, 5]
      ELSE IF price $5-$20:
        → Round to nearest $0.50
      ELSE IF price $20-$100:
        → Round to nearest $1
      ELSE:
        → Round to nearest $5
    ↓
    Suggested Sell Price: $75.00
    User can manually adjust if needed

Step 6: Save to Inventory
    ↓
    Status: "priced" (ready for labeling)
    ↓
    Queue for label printing
    ↓
    Success! Redirect to inventory list
```

### Intake Form Component

```typescript
// app/intake/page.tsx

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { searchCards, getCardVariants } from '@/lib/justtcg';
import { createInventoryItem } from '@/lib/firebase/inventory';
import { calculateSellPrice } from '@/lib/pricing';
import { SearchBar } from '@/components/intake/SearchBar';
import { SearchResults } from '@/components/intake/SearchResults';
import { CardPreview } from '@/components/intake/CardPreview';
import { VariantSelector } from '@/components/intake/VariantSelector';
import { AcquisitionDetails } from '@/components/intake/AcquisitionDetails';
import { PricingDisplay } from '@/components/intake/PricingDisplay';
import { Button } from '@/components/ui/button';

const intakeSchema = z.object({
  cardId: z.string().min(1, 'Card is required'),
  condition: z.enum(['NM', 'LP', 'MP', 'HP', 'DMG']),
  printing: z.string().min(1, 'Printing is required'),
  language: z.string().default('English'),
  acquisitionType: z.enum(['buy', 'trade', 'pull']),
  costBasis: z.number().min(0, 'Cost basis must be positive'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  location: z.string().min(1, 'Location is required'),
  notes: z.string().optional(),
});

type IntakeFormData = z.infer<typeof intakeSchema>;

export default function IntakePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [marketPrice, setMarketPrice] = useState(0);
  const [suggestedPrice, setSuggestedPrice] = useState(0);
  const [loading, setLoading] = useState(false);

  const form = useForm<IntakeFormData>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      quantity: 1,
      language: 'English',
      acquisitionType: 'buy',
      condition: 'NM',
    },
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const results = await searchCards({ q: searchQuery });
      setSearchResults(results);
    } catch (error) {
      toast.error('Search failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCard = async (card) => {
    setSelectedCard(card);
    form.setValue('cardId', card.id);
    
    // Auto-select first variant if available
    if (card.variants?.length > 0) {
      const firstVariant = card.variants[0];
      form.setValue('condition', firstVariant.condition);
      form.setValue('printing', firstVariant.printing);
      
      // Fetch pricing for this variant
      await handleVariantChange(firstVariant.condition, firstVariant.printing);
    }
  };

  const handleVariantChange = async (condition: string, printing: string) => {
    if (!selectedCard) return;
    
    const language = form.getValues('language');
    
    setLoading(true);
    try {
      // Fetch specific variant pricing
      const pricing = await getCardVariants({
        cardId: selectedCard.id,
        condition,
        printing,
        language,
      });
      
      setMarketPrice(pricing.price);
      
      // Calculate suggested sell price based on rules
      const suggested = await calculateSellPrice(pricing.price, condition as any);
      setSuggestedPrice(suggested);
    } catch (error) {
      toast.error('Failed to fetch pricing');
      console.error(error);
      setMarketPrice(0);
      setSuggestedPrice(0);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: IntakeFormData) => {
    if (!selectedCard) {
      toast.error('Please select a card');
      return;
    }
    
    setLoading(true);
    try {
      const sku = await createInventoryItem({
        ...data,
        cardName: selectedCard.name,
        setName: selectedCard.setName,
        game: selectedCard.game,
        marketPrice,
        sellPrice: suggestedPrice,
        status: 'priced',
      });
      
      toast.success(`Card added! SKU: ${sku}`);
      
      // Reset form
      form.reset();
      setSelectedCard(null);
      setSearchQuery('');
      setSearchResults([]);
      setMarketPrice(0);
      setSuggestedPrice(0);
    } catch (error) {
      toast.error('Failed to add card');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Singles Intake</h1>
      
      {/* Step 1: Search */}
      <div className="mb-8">
        <SearchBar 
          value={searchQuery}
          onChange={setSearchQuery}
          onSearch={handleSearch}
          loading={loading}
        />
        
        {searchResults.length > 0 && (
          <SearchResults 
            results={searchResults}
            onSelect={handleSelectCard}
            selectedId={selectedCard?.id}
          />
        )}
      </div>

      {/* Steps 2-6: Form */}
      {selectedCard && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <CardPreview card={selectedCard} />
          
          <VariantSelector
            form={form}
            variants={selectedCard.variants}
            onVariantChange={handleVariantChange}
          />
          
          <AcquisitionDetails form={form} />
          
          <PricingDisplay
            marketPrice={marketPrice}
            suggestedPrice={suggestedPrice}
            onPriceChange={setSuggestedPrice}
            loading={loading}
          />
          
          <Button 
            type="submit" 
            size="lg" 
            className="w-full"
            disabled={loading || marketPrice === 0}
          >
            {loading ? 'Adding...' : 'Add to Inventory'}
          </Button>
        </form>
      )}
    </div>
  );
}
```

### SKU Generation

```typescript
// lib/firebase/inventory.ts

import { doc, setDoc, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from './client';
import { InventoryItem, Game } from '@/types/inventory';

const GAME_CODES: Record<Game, string> = {
  pokemon: 'PKM',
  mtg: 'MTG',
  onepiece: 'OPC',
  lorcana: 'LOR',
  digimon: 'DGM',
  unionarena: 'UNA',
  grandarchive: 'GAR',
};

/**
 * Generate unique SKU
 */
export async function generateSKU(game: Game): Promise<string> {
  const counterRef = doc(db, 'systemConfig', 'settings');
  
  // Use transaction to ensure unique counter
  const sku = await runTransaction(db, async (transaction) => {
    const settingsDoc = await transaction.get(counterRef);
    
    let counter = 1;
    if (settingsDoc.exists()) {
      counter = (settingsDoc.data().skuCounter || 0) + 1;
    }
    
    // Update counter
    transaction.set(counterRef, { skuCounter: counter }, { merge: true });
    
    // Format SKU: VT-{GAME}-{6_DIGITS}
    const gameCode = GAME_CODES[game] || 'UNK';
    const paddedCounter = counter.toString().padStart(6, '0');
    return `VT-${gameCode}-${paddedCounter}`;
  });
  
  return sku;
}

/**
 * Create inventory item
 */
export async function createInventoryItem(
  data: Omit<InventoryItem, 'sku' | 'createdAt' | 'updatedAt' | 'priceLastUpdated'>
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
  
  await setDoc(doc(db, 'inventory', sku), inventoryItem);
  
  return sku;
}
```

---

## 4. Pricing Service Architecture

### Pricing Calculation Engine

```typescript
// lib/pricing/index.ts

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Condition, PricingRule, BinParams, RoundingParams, MarkupParams } from '@/types/inventory';

/**
 * Main pricing calculation function
 * Applies pricing rules based on market price and condition
 */
export async function calculateSellPrice(
  marketPrice: number,
  condition: Condition,
  customRules?: PricingRule[]
): Promise<number> {
  // Handle zero or invalid prices
  if (!marketPrice || marketPrice <= 0) {
    return 0;
  }
  
  // Get pricing rules from Firestore (or use custom rules)
  const rules = customRules || await getPricingRules();
  
  // Find applicable rule
  const rule = rules.find(r => 
    r.condition === condition &&
    marketPrice >= r.priceRange.min &&
    marketPrice < r.priceRange.max &&
    r.enabled
  );
  
  if (!rule) {
    // Fallback: round to nearest $0.50
    return roundToNearest(marketPrice, 0.50);
  }
  
  // Apply pricing strategy
  switch (rule.strategy) {
    case 'bin':
      return applyBinPricing(marketPrice, rule.params as BinParams);
    case 'round':
      return applyRounding(marketPrice, rule.params as RoundingParams);
    case 'markup':
      return applyMarkup(marketPrice, rule.params as MarkupParams);
    case 'fixed':
      return (rule.params as any).price;
    default:
      return marketPrice;
  }
}

/**
 * Bin pricing: Snap to predefined price points
 * Best for low-value cards (<$5) to simplify pricing
 */
function applyBinPricing(price: number, params: BinParams): number {
  const { bins } = params;
  
  // Find closest bin value
  const closest = bins.reduce((prev, curr) => 
    Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
  );
  
  return closest;
}

/**
 * Rounding: Round to nearest increment
 * Best for mid-range cards ($5-$100)
 */
function applyRounding(price: number, params: RoundingParams): number {
  const { roundTo, direction } = params;
  
  switch (direction) {
    case 'up':
      return Math.ceil(price / roundTo) * roundTo;
    case 'down':
      return Math.floor(price / roundTo) * roundTo;
    case 'nearest':
    default:
      return Math.round(price / roundTo) * roundTo;
  }
}

/**
 * Markup: Add percentage markup or discount
 * Percentage can be positive (markup) or negative (discount)
 */
function applyMarkup(price: number, params: MarkupParams): number {
  const { percentage, minProfit = 0 } = params;
  const markup = price * (percentage / 100);
  const sellPrice = price + Math.max(markup, minProfit);
  
  // Round to nearest quarter
  return roundToNearest(sellPrice, 0.25);
}

/**
 * Helper: Round to nearest increment
 */
function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

/**
 * Get pricing rules from Firestore
 */
async function getPricingRules(): Promise<PricingRule[]> {
  const rulesDoc = await getDoc(doc(db, 'pricingRules', 'default'));
  
  if (rulesDoc.exists()) {
    return rulesDoc.data().rules || DEFAULT_RULES;
  }
  
  return DEFAULT_RULES;
}

/**
 * Default pricing rules
 * These can be customized per user/store in Firestore
 */
export const DEFAULT_RULES: PricingRule[] = [
  // Near Mint (NM) - Full market price
  {
    condition: 'NM',
    priceRange: { min: 0, max: 5 },
    strategy: 'bin',
    params: { 
      bins: [0.25, 0.50, 0.75, 1.00, 1.50, 2.00, 2.50, 3.00, 4.00, 5.00] 
    },
    enabled: true,
  },
  {
    condition: 'NM',
    priceRange: { min: 5, max: 20 },
    strategy: 'round',
    params: { roundTo: 0.50, direction: 'nearest' },
    enabled: true,
  },
  {
    condition: 'NM',
    priceRange: { min: 20, max: 100 },
    strategy: 'round',
    params: { roundTo: 1.00, direction: 'nearest' },
    enabled: true,
  },
  {
    condition: 'NM',
    priceRange: { min: 100, max: Infinity },
    strategy: 'round',
    params: { roundTo: 5.00, direction: 'up' },
    enabled: true,
  },
  
  // Lightly Played (LP) - 10% discount from NM
  {
    condition: 'LP',
    priceRange: { min: 0, max: Infinity },
    strategy: 'markup',
    params: { percentage: -10 },
    enabled: true,
  },
  
  // Moderately Played (MP) - 20% discount
  {
    condition: 'MP',
    priceRange: { min: 0, max: Infinity },
    strategy: 'markup',
    params: { percentage: -20 },
    enabled: true,
  },
  
  // Heavily Played (HP) - 35% discount
  {
    condition: 'HP',
    priceRange: { min: 0, max: Infinity },
    strategy: 'markup',
    params: { percentage: -35 },
    enabled: true,
  },
  
  // Damaged (DMG) - 50% discount
  {
    condition: 'DMG',
    priceRange: { min: 0, max: Infinity },
    strategy: 'markup',
    params: { percentage: -50 },
    enabled: true,
  },
];

/**
 * Lock price at label print time
 * Once locked, price won't update with market fluctuations
 */
export async function lockSellPrice(sku: string): Promise<void> {
  const inventoryRef = doc(db, 'inventory', sku);
  await updateDoc(inventoryRef, {
    sellPriceLockedAt: new Date(),
    status: 'labeled',
  });
}
```

### JustTCG API Integration

```typescript
// lib/justtcg/client.ts

const JUSTTCG_API_URL = 'https://api.justtcg.com/v1';
const JUSTTCG_API_KEY = process.env.NEXT_PUBLIC_JUSTTCG_API_KEY;

if (!JUSTTCG_API_KEY) {
  throw new Error('JUSTTCG_API_KEY is not configured');
}

interface SearchParams {
  q?: string;              // Search query
  game?: string;          // "pokemon", "mtg", etc.
  set?: string;           // Set name
  condition?: string;     // "NM", "LP", etc.
  printing?: string;      // "Normal", "Foil", etc.
  limit?: number;         // Results limit
  offset?: number;        // Pagination offset
}

interface VariantParams {
  cardId?: string;        // JustTCG card ID
  variantId?: string;     // Specific variant ID
  tcgPlayerId?: string;   // TCGPlayer ID (for migration)
  condition?: string;
  printing?: string;
  language?: string;
}

interface BatchLookupItem {
  tcgPlayerId?: string;
  cardId?: string;
  variantId?: string;
  condition?: string;
  printing?: string;
}

/**
 * Search for cards
 * Caches results for 1 hour to minimize API calls
 */
export async function searchCards(params: SearchParams) {
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });
  
  // Always exclude price history to reduce payload size
  queryParams.append('include_price_history', 'false');
  
  // Set default limit
  if (!params.limit) {
    queryParams.append('limit', '20');
  }
  
  const cacheKey = `search:${queryParams.toString()}`;
  
  // Check cache first
  const cached = await getCachedResponse(cacheKey);
  if (cached) {
    console.log('🎯 Cache hit:', cacheKey);
    return cached;
  }
  
  console.log('🌐 Calling JustTCG API:', cacheKey);
  
  const response = await fetch(
    `${JUSTTCG_API_URL}/cards?${queryParams}`,
    {
      headers: {
        'x-api-key': JUSTTCG_API_KEY!,
      },
      next: { revalidate: 3600 }, // Next.js cache for 1 hour
    }
  );
  
  if (!response.ok) {
    throw new Error(`JustTCG API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Cache the response (1 hour TTL)
  await cacheResponse(cacheKey, data.data, 3600);
  
  return data.data;
}

/**
 * Get card variants with pricing
 * Caches for 5 minutes (pricing data)
 */
export async function getCardVariants(params: VariantParams) {
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });
  
  // Exclude price history for faster responses
  queryParams.append('include_price_history', 'false');
  
  const cacheKey = `variant:${queryParams.toString()}`;
  
  // Check cache first (5 minute TTL for pricing)
  const cached = await getCachedResponse(cacheKey);
  if (cached) {
    console.log('🎯 Cache hit:', cacheKey);
    return cached;
  }
  
  console.log('🌐 Calling JustTCG API:', cacheKey);
  
  const response = await fetch(
    `${JUSTTCG_API_URL}/cards?${queryParams}`,
    {
      headers: {
        'x-api-key': JUSTTCG_API_KEY!,
      },
      next: { revalidate: 300 }, // Next.js cache for 5 minutes
    }
  );
  
  if (!response.ok) {
    throw new Error(`JustTCG API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Extract pricing from variants
  const card = data.data[0];
  if (!card) {
    throw new Error('Card not found');
  }
  
  const variant = card.variants?.find(
    (v: any) => 
      (!params.condition || v.condition === params.condition) &&
      (!params.printing || v.printing === params.printing) &&
      (!params.language || v.language === params.language)
  );
  
  if (!variant) {
    throw new Error('Variant not found');
  }
  
  const result = {
    ...card,
    price: variant.price || 0,
    variantId: variant.id,
  };
  
  // Cache the response (5 minutes)
  await cacheResponse(cacheKey, result, 300);
  
  return result;
}

/**
 * Batch lookup for multiple cards
 * This is the MOST EFFICIENT way to update prices
 * Use this for scheduled price updates
 */
export async function batchLookup(items: BatchLookupItem[]) {
  // Note: Check JustTCG docs for exact batch endpoint
  // This may be a POST endpoint with different structure
  
  const response = await fetch(
    `${JUSTTCG_API_URL}/cards/batch`, // Verify this endpoint exists
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': JUSTTCG_API_KEY!,
      },
      body: JSON.stringify(items),
    }
  );
  
  if (!response.ok) {
    // If batch endpoint doesn't exist, fall back to multiple requests
    // But this is less efficient
    console.warn('Batch endpoint failed, falling back to individual requests');
    return await Promise.all(
      items.map(item => getCardVariants(item))
    );
  }
  
  const data = await response.json();
  return data.data;
}

// Import cache functions (defined in next section)
import { getCachedResponse, cacheResponse } from '@/lib/cache';
```

### Caching Layer (Firestore-based)

```typescript
// lib/cache/index.ts

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CacheEntry {
  data: any;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Get cached response from Firestore
 */
export async function getCachedResponse(key: string): Promise<any | null> {
  try {
    // Sanitize key for Firestore (remove special chars)
    const sanitizedKey = sanitizeFirestoreKey(key);
    
    const cacheRef = doc(db, 'priceCache', sanitizedKey);
    const cacheDoc = await getDoc(cacheRef);
    
    if (!cacheDoc.exists()) {
      return null;
    }
    
    const entry = cacheDoc.data() as CacheEntry;
    
    // Check if expired
    const expiresAt = entry.expiresAt instanceof Date 
      ? entry.expiresAt 
      : (entry.expiresAt as any).toDate();
    
    if (new Date() > expiresAt) {
      // Delete expired cache entry
      await deleteDoc(cacheRef);
      return null;
    }
    
    return entry.data;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

/**
 * Cache a response in Firestore
 */
export async function cacheResponse(
  key: string,
  data: any,
  ttlSeconds: number
): Promise<void> {
  try {
    const sanitizedKey = sanitizeFirestoreKey(key);
    const cacheRef = doc(db, 'priceCache', sanitizedKey);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    
    await setDoc(cacheRef, {
      data,
      expiresAt,
      createdAt: now,
    });
  } catch (error) {
    console.error('Cache write error:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Sanitize key for Firestore
 * Firestore doc IDs can't contain: / \ . # $ [ ]
 */
function sanitizeFirestoreKey(key: string): string {
  return key
    .replace(/[/\\\.#$\[\]]/g, '_')
    .substring(0, 1500); // Firestore doc ID limit
}
```

---

## 5. POS Integration (Square)

### Square Setup & Configuration

```typescript
// lib/square/client.ts

import { Client, Environment } from 'square';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment: IS_PRODUCTION ? Environment.Production : Environment.Sandbox,
});

/**
 * Create or update item in Square catalog
 * This syncs your inventory item to Square POS
 */
export async function createSquareItem(inventoryItem: any) {
  try {
    const response = await squareClient.catalogApi.upsertCatalogObject({
      idempotencyKey: inventoryItem.sku, // Prevents duplicates
      object: {
        type: 'ITEM',
        id: `#${inventoryItem.sku}`,
        itemData: {
          name: `${inventoryItem.cardName} - ${inventoryItem.condition}`,
          description: `${inventoryItem.setName} | ${inventoryItem.printing}`,
          variations: [
            {
              type: 'ITEM_VARIATION',
              id: `#${inventoryItem.sku}-VAR`,
              itemVariationData: {
                itemId: `#${inventoryItem.sku}`,
                name: inventoryItem.condition,
                pricingType: 'FIXED_PRICING',
                priceMoney: {
                  amount: BigInt(Math.round(inventoryItem.sellPrice * 100)), // Convert to cents
                  currency: 'USD',
                },
                sku: inventoryItem.sku,
                trackInventory: true,
              },
            },
          ],
          categoryId: getCategoryId(inventoryItem.game),
        },
      },
    });
    
    return response.result.catalogObject?.id;
  } catch (error) {
    console.error('Square catalog error:', error);
    throw error;
  }
}

/**
 * Update Square inventory quantity
 */
export async function updateSquareInventory(
  sku: string,
  quantity: number,
  locationId: string
) {
  try {
    // First, find the catalog item by SKU
    const searchResponse = await squareClient.catalogApi.searchCatalogItems({
      textFilter: {
        query: sku,
      },
    });
    
    const item = searchResponse.result.items?.[0];
    if (!item) {
      throw new Error(`Item not found in Square: ${sku}`);
    }
    
    const variationId = item.itemData?.variations?.[0]?.id;
    if (!variationId) {
      throw new Error('Variation not found');
    }
    
    // Update inventory count
    await squareClient.inventoryApi.batchChangeInventory({
      idempotencyKey: `${sku}-${Date.now()}`,
      changes: [
        {
          type: 'PHYSICAL_COUNT',
          physicalCount: {
            catalogObjectId: variationId,
            state: 'IN_STOCK',
            locationId,
            quantity: quantity.toString(),
            occurredAt: new Date().toISOString(),
          },
        },
      ],
    });
    
    console.log(`✅ Updated Square inventory: ${sku} = ${quantity}`);
  } catch (error) {
    console.error('Square inventory update error:', error);
    throw error;
  }
}

/**
 * Get Square category ID for each game
 * These should be created once in Square Dashboard
 */
function getCategoryId(game: string): string {
  const categories: Record<string, string> = {
    pokemon: process.env.SQUARE_CATEGORY_POKEMON || '',
    mtg: process.env.SQUARE_CATEGORY_MTG || '',
    onepiece: process.env.SQUARE_CATEGORY_ONEPIECE || '',
    lorcana: process.env.SQUARE_CATEGORY_LORCANA || '',
  };
  
  return categories[game as keyof typeof categories] || '';
}

/**
 * Batch create/update multiple items
 * More efficient than individual calls
 */
export async function batchUpsertSquareItems(items: any[]) {
  const catalogObjects = items.map(item => ({
    type: 'ITEM' as const,
    id: `#${item.sku}`,
    itemData: {
      name: `${item.cardName} - ${item.condition}`,
      description: `${item.setName} | ${item.printing}`,
      variations: [
        {
          type: 'ITEM_VARIATION' as const,
          id: `#${item.sku}-VAR`,
          itemVariationData: {
            itemId: `#${item.sku}`,
            name: item.condition,
            pricingType: 'FIXED_PRICING' as const,
            priceMoney: {
              amount: BigInt(Math.round(item.sellPrice * 100)),
              currency: 'USD' as const,
            },
            sku: item.sku,
            trackInventory: true,
          },
        },
      ],
      categoryId: getCategoryId(item.game),
    },
  }));
  
  // Square allows up to 1000 objects per batch
  const batches = chunk(catalogObjects, 1000);
  
  for (const batch of batches) {
    await squareClient.catalogApi.batchUpsertCatalogObjects({
      idempotencyKey: `batch-${Date.now()}`,
      batches: [
        {
          objects: batch,
        },
      ],
    });
  }
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

### Webhook Handler (Square → Firebase)

```typescript
// app/api/webhooks/square/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { adminDb } from '@/lib/firebase/admin';

const SQUARE_WEBHOOK_SECRET = process.env.SQUARE_WEBHOOK_SECRET!;
const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || 'X-Square-Signature';

/**
 * Verify Square webhook signature
 */
function verifySignature(body: string, signature: string, url: string): boolean {
  const hmac = createHmac('sha256', SQUARE_WEBHOOK_SECRET);
  const payload = url + body;
  const hash = hmac.update(payload).digest('base64');
  return hash === signature;
}

/**
 * Handle Square webhooks
 * Events: order.created, order.updated, inventory.count.updated
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get(SQUARE_WEBHOOK_SIGNATURE_KEY) || '';
  const url = request.url;
  
  // Verify webhook authenticity
  if (!verifySignature(body, signature, url)) {
    console.error('❌ Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const event = JSON.parse(body);
  
  console.log('📨 Square webhook received:', event.type);
  
  try {
    switch (event.type) {
      case 'order.created':
      case 'order.updated':
        await handleOrderEvent(event.data.object.order);
        break;
      
      case 'inventory.count.updated':
        await handleInventoryUpdate(event.data.object.inventory_counts);
        break;
      
      default:
        console.log('ℹ️  Unhandled webhook event:', event.type);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

/**
 * Handle order created/updated events
 * Creates sale record and decrements inventory
 */
async function handleOrderEvent(order: any) {
  console.log('🛒 Processing order:', order.id);
  
  // Extract line items
  const items = (order.line_items || []).map((item: any) => {
    const sku = item.note || extractSkuFromName(item.name);
    
    return {
      sku,
      cardName: item.name,
      quantity: parseInt(item.quantity || 1),
      sellPrice: parseInt(item.base_price_money?.amount || 0) / 100,
      costBasis: 0, // Will be looked up
    };
  });
  
  // Look up cost basis for each item
  for (const item of items) {
    const inventoryDoc = await getDoc(doc(adminDb, 'inventory', item.sku));
    if (inventoryDoc.exists()) {
      item.costBasis = inventoryDoc.data().costBasis || 0;
    }
  }
  
  // Calculate total profit
  const profit = items.reduce((sum, item) => {
    return sum + ((item.sellPrice - item.costBasis) * item.quantity);
  }, 0);
  
  // Create sale record
  await setDoc(doc(adminDb, 'sales', order.id), {
    squareOrderId: order.id,
    items,
    subtotal: parseInt(order.total_money?.amount || 0) / 100,
    tax: parseInt(order.total_tax_money?.amount || 0) / 100,
    total: parseInt(order.total_money?.amount || 0) / 100,
    paymentMethod: order.tenders?.[0]?.type || 'unknown',
    saleDate: new Date(order.created_at),
    profit,
  });
  
  // Decrement inventory quantities
  for (const item of items) {
    try {
      const inventoryRef = doc(adminDb, 'inventory', item.sku);
      const inventoryDoc = await getDoc(inventoryRef);
      
      if (inventoryDoc.exists()) {
        const currentQty = inventoryDoc.data().quantity || 0;
        const newQty = Math.max(0, currentQty - item.quantity);
        
        await updateDoc(inventoryRef, {
          quantity: newQty,
          updatedAt: new Date(),
        });
        
        console.log(`📉 Decremented ${item.sku}: ${currentQty} → ${newQty}`);
      }
    } catch (error) {
      console.error(`Failed to update inventory for ${item.sku}:`, error);
    }
  }
  
  console.log('✅ Order processed:', order.id);
}

/**
 * Handle inventory count updates
 */
async function handleInventoryUpdate(counts: any[]) {
  for (const count of counts) {
    // Note: Square inventory updates might not include SKU directly
    // You may need to map catalog_object_id to SKU
    const catalogObjectId = count.catalog_object_id;
    const quantity = parseInt(count.quantity || 0);
    
    // This requires maintaining a mapping of catalog IDs to SKUs
    // For simplicity, you might skip this and rely on your own inventory management
    
    console.log('📊 Inventory update:', catalogObjectId, quantity);
  }
}

/**
 * Extract SKU from item name if not in note field
 */
function extractSkuFromName(name: string): string {
  const match = name.match(/VT-[A-Z]{3}-\d{6}/);
  return match ? match[0] : '';
}
```

---

## 6. Rate Limiting & Caching Strategy

### Rate Limit Management

**JustTCG API Plans** (as of 2026):
- Hobby: 1,000 requests/month (~33/day)
- Pro: 10,000 requests/month (~333/day)
- Enterprise: 100,000+ requests/month

**Strategy**: Minimize API calls through:
1. Aggressive caching (Firestore + Next.js)
2. Batch lookups for price updates
3. Lock prices at label-print time
4. Rate limit tracking

```typescript
// lib/rate-limit/index.ts

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface RateLimitState {
  requestCount: number;
  resetDate: Date;
  plan: 'hobby' | 'pro' | 'enterprise';
  limit: number;
}

const PLAN_LIMITS = {
  hobby: 1000,
  pro: 10000,
  enterprise: 100000,
};

/**
 * Check if we can make an API call
 * Leaves 10% buffer to avoid hitting hard limit
 */
export async function canMakeRequest(): Promise<boolean> {
  const stateRef = doc(db, 'systemConfig', 'rateLimitState');
  const stateDoc = await getDoc(stateRef);
  
  if (!stateDoc.exists()) {
    // Initialize on first use
    await setDoc(stateRef, {
      requestCount: 0,
      resetDate: getMonthEnd(),
      plan: 'pro', // Configure your plan here
      limit: PLAN_LIMITS.pro,
    });
    return true;
  }
  
  const state = stateDoc.data() as RateLimitState;
  const resetDate = state.resetDate instanceof Date 
    ? state.resetDate 
    : (state.resetDate as any).toDate();
  
  // Check if reset needed (new month)
  if (new Date() > resetDate) {
    await updateDoc(stateRef, {
      requestCount: 0,
      resetDate: getMonthEnd(),
    });
    return true;
  }
  
  // Leave 10% buffer
  const safeLimit = state.limit * 0.9;
  return state.requestCount < safeLimit;
}

/**
 * Increment request counter
 */
export async function incrementRequestCount(count: number = 1): Promise<void> {
  const stateRef = doc(db, 'systemConfig', 'rateLimitState');
  const stateDoc = await getDoc(stateRef);
  
  if (stateDoc.exists()) {
    const currentCount = stateDoc.data().requestCount || 0;
    await updateDoc(stateRef, {
      requestCount: currentCount + count,
    });
    
    console.log(`📊 API requests used: ${currentCount + count}`);
  }
}

/**
 * Get current rate limit status
 */
export async function getRateLimitStatus(): Promise<{
  used: number;
  limit: number;
  remaining: number;
  resetDate: Date;
  percentUsed: number;
}> {
  const stateRef = doc(db, 'systemConfig', 'rateLimitState');
  const stateDoc = await getDoc(stateRef);
  
  if (!stateDoc.exists()) {
    return {
      used: 0,
      limit: PLAN_LIMITS.pro,
      remaining: PLAN_LIMITS.pro,
      resetDate: getMonthEnd(),
      percentUsed: 0,
    };
  }
  
  const state = stateDoc.data() as RateLimitState;
  const resetDate = state.resetDate instanceof Date 
    ? state.resetDate 
    : (state.resetDate as any).toDate();
  
  return {
    used: state.requestCount,
    limit: state.limit,
    remaining: state.limit - state.requestCount,
    resetDate,
    percentUsed: (state.requestCount / state.limit) * 100,
  };
}

/**
 * Get end of current month
 */
function getMonthEnd(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
}
```

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                   CACHING LAYERS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Next.js Cache (1 hour)                           │
│    - Card metadata search results                          │
│    - Set listings                                          │
│    - Static card data                                      │
│                                                             │
│  Layer 2: Firestore Cache (5 minutes)                      │
│    - Variant pricing data                                  │
│    - Active inventory prices                               │
│    - Market price snapshots                                │
│                                                             │
│  Layer 3: Locked Prices (Permanent)                        │
│    - Labeled inventory items                               │
│    - Price locked at label print time                      │
│    - Won't change with market fluctuations                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘

API Call Minimization:
✅ Search results cached 1 hour
✅ Pricing data cached 5 minutes
✅ Batch updates (100 items = 1 API call)
✅ Labeled items never re-priced
✅ Scheduled updates instead of on-demand
```

### Batch Price Updates (Firebase Cloud Function)

```typescript
// functions/src/scheduled/updatePrices.ts

import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';
import { batchLookup } from '../lib/justtcg';
import { canMakeRequest, incrementRequestCount } from '../lib/rate-limit';

/**
 * Scheduled function: Run every 6 hours
 * Updates market prices for unlocked inventory items
 */
export const updateMarketPrices = functions.pubsub
  .schedule('0 */6 * * *') // Every 6 hours at :00
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('🔄 Starting scheduled price update');
    
    const db = firestore();
    
    // Check rate limit
    if (!await canMakeRequest()) {
      console.warn('⚠️  Rate limit reached, skipping update');
      return null;
    }
    
    // Get unlocked inventory items that need pricing update
    // Only update items that:
    // 1. Are not labeled (price not locked)
    // 2. Haven't been updated in last 6 hours
    const staleThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    const snapshot = await db.collection('inventory')
      .where('status', '!=', 'labeled')
      .where('priceLastUpdated', '<', staleThreshold)
      .limit(100) // Process in batches
      .get();
    
    if (snapshot.empty) {
      console.log('✅ No items need updating');
      return null;
    }
    
    console.log(`📊 Found ${snapshot.docs.length} items to update`);
    
    // Prepare batch lookup
    const lookupItems = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        cardId: data.cardId,
        condition: data.condition,
        printing: data.printing,
      };
    });
    
    // Call JustTCG batch API (1 request for up to 100 items!)
    const results = await batchLookup(lookupItems);
    await incrementRequestCount(1); // Count as 1 API call
    
    // Update prices in Firestore
    const batch = db.batch();
    const now = firestore.FieldValue.serverTimestamp();
    
    snapshot.docs.forEach((doc, index) => {
      const newPrice = results[index]?.price || doc.data().marketPrice;
      
      batch.update(doc.ref, {
        marketPrice: newPrice,
        priceLastUpdated: now,
      });
      
      // Log price history
      const historyRef = db.collection(`priceHistory/${doc.id}/history`).doc();
      batch.set(historyRef, {
        marketPrice: newPrice,
        source: 'justtcg',
        timestamp: now,
      });
    });
    
    await batch.commit();
    
    console.log(`✅ Updated ${snapshot.docs.length} prices`);
    return null;
  });

/**
 * Cleanup expired cache entries (run daily)
 */
export const cleanupExpiredCache = functions.pubsub
  .schedule('0 3 * * *') // Daily at 3am
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('🧹 Cleaning up expired cache');
    
    const db = firestore();
    const now = new Date();
    
    const snapshot = await db.collection('priceCache')
      .where('expiresAt', '<', now)
      .limit(500)
      .get();
    
    if (snapshot.empty) {
      console.log('✅ No expired cache entries');
      return null;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    console.log(`🗑️  Deleted ${snapshot.docs.length} expired cache entries`);
    return null;
  });
```

---

## 7. Label System & Print Formats

### Label Design Specification

```
┌────────────────────────────────────────┐
│  VaultTrove                            │  ← Store branding (8pt)
├────────────────────────────────────────┤
│  Charizard                             │  ← Card name (10pt bold)
│  Base Set (Unlimited Holofoil)        │  ← Set + printing (7pt)
│  Holo Rare                             │  ← Rarity (7pt)
├────────────────────────────────────────┤
│  NM      $75.00                        │  ← Condition + Price (16pt)
├────────────────────────────────────────┤
│  ▐▌▐▌▌▐▐▌▐▌▐▌▐▌▌▐▐▌▐▌▐▌▐▌▌            │  ← Barcode (Code128)
│  VT-PKM-001234                         │  ← SKU (8pt Courier)
└────────────────────────────────────────┘

Label Sizes:
- Standard: 2" x 1" (most singles)
- Large: 2.25" x 1.25" (oversized cards, special products)
- Avery 5160 compatible (30 labels per sheet)
```

### Label Generator

```typescript
// lib/labels/generator.ts

import { jsPDF } from 'jspdf';
import bwipjs from 'bwip-js';
import { InventoryItem } from '@/types/inventory';

export interface LabelTemplate {
  width: number;      // inches
  height: number;     // inches
  fontSize: {
    storeName: number;
    cardName: number;
    setInfo: number;
    price: number;
    sku: number;
  };
  padding: number;    // inches
  labelsPerRow: number;
  labelsPerCol: number;
}

export const LABEL_TEMPLATES: Record<string, LabelTemplate> = {
  standard: {
    width: 2.0,
    height: 1.0,
    fontSize: { storeName: 8, cardName: 10, setInfo: 7, price: 16, sku: 8 },
    padding: 0.1,
    labelsPerRow: 3,
    labelsPerCol: 10,
  },
  large: {
    width: 2.25,
    height: 1.25,
    fontSize: { storeName: 8, cardName: 12, setInfo: 8, price: 18, sku: 8 },
    padding: 0.12,
    labelsPerRow: 3,
    labelsPerCol: 8,
  },
  avery5160: {
    width: 2.625,
    height: 1.0,
    fontSize: { storeName: 8, cardName: 10, setInfo: 7, price: 16, sku: 8 },
    padding: 0.1,
    labelsPerRow: 3,
    labelsPerCol: 10,
  },
};

/**
 * Generate label PDF for printing
 */
export async function generateLabelPDF(
  items: InventoryItem[],
  templateName: keyof typeof LABEL_TEMPLATES = 'standard'
): Promise<Blob> {
  const template = LABEL_TEMPLATES[templateName];
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter', // 8.5" x 11"
  });
  
  const { labelsPerRow, labelsPerCol } = template;
  const labelsPerPage = labelsPerRow * labelsPerCol;
  
  let currentLabel = 0;
  
  for (const item of items) {
    // Add new page if needed
    if (currentLabel > 0 && currentLabel % labelsPerPage === 0) {
      pdf.addPage();
    }
    
    // Calculate position
    const labelIndex = currentLabel % labelsPerPage;
    const row = Math.floor(labelIndex / labelsPerRow);
    const col = labelIndex % labelsPerRow;
    
    const x = col * template.width;
    const y = row * template.height;
    
    // Draw label
    await drawLabel(pdf, item, x, y, template);
    
    currentLabel++;
  }
  
  return pdf.output('blob');
}

/**
 * Draw single label on PDF
 */
async function drawLabel(
  pdf: jsPDF,
  item: InventoryItem,
  x: number,
  y: number,
  template: LabelTemplate
): Promise<void> {
  const { width, height, fontSize, padding } = template;
  
  // Optional: Draw border for debugging
  // pdf.setDrawColor(200, 200, 200);
  // pdf.rect(x, y, width, height);
  
  let currentY = y + padding + 0.1;
  
  // Store name
  pdf.setFontSize(fontSize.storeName);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('VaultTrove', x + padding, currentY);
  currentY += 0.15;
  
  // Card name (truncate if too long)
  pdf.setFontSize(fontSize.cardName);
  pdf.setFont('helvetica', 'bold');
  const cardName = truncateText(item.cardName, 25);
  pdf.text(cardName, x + padding, currentY);
  currentY += 0.15;
  
  // Set name + printing
  pdf.setFontSize(fontSize.setInfo);
  pdf.setFont('helvetica', 'normal');
  const setInfo = `${item.setName} (${item.printing})`;
  pdf.text(truncateText(setInfo, 30), x + padding, currentY);
  currentY += 0.12;
  
  // Rarity (if available, would need to add to data model)
  // pdf.text(item.rarity || '', x + padding, currentY);
  // currentY += 0.12;
  
  // Condition + Price
  pdf.setFontSize(fontSize.price);
  pdf.setFont('helvetica', 'bold');
  const priceText = `${item.condition}    $${item.sellPrice.toFixed(2)}`;
  pdf.text(priceText, x + padding, currentY);
  currentY += 0.25;
  
  // Generate barcode
  const barcodeCanvas = document.createElement('canvas');
  
  try {
    bwipjs.toCanvas(barcodeCanvas, {
      bcid: 'code128',       // Barcode type
      text: item.sku,        // SKU text
      scale: 3,              // 3x scaling factor
      height: 8,             // Bar height, in millimeters
      includetext: false,    // Don't show text below barcode
      textxalign: 'center',
    });
    
    // Add barcode to PDF
    const barcodeImg = barcodeCanvas.toDataURL('image/png');
    const barcodeWidth = width - (padding * 2);
    const barcodeHeight = 0.25;
    pdf.addImage(barcodeImg, 'PNG', x + padding, currentY, barcodeWidth, barcodeHeight);
    currentY += barcodeHeight + 0.05;
  } catch (error) {
    console.error('Barcode generation error:', error);
    // Continue without barcode
  }
  
  // SKU text
  pdf.setFontSize(fontSize.sku);
  pdf.setFont('courier', 'normal');
  pdf.text(item.sku, x + width / 2, currentY, { align: 'center' });
}

/**
 * Truncate text to fit label
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generate labels and return download URL
 */
export async function generateAndSaveLabels(
  items: InventoryItem[],
  templateName: keyof typeof LABEL_TEMPLATES = 'standard'
): Promise<string> {
  const pdfBlob = await generateLabelPDF(items, templateName);
  
  // Create download URL
  const url = URL.createObjectURL(pdfBlob);
  
  return url;
}
```

### Label Printing Page

```typescript
// app/labels/print/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { generateAndSaveLabels, LABEL_TEMPLATES } from '@/lib/labels/generator';
import { lockSellPrice } from '@/lib/pricing';
import { InventoryItem } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export default function PrintLabelsPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState<keyof typeof LABEL_TEMPLATES>('standard');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadInventory();
  }, []);
  
  const loadInventory = async () => {
    try {
      // Get all items with status 'priced' (ready for labeling)
      const inventoryRef = collection(db, 'inventory');
      const q = query(inventoryRef, where('status', '==', 'priced'));
      const snapshot = await getDocs(q);
      
      const items = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as InventoryItem[];
      
      setInventory(items);
    } catch (error) {
      toast.error('Failed to load inventory');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSkus(inventory.map(item => item.sku));
    } else {
      setSelectedSkus([]);
    }
  };
  
  const handleToggle = (sku: string, checked: boolean) => {
    if (checked) {
      setSelectedSkus(prev => [...prev, sku]);
    } else {
      setSelectedSkus(prev => prev.filter(s => s !== sku));
    }
  };
  
  const handlePrint = async () => {
    if (selectedSkus.length === 0) {
      toast.error('Please select at least one item');
      return;
    }
    
    setGenerating(true);
    
    try {
      // Get selected items
      const selectedItems = inventory.filter(item => 
        selectedSkus.includes(item.sku)
      );
      
      // Generate PDF
      const downloadUrl = await generateAndSaveLabels(selectedItems, templateName);
      
      // Download PDF
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `labels-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
      
      // Lock prices and update status
      const batch = writeBatch(db);
      selectedItems.forEach(item => {
        const itemRef = doc(db, 'inventory', item.sku);
        batch.update(itemRef, {
          sellPriceLockedAt: new Date(),
          status: 'labeled',
        });
      });
      await batch.commit();
      
      toast.success(`Generated ${selectedItems.length} labels`);
      
      // Reload inventory
      await loadInventory();
      setSelectedSkus([]);
    } catch (error) {
      toast.error('Failed to generate labels');
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };
  
  if (loading) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }
  
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Print Labels</h1>
      
      <div className="mb-6 flex items-center gap-4">
        <Select value={templateName} onValueChange={(v: any) => setTemplateName(v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard (2" x 1")</SelectItem>
            <SelectItem value="large">Large (2.25" x 1.25")</SelectItem>
            <SelectItem value="avery5160">Avery 5160</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          onClick={handlePrint}
          disabled={selectedSkus.length === 0 || generating}
          size="lg"
        >
          {generating ? 'Generating...' : `Print ${selectedSkus.length} Labels`}
        </Button>
      </div>
      
      {inventory.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No items ready for labeling. Add items in the intake page.
        </div>
      ) : (
        <div className="border rounded-lg">
          <div className="p-4 border-b bg-muted/50 flex items-center gap-3">
            <Checkbox
              checked={selectedSkus.length === inventory.length}
              onCheckedChange={handleSelectAll}
            />
            <span className="font-medium">
              Select All ({inventory.length} items)
            </span>
          </div>
          
          <div className="divide-y">
            {inventory.map(item => (
              <div key={item.sku} className="p-4 flex items-center gap-4 hover:bg-muted/50">
                <Checkbox
                  checked={selectedSkus.includes(item.sku)}
                  onCheckedChange={(checked) => handleToggle(item.sku, checked as boolean)}
                />
                
                <div className="flex-1">
                  <div className="font-medium">{item.cardName}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.setName} | {item.condition} | {item.printing}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-bold text-lg">${item.sellPrice.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">{item.sku}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 8. Show Mode vs Store Mode

### Operating Mode Types

```typescript
// types/modes.ts

export type OperatingMode = 'show' | 'store';

export interface ShowModeConfig {
  priceDisplay: 'full' | 'rounded' | 'hidden';
  discountEnabled: boolean;
  discountPercentage: number;         // e.g., 10 for 10% off
  cashOnlyDiscount: number;           // Additional discount for cash
  binPricing: boolean;                // Use simple bins for faster checkout
  taxIncluded: boolean;               // Include tax in displayed price
}

export interface StoreModeConfig {
  priceDisplay: 'full';
  taxRate: number;                    // e.g., 0.06 for 6%
  squareIntegration: boolean;
  inventoryTracking: boolean;
  autoSync: boolean;                  // Auto-sync with Square
}

export interface ModeSettings {
  currentMode: OperatingMode;
  show: ShowModeConfig;
  store: StoreModeConfig;
}
```

### Mode Configuration Service

```typescript
// lib/modes/config.ts

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ModeSettings, OperatingMode } from '@/types/modes';

/**
 * Default mode settings
 */
export const DEFAULT_SETTINGS: ModeSettings = {
  currentMode: 'store',
  show: {
    priceDisplay: 'rounded',
    discountEnabled: true,
    discountPercentage: 10,
    cashOnlyDiscount: 5,
    binPricing: true,
    taxIncluded: true,
  },
  store: {
    priceDisplay: 'full',
    taxRate: 0.06,
    squareIntegration: true,
    inventoryTracking: true,
    autoSync: true,
  },
};

/**
 * Get current mode settings
 */
export async function getModeSettings(): Promise<ModeSettings> {
  const settingsRef = doc(db, 'systemConfig', 'modeSettings');
  const settingsDoc = await getDoc(settingsRef);
  
  if (!settingsDoc.exists()) {
    // Initialize with defaults
    await setDoc(settingsRef, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  
  return settingsDoc.data() as ModeSettings;
}

/**
 * Switch operating mode
 */
export async function switchMode(mode: OperatingMode): Promise<void> {
  const settingsRef = doc(db, 'systemConfig', 'modeSettings');
  await updateDoc(settingsRef, { currentMode: mode });
}

/**
 * Update show mode settings
 */
export async function updateShowSettings(settings: Partial<ShowModeConfig>): Promise<void> {
  const settingsRef = doc(db, 'systemConfig', 'modeSettings');
  await updateDoc(settingsRef, {
    show: settings,
  });
}

/**
 * Update store mode settings
 */
export async function updateStoreSettings(settings: Partial<StoreModeConfig>): Promise<void> {
  const settingsRef = doc(db, 'systemConfig', 'modeSettings');
  await updateDoc(settingsRef, {
    store: settings,
  });
}

/**
 * Apply mode-specific pricing
 */
export function applyModePricing(
  basePrice: number,
  mode: OperatingMode,
  settings: ModeSettings,
  paymentMethod?: 'cash' | 'card'
): number {
  if (mode === 'store') {
    // Store mode: use exact price
    return basePrice;
  }
  
  // Show mode: apply discounts and rounding
  let price = basePrice;
  
  // Apply bin pricing for faster transactions
  if (settings.show.binPricing) {
    price = snapToBin(price, SHOW_BINS);
  }
  
  // Apply general discount
  if (settings.show.discountEnabled) {
    price = price * (1 - settings.show.discountPercentage / 100);
  }
  
  // Apply cash discount
  if (paymentMethod === 'cash' && settings.show.cashOnlyDiscount > 0) {
    price = price * (1 - settings.show.cashOnlyDiscount / 100);
  }
  
  // Round to nearest quarter
  return roundToNearest(price, 0.25);
}

/**
 * Show mode bins: Simpler price points for faster checkout
 */
const SHOW_BINS = [
  0.25, 0.50, 1.00, 2.00, 3.00, 5.00,
  10.00, 15.00, 20.00, 25.00, 50.00, 100.00, 150.00, 200.00
];

/**
 * Snap price to nearest bin
 */
function snapToBin(price: number, bins: number[]): number {
  return bins.reduce((prev, curr) =>
    Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
  );
}

/**
 * Round to nearest increment
 */
function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}
```

### Mode Switcher Component

```typescript
// components/ModeSwitcher.tsx

'use client';

import { useState, useEffect } from 'react';
import { Store, Tent, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { getModeSettings, switchMode } from '@/lib/modes/config';
import { OperatingMode } from '@/types/modes';

export function ModeSwitcher() {
  const [currentMode, setCurrentMode] = useState<OperatingMode>('store');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    try {
      const settings = await getModeSettings();
      setCurrentMode(settings.currentMode);
    } catch (error) {
      console.error('Failed to load mode settings:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleModeChange = async (checked: boolean) => {
    const newMode: OperatingMode = checked ? 'show' : 'store';
    setCurrentMode(newMode);
    
    try {
      await switchMode(newMode);
      toast.success(`Switched to ${newMode.toUpperCase()} mode`);
    } catch (error) {
      toast.error('Failed to switch mode');
      // Revert on error
      setCurrentMode(currentMode);
    }
  };
  
  if (loading) return null;
  
  return (
    <div className="flex items-center gap-3 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-2">
        <Store className={`w-5 h-5 ${currentMode === 'store' ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className={`font-medium ${currentMode === 'store' ? '' : 'text-muted-foreground'}`}>
          Store Mode
        </span>
      </div>
      
      <Switch
        checked={currentMode === 'show'}
        onCheckedChange={handleModeChange}
      />
      
      <div className="flex items-center gap-2">
        <Tent className={`w-5 h-5 ${currentMode === 'show' ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className={`font-medium ${currentMode === 'show' ? '' : 'text-muted-foreground'}`}>
          Show Mode
        </span>
      </div>
      
      {currentMode === 'show' && (
        <div className="ml-auto text-sm text-muted-foreground flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          Show pricing active (10% off, cash discounts enabled)
        </div>
      )}
    </div>
  );
}
```

### Mode Comparison Table

| Feature | **Store Mode** | **Show Mode** |
|---------|---------------|--------------|
| **Pricing** | Exact market-based | Rounded to bins for speed |
| **Discounts** | Individual promotions | Blanket % off (e.g., 10%) |
| **Cash Discount** | Optional | Encouraged (5% extra) |
| **Square Integration** | Full real-time sync | Manual/batch after show |
| **Inventory Tracking** | Real-time | Batch updates after show |
| **Price Display** | $12.47 | $12.50 or $15 |
| **Tax** | Calculated at checkout | Included in price |
| **Speed** | Normal checkout | Fast (rounded prices) |
| **Use Case** | Permanent store | Conventions, shows, events |

---

## 9. Implementation Guide

### Step 1: Project Setup

```bash
# Create Next.js app
npx create-next-app@latest vaulttrove --typescript --tailwind --app

cd vaulttrove

# Install Firebase
npm install firebase firebase-admin

# Install Square SDK
npm install square

# Install form libraries
npm install react-hook-form @hookform/resolvers zod

# Install PDF generation
npm install jspdf bwip-js

# Install UI libraries
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-checkbox
npm install sonner  # Toast notifications
npm install date-fns  # Date utilities
npm install lucide-react  # Icons

# Dev dependencies
npm install -D @types/bwip-js
```

### Step 2: Environment Variables

Create `.env.local`:

```bash
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Admin (server-side only - never expose in client)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# JustTCG API
NEXT_PUBLIC_JUSTTCG_API_KEY=your_justtcg_api_key

# Square
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_WEBHOOK_SECRET=your_webhook_secret
SQUARE_LOCATION_ID=your_location_id

# Square Categories (create these in Square Dashboard first)
SQUARE_CATEGORY_POKEMON=category_id_pokemon
SQUARE_CATEGORY_MTG=category_id_mtg
SQUARE_CATEGORY_ONEPIECE=category_id_onepiece
SQUARE_CATEGORY_LORCANA=category_id_lorcana
```

### Step 3: Firebase Initialization

```typescript
// lib/firebase/client.ts

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
```

```typescript
// lib/firebase/admin.ts (server-side only)

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const adminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
    // Replace escaped newlines
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
};

const adminApp = getApps().length === 0 
  ? initializeApp(adminConfig, 'admin') 
  : getApps()[0];

export const adminDb = getFirestore(adminApp);
```

### Step 4: Firebase Security Rules

Create `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Cards collection (cached data from JustTCG)
    match /cards/{cardId} {
      allow read: if true;  // Public read
      allow write: if isAdmin();
    }
    
    // Inventory
    match /inventory/{sku} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdmin();
    }
    
    // Price history
    match /priceHistory/{sku}/history/{entry} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // Sales
    match /sales/{saleId} {
      allow read, write: if isAdmin();
    }
    
    // Pricing rules
    match /pricingRules/{ruleId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // Price cache
    match /priceCache/{cacheKey} {
      allow read, write: if isAdmin();
    }
    
    // System config
    match /systemConfig/{doc} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // Users
    match /users/{userId} {
      allow read: if request.auth.uid == userId || isAdmin();
      allow write: if request.auth.uid == userId || isAdmin();
    }
  }
}
```

Deploy rules:

```bash
firebase deploy --only firestore:rules
```

### Step 5: Firestore Indexes

Create `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "inventory",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "priceLastUpdated", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "inventory",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "game", "order": "ASCENDING" },
        { "fieldPath": "marketPrice", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "inventory",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "sales",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "saleDate", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy indexes:

```bash
firebase deploy --only firestore:indexes
```

### Step 6: Directory Structure

```
vaulttrove/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── intake/
│   │   └── page.tsx
│   ├── inventory/
│   │   ├── page.tsx
│   │   └── [sku]/
│   │       └── page.tsx
│   ├── labels/
│   │   └── print/
│   │       └── page.tsx
│   ├── sales/
│   │   └── page.tsx
│   ├── settings/
│   │   ├── page.tsx
│   │   ├── pricing/
│   │   │   └── page.tsx
│   │   └── modes/
│   │       └── page.tsx
│   └── api/
│       ├── webhooks/
│       │   └── square/
│       │       └── route.ts
│       └── pricing/
│           └── update/
│               └── route.ts
├── components/
│   ├── ui/                    # shadcn components
│   ├── intake/
│   │   ├── SearchBar.tsx
│   │   ├── SearchResults.tsx
│   │   ├── CardPreview.tsx
│   │   ├── VariantSelector.tsx
│   │   ├── AcquisitionDetails.tsx
│   │   └── PricingDisplay.tsx
│   ├── inventory/
│   │   └── InventoryTable.tsx
│   ├── ModeSwitcher.tsx
│   └── Navigation.tsx
├── lib/
│   ├── firebase/
│   │   ├── client.ts
│   │   ├── admin.ts
│   │   └── inventory.ts
│   ├── justtcg/
│   │   └── client.ts
│   ├── square/
│   │   └── client.ts
│   ├── pricing/
│   │   ├── index.ts
│   │   └── batch-updater.ts
│   ├── labels/
│   │   └── generator.ts
│   ├── cache/
│   │   └── index.ts
│   ├── rate-limit/
│   │   └── index.ts
│   └── modes/
│       └── config.ts
├── types/
│   ├── inventory.ts
│   └── modes.ts
├── functions/                  # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts
│   │   ├── scheduled/
│   │   │   └── updatePrices.ts
│   │   └── lib/
│   │       ├── justtcg.ts
│   │       └── rate-limit.ts
│   ├── package.json
│   └── tsconfig.json
├── public/
├── .env.local
├── next.config.js
├── package.json
├── tsconfig.json
├── firestore.rules
└── firestore.indexes.json
```

### Step 7: Deployment Checklist

#### Firebase Setup

1. Create Firebase project: https://console.firebase.google.com
2. Enable Firestore
3. Enable Authentication (Email/Password)
4. Enable Cloud Functions
5. Enable Storage
6. Set up billing for Cloud Functions
7. Deploy security rules: `firebase deploy --only firestore:rules`
8. Deploy indexes: `firebase deploy --only firestore:indexes`

#### JustTCG Setup

1. Sign up: https://justtcg.com
2. Choose plan (Pro recommended for stores)
3. Get API key from dashboard
4. Add to `.env.local`
5. Test endpoints

#### Square Setup

1. Create account: https://developer.squareup.com
2. Create application
3. Get access token (Production or Sandbox)
4. Set up webhooks:
   - URL: `https://yourdomain.com/api/webhooks/square`
   - Events: `order.created`, `order.updated`, `inventory.count.updated`
5. Create product categories in Square Dashboard
6. Get category IDs
7. Add to `.env.local`

#### Vercel Deployment

1. Connect GitHub repo
2. Add environment variables in Vercel dashboard
3. Deploy
4. Set up custom domain (optional)

#### Testing

- [ ] Test intake flow end-to-end
- [ ] Verify pricing calculations
- [ ] Test label generation
- [ ] Verify Square sync
- [ ] Test webhook handlers
- [ ] Test both operating modes
- [ ] Verify rate limiting
- [ ] Test cache expiration
- [ ] Test batch price updates

---

## 10. Error Handling & Monitoring

### Error Handling Patterns

```typescript
// lib/justtcg/error-handler.ts

export class JustTCGError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message);
    this.name = 'JustTCGError';
  }
}

export async function handleJustTCGRequest<T>(
  fetchFn: () => Promise<Response>
): Promise<T> {
  try {
    const response = await fetchFn();
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      
      switch (response.status) {
        case 401:
          throw new JustTCGError('Invalid API key', 401, error);
        case 429:
          throw new JustTCGError('Rate limit exceeded', 429, error);
        case 404:
          throw new JustTCGError('Resource not found', 404, error);
        default:
          throw new JustTCGError(
            `API error: ${response.status}`,
            response.status,
            error
          );
      }
    }
    
    const data = await response.json();
    return data.data as T;
  } catch (error) {
    if (error instanceof JustTCGError) {
      throw error;
    }
    throw new JustTCGError('Network error', 0, error);
  }
}

/**
 * Fallback pricing when JustTCG is unavailable
 */
export async function getPriceWithFallback(
  cardId: string,
  condition: string,
  printing: string
): Promise<number> {
  try {
    // Try JustTCG first
    const variant = await getCardVariants({ cardId, condition, printing });
    return variant.price;
  } catch (error) {
    console.error('JustTCG error, using fallback:', error);
    
    // Fallback 1: Use last known price from Firestore
    const inventoryRef = collection(db, 'inventory');
    const q = query(
      inventoryRef,
      where('cardId', '==', cardId),
      where('condition', '==', condition),
      where('printing', '==', printing),
      orderBy('priceLastUpdated', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].data().marketPrice;
    }
    
    // Fallback 2: Return 0 and flag for manual pricing
    return 0;
  }
}
```

### Monitoring Dashboard

```typescript
// app/admin/dashboard/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { getRateLimitStatus } from '@/lib/rate-limit';
import { Card } from '@/components/ui/card';

export default function AdminDashboard() {
  const [rateLimit, setRateLimit] = useState<any>(null);
  
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);
  
  const loadStats = async () => {
    const status = await getRateLimitStatus();
    setRateLimit(status);
  };
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Rate Limit Status */}
        <Card className="p-6">
          <h3 className="font-semibold mb-2">JustTCG API Usage</h3>
          {rateLimit && (
            <>
              <div className="text-3xl font-bold">{rateLimit.used}</div>
              <div className="text-sm text-muted-foreground">
                of {rateLimit.limit} requests ({rateLimit.percentUsed.toFixed(1)}%)
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(rateLimit.percentUsed, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Resets: {new Date(rateLimit.resetDate).toLocaleDateString()}
              </div>
            </>
          )}
        </Card>
        
        {/* Add more dashboard cards */}
      </div>
    </div>
  );
}
```

---

## Summary & Next Steps

### What You've Got

✅ **Complete intake workflow** with card search, condition selection, and SKU generation  
✅ **JustTCG pricing integration** with smart caching and fallbacks  
✅ **Flexible pricing rules** (bins for <$5, rounding, markup/discounts)  
✅ **Price locking** at label-print time  
✅ **Firebase backend** with Firestore for scalability  
✅ **Square POS integration** with webhooks for auto-sync  
✅ **Rate-limit management** to stay within API quotas  
✅ **Batch price updates** via scheduled Cloud Functions  
✅ **Professional label generation** with barcodes  
✅ **Dual operating modes** (Store/Show)  
✅ **Error handling** and fallback strategies  

### Development Timeline

**Week 1-2: MVP**
- Set up Firebase + Next.js
- Build intake flow
- Implement JustTCG integration
- Basic inventory management

**Week 3-4: POS Integration**
- Square API setup
- Webhook handlers
- Label generation
- Batch operations

**Week 5-6: Polish & Deploy**
- Show/Store mode switcher
- Admin dashboard
- Testing
- Deployment

### Critical Success Factors

1. **Cache Aggressively**: Use all 3 caching layers to minimize API calls
2. **Batch Everything**: Update prices in batches of 100 (1 API call)
3. **Lock Prices**: Once labeled, prices don't change
4. **Monitor Rate Limits**: Track usage to avoid hitting quota
5. **Test Webhooks**: Ensure Square syncs correctly
6. **Backup Pricing**: Have fallbacks when API is unavailable

### Estimated Costs (Monthly)

- **Vercel**: Free tier (likely sufficient)
- **Firebase**: $25-50 (Firestore + Functions)
- **JustTCG API**: $29-99 (Pro plan recommended)
- **Square**: Transaction fees only
- **Total**: ~$75-200/month

**Ready to build? Let me know if you need any clarification or want to dive deeper into any section!** 🚀
