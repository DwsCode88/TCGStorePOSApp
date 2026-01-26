"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getPricingSettings,
  updatePricingSettings,
  type PricingSettings,
} from "@/lib/pricing";

export default function SettingsPage() {
  const [settings, setSettings] = useState<PricingSettings>({
    buyPercentage: 70,
    tradePercentage: 75,
    defaultMarkup: 1.15,
    minimumProfit: 0.5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const currentSettings = await getPricingSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePricingSettings(settings);
      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({
      buyPercentage: 70,
      tradePercentage: 75,
      defaultMarkup: 1.15,
      minimumProfit: 0.5,
    });
    toast.info("Settings reset to defaults (not saved yet)");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Settings</h1>
          <p className="text-gray-600">Configure pricing and system settings</p>
        </div>

        {/* Pricing Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">💰 Pricing Settings</h2>

          <div className="space-y-6">
            {/* Buy Percentage */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Buy Percentage
                <span className="text-gray-500 ml-2 font-normal">
                  (How much you pay when buying cards)
                </span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.buyPercentage}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      buyPercentage: parseFloat(e.target.value),
                    })
                  }
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                />
                <span className="text-2xl font-bold">%</span>
                <div className="text-sm text-gray-600">of market price</div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Example: If market price is $10, you pay $
                {((settings.buyPercentage / 100) * 10).toFixed(2)}
              </p>
            </div>

            {/* Trade Percentage */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Trade Percentage
                <span className="text-gray-500 ml-2 font-normal">
                  (How much credit given for trade-ins)
                </span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.tradePercentage}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tradePercentage: parseFloat(e.target.value),
                    })
                  }
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                />
                <span className="text-2xl font-bold">%</span>
                <div className="text-sm text-gray-600">of market price</div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Example: If market price is $10, customer gets $
                {((settings.tradePercentage / 100) * 10).toFixed(2)} in store
                credit
              </p>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Advanced Settings</h3>

              {/* Default Markup */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Default Markup
                  <span className="text-gray-500 ml-2 font-normal">
                    (Multiplier for sell price)
                  </span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="1"
                    max="3"
                    step="0.01"
                    value={settings.defaultMarkup}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultMarkup: parseFloat(e.target.value),
                      })
                    }
                    className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                  />
                  <div className="text-sm text-gray-600">
                    ({((settings.defaultMarkup - 1) * 100).toFixed(0)}% markup)
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Example: Market price $10 × {settings.defaultMarkup} = $
                  {(10 * settings.defaultMarkup).toFixed(2)} sell price
                </p>
              </div>

              {/* Minimum Profit */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Minimum Profit
                  <span className="text-gray-500 ml-2 font-normal">
                    (Minimum profit per card)
                  </span>
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={settings.minimumProfit}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        minimumProfit: parseFloat(e.target.value),
                      })
                    }
                    className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Ensures every card makes at least this much profit
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Examples */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-4">
            📊 Pricing Examples
          </h3>
          <div className="space-y-4">
            <div className="bg-white rounded p-4">
              <div className="font-medium mb-2">
                Example: $10 Market Price Card
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Buy (cash):</span>
                  <span className="font-semibold">
                    ${((settings.buyPercentage / 100) * 10).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Trade (credit):</span>
                  <span className="font-semibold">
                    ${((settings.tradePercentage / 100) * 10).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sell price:</span>
                  <span className="font-semibold text-green-600">
                    ${(10 * settings.defaultMarkup).toFixed(2)}
                  </span>
                </div>
                <div className="border-t mt-2 pt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Profit (buy):</span>
                    <span className="font-semibold text-green-600">
                      $
                      {(
                        10 * settings.defaultMarkup -
                        (10 * settings.buyPercentage) / 100
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Profit (trade):</span>
                    <span className="font-semibold text-green-600">
                      $
                      {(
                        10 * settings.defaultMarkup -
                        (10 * settings.tradePercentage) / 100
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="flex-1"
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          <Button onClick={handleReset} variant="outline" size="lg">
            Reset to Defaults
          </Button>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Changes to pricing settings will only affect
            new cards added after saving. Existing inventory prices will not be
            updated automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
