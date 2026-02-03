"use client";

import { useState } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

export default function RepricingSystem() {
  const [repricing, setRepricing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<any>(null);
  const [priceChanges, setPriceChanges] = useState<any[]>([]);

  const repriceCar = async () => {
    setRepricing(true);
    setProgress({ current: 0, total: 0 });
    setPriceChanges([]);

    try {
      // Get all inventory items
      const snapshot = await getDocs(collection(db, "inventory"));
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Debug: Check first few items
      console.log(`📦 Sample inventory items:`);
      items.slice(0, 3).forEach((item) => {
        console.log({
          id: item.id,
          cardName: item.cardName,
          name: item.name,
          game: item.game,
        });
      });

      setProgress({ current: 0, total: items.length });
      console.log(`🔄 Starting repricing for ${items.length} cards...`);

      const changes: any[] = [];
      let updatedCount = 0;
      let increasedCount = 0;
      let decreasedCount = 0;

      // Process in batches of 500 (Firestore limit)
      const batchSize = 500;

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchItems = items.slice(
          i,
          Math.min(i + batchSize, items.length),
        );

        for (const item of batchItems) {
          try {
            // Skip items without card name
            const cardName = item.cardName || item.name;
            if (!cardName || cardName === "Unknown Card") {
              console.warn(`⚠️ Skipping item ${item.id} - no card name`);
              continue;
            }

            console.log(`🔍 Repricing: "${cardName}" (${item.game})`);

            let bestPrice = 0;
            let apiUsed = "";
            let matchedCardName = "";

            // TRY API 1: JustTCG
            console.log(`  🟦 Trying JustTCG API...`);
            try {
              const justTCGResponse = await fetch("/api/justtcg", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "search",
                  query: cardName,
                  game: item.game,
                }),
              });

              await new Promise((resolve) => setTimeout(resolve, 6000)); // Rate limit

              if (justTCGResponse.ok) {
                const justTCGData = await justTCGResponse.json();
                const justTCGResults = justTCGData.results || [];

                if (justTCGResults.length > 0) {
                  const price = justTCGResults[0].variants?.[0]?.price || 0;
                  console.log(
                    `  ✅ JustTCG: Found "${justTCGResults[0].name}" - $${price.toFixed(2)}`,
                  );
                  if (price > 0) {
                    bestPrice = price;
                    apiUsed = "JustTCG";
                    matchedCardName = justTCGResults[0].name;
                  }
                } else {
                  console.log(`  ❌ JustTCG: No results`);
                }
              }
            } catch (error) {
              console.log(`  ❌ JustTCG: Error -`, error.message);
            }

            // TRY API 2: TCGCodex
            console.log(`  🟩 Trying TCGCodex API...`);
            try {
              const tcgCodexResponse = await fetch("/api/tcgcodex", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "search",
                  query: cardName,
                  game: item.game,
                }),
              });

              await new Promise((resolve) => setTimeout(resolve, 1000)); // Shorter rate limit

              if (tcgCodexResponse.ok) {
                const tcgCodexData = await tcgCodexResponse.json();
                const tcgCodexResults = tcgCodexData.results || [];

                if (tcgCodexResults.length > 0) {
                  const price = tcgCodexResults[0].market_price || 0;
                  console.log(
                    `  ✅ TCGCodex: Found "${tcgCodexResults[0].name}" - $${price.toFixed(2)}`,
                  );

                  // Use TCGCodex if JustTCG didn't find it, or if TCGCodex price is better
                  if (
                    price > 0 &&
                    (bestPrice === 0 ||
                      Math.abs(price - bestPrice) < bestPrice * 0.1)
                  ) {
                    // If prices are within 10%, prefer TCGCodex as it's more reliable
                    bestPrice = price;
                    apiUsed = "TCGCodex";
                    matchedCardName = tcgCodexResults[0].name;
                  }
                } else {
                  console.log(`  ❌ TCGCodex: No results`);
                }
              }
            } catch (error) {
              console.log(`  ❌ TCGCodex: Error -`, error.message);
            }

            // If still no results, try base name with both APIs
            if (bestPrice === 0) {
              const baseName = cardName
                .split(" - ")[0]
                .split(" V ")[0]
                .split(" ex ")[0]
                .split(" GX")[0]
                .split(" VMAX")[0]
                .trim();

              if (baseName !== cardName) {
                console.log(`  🔄 Trying base name: "${baseName}"`);

                // Try JustTCG with base name
                try {
                  const response = await fetch("/api/justtcg", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "search",
                      query: baseName,
                      game: item.game,
                    }),
                  });

                  await new Promise((resolve) => setTimeout(resolve, 6000));

                  if (response.ok) {
                    const data = await response.json();
                    if (data.results && data.results.length > 0) {
                      const price = data.results[0].variants?.[0]?.price || 0;
                      if (price > 0) {
                        console.log(
                          `  ✅ JustTCG (base): $${price.toFixed(2)}`,
                        );
                        bestPrice = price;
                        apiUsed = "JustTCG";
                        matchedCardName = data.results[0].name;
                      }
                    }
                  }
                } catch (error) {
                  console.log(`  ❌ JustTCG (base): Error`);
                }

                // Try TCGCodex with base name if still nothing
                if (bestPrice === 0) {
                  try {
                    const response = await fetch("/api/tcgcodex", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "search",
                        query: baseName,
                        game: item.game,
                      }),
                    });

                    await new Promise((resolve) => setTimeout(resolve, 1000));

                    if (response.ok) {
                      const data = await response.json();
                      if (data.results && data.results.length > 0) {
                        const price = data.results[0].market_price || 0;
                        if (price > 0) {
                          console.log(
                            `  ✅ TCGCodex (base): $${price.toFixed(2)}`,
                          );
                          bestPrice = price;
                          apiUsed = "TCGCodex";
                          matchedCardName = data.results[0].name;
                        }
                      }
                    }
                  } catch (error) {
                    console.log(`  ❌ TCGCodex (base): Error`);
                  }
                }
              }
            }

            // Process the best price found
            if (bestPrice > 0) {
              const oldMarketPrice = item.marketPrice || 0;

              console.log(
                `  🎯 Best match: "${matchedCardName}" via ${apiUsed}`,
              );
              console.log(
                `  💰 Price: $${oldMarketPrice.toFixed(2)} → $${bestPrice.toFixed(2)}`,
              );

              if (bestPrice !== oldMarketPrice) {
                const newSellPrice = bestPrice * 1.3; // 30% markup
                const priceChange = bestPrice - oldMarketPrice;
                const percentChange =
                  oldMarketPrice > 0
                    ? ((priceChange / oldMarketPrice) * 100).toFixed(1)
                    : "0";

                // Update in batch
                const docRef = doc(db, "inventory", item.id);
                batch.update(docRef, {
                  marketPrice: bestPrice,
                  sellPrice: newSellPrice,
                  lastPriceUpdate: serverTimestamp(),
                  priceSource: apiUsed, // Track which API found the price
                  priceHistory: [
                    ...(item.priceHistory || []),
                    {
                      oldPrice: oldMarketPrice,
                      newPrice: bestPrice,
                      changeAmount: priceChange,
                      changePercent: parseFloat(percentChange),
                      updatedAt: new Date().toISOString(),
                      source: apiUsed,
                    },
                  ].slice(-10), // Keep last 10 price changes
                });

                changes.push({
                  id: item.id,
                  sku: item.sku,
                  cardName: item.cardName || item.name,
                  oldPrice: oldMarketPrice,
                  newPrice: bestPrice,
                  change: priceChange,
                  percentChange: parseFloat(percentChange),
                  increased: priceChange > 0,
                  source: apiUsed,
                });

                updatedCount++;
                if (priceChange > 0) increasedCount++;
                if (priceChange < 0) decreasedCount++;

                console.log(
                  `💰 ${cardName}: $${oldMarketPrice.toFixed(2)} → $${bestPrice.toFixed(2)} (${priceChange > 0 ? "+" : ""}${percentChange}%) [${apiUsed}]`,
                );
              } else {
                console.log(
                  `  ⏸️ Price unchanged: $${oldMarketPrice.toFixed(2)}`,
                );
              }
            } else {
              console.warn(
                `  ⚠️ No results from JustTCG or TCGCodex - keeping existing price $${(item.marketPrice || 0).toFixed(2)}`,
              );
            }

            setProgress({
              current: i + batchItems.indexOf(item) + 1,
              total: items.length,
            });
          } catch (error) {
            console.error(`Error repricing ${item.cardName}:`, error);
          }
        }

        // Commit batch
        await batch.commit();
        console.log(`✅ Committed batch ${Math.floor(i / batchSize) + 1}`);
      }

      setPriceChanges(changes.sort((a, b) => b.change - a.change)); // Sort by highest increase
      setResults({
        total: items.length,
        updated: updatedCount,
        increased: increasedCount,
        decreased: decreasedCount,
        unchanged: items.length - updatedCount,
      });

      console.log(`\n✅ REPRICING COMPLETE:`);
      console.log(`   Updated: ${updatedCount}`);
      console.log(`   Increased: ${increasedCount}`);
      console.log(`   Decreased: ${decreasedCount}`);
    } catch (error) {
      console.error("Repricing error:", error);
      alert("Error during repricing. Check console.");
    } finally {
      setRepricing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Weekly Repricing System
              </h1>
              <p className="text-gray-600 mt-2">
                Update all card prices from current market data
              </p>
            </div>
            <span className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full text-sm font-bold">
              🧪 BETA
            </span>
          </div>

          <button
            onClick={repriceCar}
            disabled={repricing}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-all"
          >
            {repricing
              ? `⏳ Repricing... (${progress.current}/${progress.total})`
              : "🔄 Start Weekly Repricing"}
          </button>

          {repricing && (
            <div className="mt-4">
              <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                />
              </div>
              <p className="text-sm text-gray-600 text-center mt-2">
                Processing {progress.current} of {progress.total} cards...
              </p>
            </div>
          )}
        </div>

        {/* Results Summary */}
        {results && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Repricing Results
            </h2>
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-blue-700">
                  {results.total}
                </div>
                <div className="text-sm text-gray-600">Total Cards</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-purple-700">
                  {results.updated}
                </div>
                <div className="text-sm text-gray-600">Prices Updated</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-green-700">
                  {results.increased}
                </div>
                <div className="text-sm text-gray-600">Price Increases</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-red-700">
                  {results.decreased}
                </div>
                <div className="text-sm text-gray-600">Price Decreases</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-gray-700">
                  {results.unchanged}
                </div>
                <div className="text-sm text-gray-600">Unchanged</div>
              </div>
            </div>
          </div>
        )}

        {/* Price Changes */}
        {priceChanges.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Price Changes ({priceChanges.length})
            </h2>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="text-left p-3">Card</th>
                    <th className="text-left p-3">SKU</th>
                    <th className="text-right p-3">Old Price</th>
                    <th className="text-right p-3">New Price</th>
                    <th className="text-right p-3">Change</th>
                    <th className="text-right p-3">%</th>
                    <th className="text-center p-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {priceChanges.map((change, i) => (
                    <tr
                      key={i}
                      className={`border-b hover:bg-gray-50 ${
                        change.increased ? "bg-green-50" : "bg-red-50"
                      }`}
                    >
                      <td className="p-3 font-medium">{change.cardName}</td>
                      <td className="p-3 text-xs text-gray-600">
                        {change.sku}
                      </td>
                      <td className="p-3 text-right">
                        ${change.oldPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        ${change.newPrice.toFixed(2)}
                      </td>
                      <td
                        className={`p-3 text-right font-bold ${
                          change.increased ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {change.increased ? "+" : ""}${change.change.toFixed(2)}
                      </td>
                      <td
                        className={`p-3 text-right font-bold ${
                          change.increased ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {change.percentChange > 0 ? "+" : ""}
                        {change.percentChange}%
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            change.source === "TCGCodex"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {change.source || "Unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
