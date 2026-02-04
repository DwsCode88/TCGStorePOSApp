export type OperatingMode = 'show' | 'store';

export interface ShowModeConfig {
  priceDisplay: 'full' | 'rounded' | 'hidden';
  discountEnabled: boolean;
  discountPercentage: number;
  cashOnlyDiscount: number;
  binPricing: boolean;
  taxIncluded: boolean;
}

export interface StoreModeConfig {
  priceDisplay: 'full';
  taxRate: number;
  squareIntegration: boolean;
  inventoryTracking: boolean;
  autoSync: boolean;
}

export interface ModeSettings {
  currentMode: OperatingMode;
  show: ShowModeConfig;
  store: StoreModeConfig;
}
