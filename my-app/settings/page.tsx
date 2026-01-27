"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";

interface PricingSettings {
  conditionMultipliers: {
    NM: number;
    LP: number;
    MP: number;
    HP: number;
    DMG: number;
  };
  sellMarkup: number; // Percentage markup (e.g., 40 for 40%)
}

const DEFAULT_SETTINGS: PricingSettings = {
  conditionMultipliers: {
    NM: 70, // 70% of market
    LP: 65, // 65% of market
    MP: 55, // 55% of market
    HP: 45, // 45% of market
    DMG: 35, // 35% of market
  },
  sellMarkup: 40, // 40% markup on buy price
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<PricingSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const savedBuyPercents = localStorage.getItem("conditionBuyPercents");
    const savedMarkup = localStorage.getItem("sellMarkupPercent");

    if (savedBuyPercents) {
      try {
        const loaded = JSON.parse(savedBuyPercents);
        setSettings({
          ...settings,
          conditionMultipliers: loaded,
        });
      } catch (error) {
        console.error("Failed to load buy percents:", error);
      }
    }

    if (savedMarkup) {
      try {
        const loaded = parseFloat(savedMarkup);
        setSettings({
          ...settings,
          sellMarkup: loaded,
        });
      } catch (error) {
        console.error("Failed to load markup:", error);
      }
    }
  }, []);

  const handleConditionChange = (
    condition: keyof typeof settings.conditionMultipliers,
    value: string,
  ) => {
    const numValue = parseFloat(value) || 0;
    setSettings({
      ...settings,
      conditionMultipliers: {
        ...settings.conditionMultipliers,
        [condition]: numValue,
      },
    });
    setHasChanges(true);
  };

  const handleMarkupChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setSettings({
      ...settings,
      sellMarkup: numValue,
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(
        "conditionBuyPercents",
        JSON.stringify(settings.conditionMultipliers),
      );
      localStorage.setItem("sellMarkupPercent", settings.sellMarkup.toString());
      toast.success("Settings saved successfully!");
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    }
  };

  const handleReset = () => {
    if (confirm("Reset all pricing settings to defaults?")) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.setItem(
        "conditionBuyPercents",
        JSON.stringify(DEFAULT_SETTINGS.conditionMultipliers),
      );
      localStorage.setItem(
        "sellMarkupPercent",
        DEFAULT_SETTINGS.sellMarkup.toString(),
      );
      toast.success("Settings reset to defaults");
      setHasChanges(false);
    }
  };

  // Calculate example pricing
  const exampleMarket = 10;
  const exampleBuyNM = (exampleMarket * settings.conditionMultipliers.NM) / 100;
  const exampleSellNM = exampleBuyNM * (1 + settings.sellMarkup / 100);
  const exampleProfitNM = exampleSellNM - exampleBuyNM;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Pricing Settings</h1>
          <p className="text-gray-600">
            Configure buy and sell pricing percentages
          </p>
        </div>

        {/* Buy Price Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Buy Price Multipliers</h2>
          <p className="text-sm text-gray-600 mb-6">
            Percentage of market price to offer for each condition
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(settings.conditionMultipliers).map(
              ([condition, value]) => (
                <div key={condition} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {condition} (Near Mint, Lightly Played, etc.)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={value}
                      onChange={(e) =>
                        handleConditionChange(condition as any, e.target.value)
                      }
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                    />
                    <div className="text-2xl font-bold text-gray-700 w-12">
                      %
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Example: ${exampleMarket} card → Pay $
                    {((exampleMarket * value) / 100).toFixed(2)}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Sell Price Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Sell Price Markup</h2>
          <p className="text-sm text-gray-600 mb-6">
            Markup percentage added to buy price to get sell price
          </p>

          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Markup Percentage
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="0"
                max="200"
                step="1"
                value={settings.sellMarkup}
                onChange={(e) => handleMarkupChange(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
              />
              <div className="text-2xl font-bold text-gray-700 w-12">%</div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Example: Buy $7.00 → Sell $
              {(7 * (1 + settings.sellMarkup / 100)).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Example Calculation */}
        <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Example: ${exampleMarket} NM Card
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">Market Price</div>
              <div className="text-3xl font-bold text-gray-800">
                ${exampleMarket.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">
                We Pay (NM {settings.conditionMultipliers.NM}%)
              </div>
              <div className="text-3xl font-bold text-red-600">
                ${exampleBuyNM.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">
                We Sell (+{settings.sellMarkup}%)
              </div>
              <div className="text-3xl font-bold text-green-600">
                ${exampleSellNM.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-green-300 text-center">
            <div className="text-sm text-gray-600 mb-1">Profit</div>
            <div className="text-4xl font-bold text-blue-600">
              ${exampleProfitNM.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {settings.sellMarkup}% margin on buy price
            </div>
          </div>
        </div>

        {/* All Conditions Preview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Pricing Preview for ${exampleMarket} Card
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Condition</th>
                  <th className="text-right py-3 px-4">Buy %</th>
                  <th className="text-right py-3 px-4">We Pay</th>
                  <th className="text-right py-3 px-4">We Sell</th>
                  <th className="text-right py-3 px-4">Profit</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(settings.conditionMultipliers).map(
                  ([condition, buyPercent]) => {
                    const buyPrice = (exampleMarket * buyPercent) / 100;
                    const sellPrice =
                      buyPrice * (1 + settings.sellMarkup / 100);
                    const profit = sellPrice - buyPrice;
                    return (
                      <tr key={condition} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-semibold">{condition}</td>
                        <td className="py-3 px-4 text-right">{buyPercent}%</td>
                        <td className="py-3 px-4 text-right font-semibold text-red-600">
                          ${buyPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-green-600">
                          ${sellPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-blue-600">
                          ${profit.toFixed(2)}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            <Save className="w-5 h-5 mr-2" />
            {hasChanges ? "Save Changes" : "No Changes"}
          </Button>
          <Button onClick={handleReset} variant="outline" size="lg">
            <RotateCcw className="w-5 h-5 mr-2" />
            Reset to Defaults
          </Button>
        </div>

        {hasChanges && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ You have unsaved changes. Click "Save Changes" to apply them to
              the intake system.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
