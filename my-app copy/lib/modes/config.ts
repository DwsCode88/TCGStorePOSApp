import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { ModeSettings, OperatingMode } from '@/types/modes';

export const DEFAULT_SETTINGS: ModeSettings = {
  currentMode: 'store',
  show: { priceDisplay: 'rounded', discountEnabled: true, discountPercentage: 10, cashOnlyDiscount: 5, binPricing: true, taxIncluded: true },
  store: { priceDisplay: 'full', taxRate: 0.06, squareIntegration: true, inventoryTracking: true, autoSync: true },
};

export async function getModeSettings(): Promise<ModeSettings> {
  const settingsRef = doc(db, 'systemConfig', 'modeSettings');
  const settingsDoc = await getDoc(settingsRef);
  if (!settingsDoc.exists()) {
    await setDoc(settingsRef, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  return settingsDoc.data() as ModeSettings;
}

export async function switchMode(mode: OperatingMode): Promise<void> {
  await updateDoc(doc(db, 'systemConfig', 'modeSettings'), { currentMode: mode });
}
