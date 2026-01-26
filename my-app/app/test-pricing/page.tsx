"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getPricingSettings,
  calculateCostBasis,
  calculateSellPrice,
  getPricingBreakdown,
} from "@/lib/pricing";

export default function TestPricingPage() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const testPricing = async () => {
    setLoading(true);
    setResult("Testing...");

    try {
      // Test 1: Get settings
      console.log("Test 1: Getting pricing settings...");
      const settings = await getPricingSettings();
      console.log("Settings:", settings);

      // Test 2: Calculate cost basis for buy
      console.log("Test 2: Calculating cost basis (buy)...");
      const buyCost = await calculateCostBasis(10, "buy");
      console.log("Buy cost:", buyCost);

      // Test 3: Calculate cost basis for trade
      console.log("Test 3: Calculating cost basis (trade)...");
      const tradeCost = await calculateCostBasis(10, "trade");
      console.log("Trade cost:", tradeCost);

      // Test 4: Calculate sell price
      console.log("Test 4: Calculating sell price...");
      const sellPrice = await calculateSellPrice(10, "NM");
      console.log("Sell price:", sellPrice);

      // Test 5: Get full breakdown
      console.log("Test 5: Getting pricing breakdown...");
      const breakdown = await getPricingBreakdown(10, "buy", "NM");
      console.log("Breakdown:", breakdown);

      setResult(
        JSON.stringify(
          {
            settings,
            buyCost,
            tradeCost,
            sellPrice,
            breakdown,
          },
          null,
          2,
        ),
      );
    } catch (error: any) {
      console.error("Test failed:", error);
      setResult(`ERROR: ${error.message}\n\n${error.stack}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Test Pricing System</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Run Test</h2>
          <p className="text-sm text-gray-600 mb-4">
            This will test if the pricing calculation works. Check the console
            (F12) for detailed logs.
          </p>

          <Button onClick={testPricing} disabled={loading} size="lg">
            {loading ? "Testing..." : "Run Pricing Test"}
          </Button>
        </div>

        {result && (
          <div className="bg-gray-900 text-green-400 rounded-lg p-6 font-mono text-sm overflow-auto max-h-[600px]">
            <pre>{result}</pre>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
          <h3 className="font-semibold mb-2">Expected Results:</h3>
          <div className="text-sm space-y-1">
            <div>
              • Buy cost (70% of $10): <strong>$7.00</strong>
            </div>
            <div>
              • Trade cost (75% of $10): <strong>$7.50</strong>
            </div>
            <div>
              • Sell price (15% markup): <strong>$11.50</strong>
            </div>
            <div>
              • Profit (buy): <strong>$4.50</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
