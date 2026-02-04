"use client";

import { useState } from "react";
import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function TestItemsPage() {
  const [adding, setAdding] = useState(false);

  const testItems = [
    {
      cardName: "Test Card A",
      setName: "Test Set",
      game: "One Piece",
      printing: "Normal",
      condition: "NM",
      quantity: 3,
      sellPrice: 5.0,
      costBasis: 2.5,
      status: "labeled",
    },
    {
      cardName: "Test Card B",
      setName: "Test Set",
      game: "One Piece",
      printing: "Foil",
      condition: "NM",
      quantity: 7,
      sellPrice: 10.0,
      costBasis: 5.0,
      status: "labeled",
    },
    {
      cardName: "Test Card C",
      setName: "Test Set",
      game: "One Piece",
      printing: "Normal",
      condition: "LP",
      quantity: 12,
      sellPrice: 3.0,
      costBasis: 1.5,
      status: "labeled",
    },
    {
      cardName: "Test Card D",
      setName: "Test Set",
      game: "One Piece",
      printing: "Foil",
      condition: "NM",
      quantity: 5,
      sellPrice: 15.0,
      costBasis: 7.5,
      status: "labeled",
    },
    {
      cardName: "Test Card E",
      setName: "Test Set",
      game: "One Piece",
      printing: "Normal",
      condition: "NM",
      quantity: 1,
      sellPrice: 2.0,
      costBasis: 1.0,
      status: "labeled",
    },
  ];

  const addTestItems = async () => {
    setAdding(true);
    console.log("🧪 Adding test items...");

    try {
      let successCount = 0;

      for (const item of testItems) {
        const sku = `VT-TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const itemData = {
          ...item,
          sku,
          acquisitionType: "buy",
          language: "English",
          location: "Test Location",
          notes: "Test item for Square sync",
          createdAt: new Date(),
          updatedAt: new Date(),
          priceSource: "Manual",
          marketPrice: item.sellPrice,
        };

        await setDoc(doc(db, "inventory", sku), itemData);

        console.log(
          `✅ Added: ${item.cardName} (qty: ${item.quantity}) - ${sku}`,
        );
        successCount++;
      }

      toast.success(`Added ${successCount} test items!`);
      console.log(`\n🎉 Success! Added ${successCount} test items.`);
      console.log(
        '📋 All items have status "labeled" and are ready to sync to Square.',
      );
      console.log("\n📍 Next steps:");
      console.log("1. Go to Dashboard");
      console.log('2. Click "Sync X Cards" button');
      console.log("3. Check terminal for inventory update logs");
      console.log("4. Check Square Dashboard for on-hand quantities\n");
    } catch (error: any) {
      console.error("Failed to add test items:", error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setAdding(false);
    }
  };

  const clearTestItems = async () => {
    toast.error("Delete from Inventory page manually");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Test Items Generator</h1>
        <p className="text-gray-600 mb-8">
          Add multiple test items to test Square inventory sync
        </p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">What This Does</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p>✅ Creates 5 test items in Firebase</p>
            <p>✅ All have status "labeled" (ready to sync)</p>
            <p>✅ Different quantities: 3, 7, 12, 5, 1</p>
            <p>✅ Unique SKUs (VT-TEST-...)</p>
            <p>✅ Ready to sync to Square immediately</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Items Preview</h2>
          <div className="space-y-3">
            {testItems.map((item, i) => (
              <div
                key={i}
                className="border rounded p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold">{item.cardName}</div>
                  <div className="text-sm text-gray-600">
                    {item.printing} · {item.condition} · $
                    {item.sellPrice.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    ×{item.quantity}
                  </div>
                  <div className="text-xs text-gray-500">cards</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-gray-700">
              <strong>Total:</strong> 5 items, 28 cards total
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">Testing Steps</h2>
          <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
            <li>Click "Add Test Items" below</li>
            <li>
              Go to <strong>Dashboard</strong> page
            </li>
            <li>You'll see "Ready to Sync: 28 cards" (5 items)</li>
            <li>
              Click <strong>"Sync 28 Cards"</strong> button
            </li>
            <li>
              Watch <strong>terminal</strong> for inventory update logs
            </li>
            <li>
              Check <strong>Square Dashboard</strong> → Items
            </li>
            <li>Verify each item shows correct "On hand" quantity</li>
          </ol>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">
            ⚠️ What to Look For in Terminal
          </h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <strong>For each item, you should see:</strong>
            </p>
            <pre className="bg-white p-3 rounded text-xs overflow-x-auto">
              {`📦 Inventory sync check:
  - Variation ID: XXXXXXX
  - Location ID: LXXXXXXX
  - Quantity: 3 (or 7, 12, 5, 1)

📦 Setting inventory quantity to 3...
✅ Set inventory to 3 units`}
            </pre>
            <p className="mt-3">
              <strong>If you see errors:</strong>
            </p>
            <pre className="bg-white p-3 rounded text-xs overflow-x-auto">
              {`❌ Inventory update failed: {
  category: 'INVALID_REQUEST_ERROR',
  code: 'NOT_FOUND',
  detail: '...'
}`}
            </pre>
            <p>→ Share the error with me!</p>
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            onClick={addTestItems}
            disabled={adding}
            className="bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {adding ? "Adding..." : "🧪 Add Test Items"}
          </Button>

          <Button onClick={clearTestItems} variant="outline" size="lg">
            🗑️ Clear Test Items
          </Button>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p>
            <strong>Note:</strong> To delete test items, go to Inventory page
            and delete them manually.
          </p>
        </div>
      </div>
    </div>
  );
}
