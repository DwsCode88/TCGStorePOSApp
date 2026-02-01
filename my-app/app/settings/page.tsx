'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ConsignmentSettings from '@/components/ConsignmentSettings';

export default function SettingsPage() {
  const [conditionBuyPercents, setConditionBuyPercents] = useState({
    NM: 70,
    LP: 65,
    MP: 55,
    HP: 45,
    DMG: 35,
  });
  const [sellMarkupPercent, setSellMarkupPercent] = useState(40);

  // Load settings from localStorage
  useEffect(() => {
    const savedBuyPercents = localStorage.getItem('conditionBuyPercents');
    const savedMarkup = localStorage.getItem('sellMarkupPercent');
    
    if (savedBuyPercents) {
      setConditionBuyPercents(JSON.parse(savedBuyPercents));
    }
    if (savedMarkup) {
      setSellMarkupPercent(parseFloat(savedMarkup));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('conditionBuyPercents', JSON.stringify(conditionBuyPercents));
    localStorage.setItem('sellMarkupPercent', sellMarkupPercent.toString());
    toast.success('Settings saved!');
  };

  const handleReset = () => {
    const defaults = { NM: 70, LP: 65, MP: 55, HP: 45, DMG: 35 };
    setConditionBuyPercents(defaults);
    setSellMarkupPercent(40);
    toast.info('Reset to defaults');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">⚙️ Settings</h1>

        {/* Pricing Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-6">💰 Pricing Settings</h2>

          {/* Buy Percentages */}
          <div className="mb-6">
            <h3 className="font-semibold mb-4">Card Condition Buy Percentages</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {Object.entries(conditionBuyPercents).map(([condition, percent]) => (
                <div key={condition}>
                  <label className="block text-sm font-medium mb-2">{condition}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={percent}
                      onChange={(e) =>
                        setConditionBuyPercents({
                          ...conditionBuyPercents,
                          [condition]: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-20 px-3 py-2 border rounded-lg text-center font-semibold"
                    />
                    <span className="text-lg font-bold">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sell Markup */}
          <div className="mb-6">
            <h3 className="font-semibold mb-4">Sell Price Markup</h3>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="0"
                max="200"
                value={sellMarkupPercent}
                onChange={(e) => setSellMarkupPercent(parseInt(e.target.value) || 0)}
                className="w-24 px-4 py-2 border rounded-lg text-center text-lg font-semibold"
              />
              <span className="text-2xl font-bold">%</span>
              <span className="text-gray-600">markup on buy price</span>
            </div>
          </div>

          {/* Example Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold mb-3">Example: $10 Market Price Card</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="p-2 text-left">Condition</th>
                    <th className="p-2 text-right">We Pay</th>
                    <th className="p-2 text-right">We Sell</th>
                    <th className="p-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(conditionBuyPercents).map(([condition, percent]) => {
                    const buyPrice = 10 * (percent / 100);
                    const sellPrice = buyPrice * (1 + sellMarkupPercent / 100);
                    const profit = sellPrice - buyPrice;
                    return (
                      <tr key={condition} className="border-t">
                        <td className="p-2 font-medium">{condition}</td>
                        <td className="p-2 text-right">${buyPrice.toFixed(2)}</td>
                        <td className="p-2 text-right">${sellPrice.toFixed(2)}</td>
                        <td className="p-2 text-right text-green-600 font-semibold">
                          ${profit.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700" size="lg">
              Save Settings
            </Button>
            <Button onClick={handleReset} variant="outline" size="lg">
              Reset to Defaults
            </Button>
          </div>
        </div>

        {/* Consignment Settings */}
        <ConsignmentSettings />
      </div>
    </div>
  );
}