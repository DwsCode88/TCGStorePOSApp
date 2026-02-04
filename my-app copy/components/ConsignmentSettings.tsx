// components/ConsignmentSettings.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ConsignmentSettings() {
  const [settings, setSettings] = useState({
    defaultPayoutPercent: 60,
    minConsignmentValue: 10.00,
    consignmentDuration: 90, // days
  });

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('consignment-settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('consignment-settings', JSON.stringify(settings));
    toast.success('Consignment settings saved!');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-semibold mb-4">Consignment Settings</h2>

      <div className="space-y-6">
        {/* Default Payout Percentage */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Default Consignor Payout %
          </label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="0"
              max="100"
              value={settings.defaultPayoutPercent}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultPayoutPercent: parseFloat(e.target.value) || 0,
                })
              }
              className="w-32 px-4 py-2 border rounded-lg"
            />
            <span className="text-2xl font-bold">%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Consignor gets this %, you keep the rest
          </p>
          <div className="mt-2 p-3 bg-blue-50 rounded text-sm">
            <strong>Example:</strong> If item sells for $100:
            <br />
            • Consignor gets: ${(100 * settings.defaultPayoutPercent / 100).toFixed(2)}
            <br />• Shop keeps: ${(100 * (1 - settings.defaultPayoutPercent / 100)).toFixed(2)}
          </div>
        </div>

        {/* Minimum Value */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Minimum Consignment Value
          </label>
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={settings.minConsignmentValue}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  minConsignmentValue: parseFloat(e.target.value) || 0,
                })
              }
              className="w-32 px-4 py-2 border rounded-lg"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Don't accept consignments below this value
          </p>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Consignment Duration (days)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="1"
              value={settings.consignmentDuration}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  consignmentDuration: parseInt(e.target.value) || 90,
                })
              }
              className="w-32 px-4 py-2 border rounded-lg"
            />
            <span className="text-lg">days</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Return unsold items to consignor after this period
          </p>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
        >
          Save Consignment Settings
        </Button>
      </div>
    </div>
  );
}