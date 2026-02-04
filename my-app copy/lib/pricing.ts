// lib/pricing.ts - FIXED with condition-based pricing

import { db } from './firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface PricingBreakdown {
  marketPrice: number;
  costBasis: number;
  sellPrice: number;
  profit: number;
  profitPercentage: number;
  acquisitionType: string;
  condition: string;
}

// Default condition multipliers for buy price
const DEFAULT_CONDITION_MULTIPLIERS: Record<string, number> = {
  'NM': 0.70,  // 70% for Near Mint
  'LP': 0.65,  // 65% for Lightly Played
  'MP': 0.55,  // 55% for Moderately Played
  'HP': 0.45,  // 45% for Heavily Played
  'DMG': 0.35, // 35% for Damaged
};

// Default sell markup
const DEFAULT_SELL_MARKUP = 0.40; // 40% markup

/**
 * Get pricing breakdown with condition-based calculations
 * NOW PROPERLY USES CONDITION PARAMETER!
 */
export async function getPricingBreakdown(
  marketPrice: number,
  acquisitionType: 'buy' | 'trade' | 'pull' | 'consignment',
  condition: string
): Promise<PricingBreakdown> {
  try {
    console.log('🔥 Firebase getPricingBreakdown called:', { marketPrice, acquisitionType, condition });
    
    // Load settings from localStorage (same as frontend)
    let conditionMultipliers = { ...DEFAULT_CONDITION_MULTIPLIERS };
    let sellMarkup = DEFAULT_SELL_MARKUP;
    
    // Try to load from localStorage if available (browser environment)
    if (typeof window !== 'undefined') {
      const savedBuyPercents = localStorage.getItem('conditionBuyPercents');
      const savedMarkup = localStorage.getItem('sellMarkupPercent');
      
      if (savedBuyPercents) {
        const percents = JSON.parse(savedBuyPercents);
        // Convert percentages to decimals
        conditionMultipliers = {
          NM: percents.NM / 100,
          LP: percents.LP / 100,
          MP: percents.MP / 100,
          HP: percents.HP / 100,
          DMG: percents.DMG / 100,
        };
        console.log('✅ Loaded multipliers from localStorage:', conditionMultipliers);
      }
      
      if (savedMarkup) {
        sellMarkup = parseFloat(savedMarkup) / 100; // Convert 40 to 0.40
        console.log('✅ Loaded markup from localStorage:', sellMarkup);
      }
    }
    
    // Get multiplier for THIS condition (not always NM!)
    const normalizedCondition = condition.toUpperCase().trim();
    const condMultiplier = conditionMultipliers[normalizedCondition] || conditionMultipliers['NM'];
    
    console.log('🔍 Condition multiplier lookup:', {
      condition: normalizedCondition,
      multiplier: condMultiplier,
      availableMultipliers: conditionMultipliers
    });
    
    // Calculate cost basis BASED ON CONDITION
    let costBasis = 0;
    if (acquisitionType === 'buy') {
      costBasis = marketPrice * condMultiplier;
      console.log(`💵 Buy calculation: ${marketPrice} × ${condMultiplier} = ${costBasis}`);
    } else if (acquisitionType === 'trade') {
      costBasis = marketPrice * (condMultiplier + 0.05); // Trade is 5% more
    } else if (acquisitionType === 'consignment') {
      costBasis = 0; // No upfront cost for consignment
    }
    // pull = 0 cost
    
    // Calculate sell price
    const sellPrice = costBasis * (1 + sellMarkup);
    
    // Calculate profit
    const profit = sellPrice - costBasis;
    const profitPercentage = costBasis > 0 ? (profit / costBasis) * 100 : 0;
    
    console.log('💰 Firebase final calculation:', {
      marketPrice,
      condition: normalizedCondition,
      multiplier: condMultiplier,
      costBasis,
      sellMarkup,
      sellPrice,
      profit,
      profitPercentage
    });
    
    return {
      marketPrice,
      costBasis,
      sellPrice,
      profit,
      profitPercentage,
      acquisitionType,
      condition: normalizedCondition
    };
  } catch (error) {
    console.error('❌ Error in getPricingBreakdown:', error);
    throw error;
  }
}

/**
 * Calculate cost basis only
 */
export function calculateCostBasis(
  marketPrice: number,
  acquisitionType: 'buy' | 'trade' | 'pull' | 'consignment',
  condition: string
): number {
  const normalizedCondition = condition.toUpperCase().trim();
  const condMultiplier = DEFAULT_CONDITION_MULTIPLIERS[normalizedCondition] || DEFAULT_CONDITION_MULTIPLIERS['NM'];
  
  if (acquisitionType === 'buy') {
    return marketPrice * condMultiplier;
  } else if (acquisitionType === 'trade') {
    return marketPrice * (condMultiplier + 0.05);
  } else if (acquisitionType === 'consignment') {
    return 0; // No upfront cost
  }
  return 0; // pull or unknown
}

/**
 * Calculate sell price
 */
export function calculateSellPrice(costBasis: number): number {
  return costBasis * (1 + DEFAULT_SELL_MARKUP);
}

/**
 * Get pricing settings from localStorage or Firebase
 */
export async function getPricingSettings(): Promise<{
  conditionMultipliers: Record<string, number>;
  sellMarkup: number;
}> {
  try {
    // Try localStorage first (browser environment)
    if (typeof window !== 'undefined') {
      const savedBuyPercents = localStorage.getItem('conditionBuyPercents');
      const savedMarkup = localStorage.getItem('sellMarkupPercent');
      
      if (savedBuyPercents && savedMarkup) {
        const percents = JSON.parse(savedBuyPercents);
        return {
          conditionMultipliers: percents,
          sellMarkup: parseFloat(savedMarkup)
        };
      }
    }
    
    // Try Firebase
    const settingsRef = doc(db, 'settings', 'pricing');
    const settingsDoc = await getDoc(settingsRef);
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      return {
        conditionMultipliers: data.conditionMultipliers || {
          NM: 70, LP: 65, MP: 55, HP: 45, DMG: 35
        },
        sellMarkup: data.sellMarkup || 40
      };
    }
    
    // Return defaults
    return {
      conditionMultipliers: {
        NM: 70, LP: 65, MP: 55, HP: 45, DMG: 35
      },
      sellMarkup: 40
    };
  } catch (error) {
    console.error('Error getting pricing settings:', error);
    // Return defaults on error
    return {
      conditionMultipliers: {
        NM: 70, LP: 65, MP: 55, HP: 45, DMG: 35
      },
      sellMarkup: 40
    };
  }
}

/**
 * Update pricing settings in localStorage and optionally Firebase
 */
export async function updatePricingSettings(
  conditionMultipliers: Record<string, number>,
  sellMarkup: number,
  saveToFirebase: boolean = false
): Promise<void> {
  try {
    // Always save to localStorage (browser)
    if (typeof window !== 'undefined') {
      localStorage.setItem('conditionBuyPercents', JSON.stringify(conditionMultipliers));
      localStorage.setItem('sellMarkupPercent', sellMarkup.toString());
      console.log('✅ Saved to localStorage:', { conditionMultipliers, sellMarkup });
    }
    
    // Optionally save to Firebase
    if (saveToFirebase) {
      const settingsRef = doc(db, 'settings', 'pricing');
      await setDoc(settingsRef, {
        conditionMultipliers,
        sellMarkup,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Saved to Firebase');
    }
  } catch (error) {
    console.error('❌ Failed to update pricing settings:', error);
    throw error;
  }
}