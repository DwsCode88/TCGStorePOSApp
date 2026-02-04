"use client";

import { useState } from "react";

interface TCGPlayerCard {
  tcgplayerId: string;
  productLine: string;
  setName: string;
  productName: string;
  number: string;
  rarity: string;
  condition: string;
  tcgMarketPrice: string;
  quantity: number;
  photoUrl: string;
}

interface ComparisonResult {
  tcgPlayerCard: TCGPlayerCard;
  justTCGPrice: number | null;
  justTCGMatch: any | null;
  priceDiff: number | null;
  found: boolean;
}

export default function TCGvsJustTCG() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const parseConsignmentCSV = (text: string): TCGPlayerCard[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    const cards: TCGPlayerCard[] = [];

    console.log(`📄 CSV has ${lines.length} lines (including header)`);

    for (let i = 1; i < lines.length; i++) {
      // Split by comma, handling quoted fields
      const fields: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          fields.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      fields.push(current.trim()); // Push last field

      console.log(
        `📋 Line ${i}: ${fields.length} fields -`,
        fields.slice(0, 9),
      );

      if (fields.length < 14) {
        console.log(`⚠️ Skipping line ${i}: only ${fields.length} fields`);
        continue;
      }

      const cleanField = (field: string) => field.replace(/^"|"$/g, "").trim();

      cards.push({
        tcgplayerId: cleanField(fields[0]),
        productLine: cleanField(fields[1]),
        setName: cleanField(fields[2]),
        productName: cleanField(fields[3]),
        number: cleanField(fields[5]),
        rarity: cleanField(fields[6]),
        condition: cleanField(fields[7]),
        tcgMarketPrice: cleanField(fields[8]),
        quantity: parseInt(fields[13]) || 1,
        photoUrl: fields[15] ? cleanField(fields[15]) : "",
      });
    }

    console.log(`✅ Parsed ${cards.length} valid cards`);
    return cards;
  };

  const searchJustTCG = async (
    card: TCGPlayerCard,
  ): Promise<{ price: number | null; match: any | null }> => {
    try {
      let cardName = card.productName
        .replace(/\s*-\s*\d+(?:\/\d+)?$/, "")
        .trim();

      console.log(`🔍 Searching: "${cardName}" #${card.number}`);

      const searchResponse = await fetch("/api/justtcg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          cardName: cardName,
          cardNumber: card.number,
        }),
      });

      if (!searchResponse.ok) return { price: null, match: null };

      let data = await searchResponse.json();
      let cards = data.data || [];

      console.log(`📊 Found ${cards.length} results`);

      // Retry without number if no results
      if (cards.length === 0) {
        console.log(`🔄 Retrying without number...`);
        await new Promise((resolve) => setTimeout(resolve, 200));

        const retryResponse = await fetch("/api/justtcg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "search",
            cardName: cardName,
            cardNumber: "",
          }),
        });

        if (retryResponse.ok) {
          data = await retryResponse.json();
          cards = data.data || [];
          console.log(`📊 Retry found ${cards.length} results`);
        }
      }

      if (cards.length === 0) {
        console.log(`❌ No match found`);
        return { price: null, match: null };
      }

      const matchedCard = cards[0];
      const price = matchedCard.variants?.[0]?.price || null;

      console.log(`✅ Found: "${matchedCard.name}" - $${price}`);

      return { price, match: matchedCard };
    } catch (error) {
      console.error(`❌ Search error:`, error);
      return { price: null, match: null };
    }
  };

  const processCSV = async () => {
    if (!file) {
      alert("Please upload a CSV file");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const text = await file.text();
      const cards = parseConsignmentCSV(text);

      if (cards.length === 0) {
        alert("No valid cards found in CSV");
        setLoading(false);
        return;
      }

      console.log(`\n📋 Processing ${cards.length} cards...`);
      setProgress({ current: 0, total: cards.length });

      const comparisons: ComparisonResult[] = [];

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        console.log(`\n[${i + 1}/${cards.length}] ${card.productName}`);

        const { price, match } = await searchJustTCG(card);
        const tcgMarketPrice = parseFloat(card.tcgMarketPrice) || null;

        const priceDiff =
          price && tcgMarketPrice ? price - tcgMarketPrice : null;

        console.log(
          `💰 TCG Market: $${tcgMarketPrice}, JustTCG: $${price}, Diff: ${priceDiff ? `$${priceDiff.toFixed(2)}` : "N/A"}`,
        );

        comparisons.push({
          tcgPlayerCard: card,
          justTCGPrice: price,
          justTCGMatch: match,
          priceDiff: priceDiff,
          found: !!match,
        });

        setProgress({ current: i + 1, total: cards.length });
        setResults([...comparisons]);

        // Rate limiting
        if (i < cards.length - 1) {
          console.log(`⏱️ Waiting 6 seconds...`);
          await new Promise((resolve) => setTimeout(resolve, 6000));
        }
      }

      // Summary
      const foundCount = comparisons.filter((c) => c.found).length;
      const tcgTotal = comparisons.reduce(
        (s, c) =>
          s +
          (parseFloat(c.tcgPlayerCard.tcgMarketPrice) || 0) *
            c.tcgPlayerCard.quantity,
        0,
      );
      const justTCGTotal = comparisons.reduce(
        (s, c) => s + (c.justTCGPrice || 0) * c.tcgPlayerCard.quantity,
        0,
      );
      const totalDiff = justTCGTotal - tcgTotal;

      console.log(`\n📊 COMPARISON SUMMARY:`);
      console.log(`✅ Found on JustTCG: ${foundCount}/${cards.length}`);
      console.log(`💰 TCG Market Total:  $${tcgTotal.toFixed(2)}`);
      console.log(`💰 JustTCG Total:     $${justTCGTotal.toFixed(2)}`);
      console.log(
        `📈 Difference:        $${totalDiff.toFixed(2)} (${totalDiff > 0 ? "+" : ""}${((totalDiff / tcgTotal) * 100).toFixed(1)}%)`,
      );

      // Show cards where JustTCG is higher
      const betterOnJustTCG = comparisons.filter(
        (c) => c.priceDiff && c.priceDiff > 0,
      ).length;
      console.log(
        `\n📈 Cards where JustTCG pays MORE: ${betterOnJustTCG}/${foundCount}`,
      );

      console.log(
        `\n✅ DONE! Found ${foundCount}/${cards.length} cards. JustTCG total: $${justTCGTotal.toFixed(2)}`,
      );
    } catch (error: any) {
      console.error("Error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const csvLines = [
      "Card Name,Number,Set,Condition,Quantity,TCG Market Price,JustTCG Price,Difference,% Diff,Best Price,Recommendation",
    ];

    results.forEach((r) => {
      const tcgPrice = parseFloat(r.tcgPlayerCard.tcgMarketPrice) || 0;
      const justPrice = r.justTCGPrice || 0;
      const diff = r.priceDiff || 0;
      const pctDiff = tcgPrice > 0 ? ((diff / tcgPrice) * 100).toFixed(1) : "";
      const bestPrice = Math.max(tcgPrice, justPrice);
      const recommendation =
        diff > 0
          ? "Sell on JustTCG"
          : diff < -1
            ? "Sell on TCGPlayer"
            : "Either platform";

      csvLines.push(
        [
          `"${r.tcgPlayerCard.productName}"`,
          `"${r.tcgPlayerCard.number}"`,
          `"${r.tcgPlayerCard.setName}"`,
          r.tcgPlayerCard.condition,
          r.tcgPlayerCard.quantity,
          tcgPrice.toFixed(2),
          justPrice.toFixed(2),
          diff.toFixed(2),
          pctDiff,
          bestPrice.toFixed(2),
          recommendation,
        ].join(","),
      );
    });

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tcg_vs_justtcg_${Date.now()}.csv`;
    a.click();
  };

  const foundCount = results.filter((r) => r.found).length;
  const tcgTotal = results.reduce(
    (s, r) =>
      s +
      (parseFloat(r.tcgPlayerCard.tcgMarketPrice) || 0) *
        r.tcgPlayerCard.quantity,
    0,
  );
  const justTCGTotal = results.reduce(
    (s, r) => s + (r.justTCGPrice || 0) * r.tcgPlayerCard.quantity,
    0,
  );
  const totalDiff = justTCGTotal - tcgTotal;
  const betterOnJustTCG = results.filter(
    (r) => r.priceDiff && r.priceDiff > 0,
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">
          ⚔️ TCGPlayer vs JustTCG Price Comparison
        </h1>
        <p className="text-gray-600 mb-8">
          Compare TCG Market prices with JustTCG to find the best platform to
          sell on
        </p>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Upload TCGPlayer Consignment CSV
          </h2>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm mb-4"
          />
          {file && <p className="text-sm text-green-600 mb-4">✓ {file.name}</p>}

          <button
            onClick={processCSV}
            disabled={!file || loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading
              ? `Processing... (${progress.current}/${progress.total})`
              : "Compare Prices"}
          </button>
        </div>

        {/* Summary */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">
                Price Comparison Results
              </h2>
              <button
                onClick={exportCSV}
                className="bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50"
              >
                📥 Export CSV
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-3xl font-bold">{results.length}</div>
                <div className="text-sm text-gray-600">Total Cards</div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-3xl font-bold text-green-600">
                  {foundCount}
                </div>
                <div className="text-sm text-gray-600">Found on JustTCG</div>
                <div className="text-xs text-green-700">
                  {((foundCount / results.length) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-2xl font-bold text-blue-700">
                  ${tcgTotal.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">TCG Market Total</div>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <div className="text-2xl font-bold text-purple-700">
                  ${justTCGTotal.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">JustTCG Total</div>
              </div>
              <div
                className={`p-4 rounded ${totalDiff >= 0 ? "bg-green-50" : "bg-red-50"}`}
              >
                <div
                  className={`text-2xl font-bold ${totalDiff >= 0 ? "text-green-700" : "text-red-700"}`}
                >
                  {totalDiff >= 0 ? "+" : ""}${totalDiff.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Difference</div>
                <div
                  className={`text-xs ${totalDiff >= 0 ? "text-green-700" : "text-red-700"}`}
                >
                  {totalDiff >= 0 ? "+" : ""}
                  {((totalDiff / tcgTotal) * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Recommendation Banner */}
            {totalDiff > 0 && (
              <div className="bg-green-100 border border-green-300 rounded-lg p-4 mb-6">
                <div className="font-semibold text-green-800 mb-2">
                  💰 JustTCG pays ${totalDiff.toFixed(2)} MORE for your
                  collection!
                </div>
                <div className="text-sm text-green-700">
                  {betterOnJustTCG} out of {foundCount} cards are priced higher
                  on JustTCG (
                  {((betterOnJustTCG / foundCount) * 100).toFixed(0)}%)
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-3">#</th>
                    <th className="text-left p-3">Card</th>
                    <th className="text-left p-3">Number</th>
                    <th className="text-left p-3">TCG Market</th>
                    <th className="text-left p-3">JustTCG</th>
                    <th className="text-left p-3">Difference</th>
                    <th className="text-left p-3">Best Price</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const tcgPrice =
                      parseFloat(r.tcgPlayerCard.tcgMarketPrice) || 0;
                    const justPrice = r.justTCGPrice || 0;
                    const diff = r.priceDiff || 0;
                    const bestPrice = Math.max(tcgPrice, justPrice);

                    return (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-gray-500">{i + 1}</td>
                        <td className="p-3">
                          <div className="font-medium text-xs">
                            {r.tcgPlayerCard.productName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {r.tcgPlayerCard.setName}
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          {r.tcgPlayerCard.number}
                        </td>
                        <td className="p-3">
                          <span
                            className={`font-semibold ${tcgPrice === bestPrice && justPrice > 0 ? "text-green-600" : "text-gray-600"}`}
                          >
                            ${tcgPrice.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3">
                          {justPrice > 0 ? (
                            <span
                              className={`font-semibold ${justPrice === bestPrice ? "text-green-600" : "text-gray-600"}`}
                            >
                              ${justPrice.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">
                              Not found
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {diff !== null && diff !== 0 ? (
                            <span
                              className={`text-xs font-semibold ${diff > 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {diff > 0 ? "+" : ""}${diff.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-green-700">
                            ${bestPrice.toFixed(2)}
                          </div>
                          {bestPrice === justPrice && justPrice > tcgPrice && (
                            <div className="text-xs text-purple-600">
                              JustTCG
                            </div>
                          )}
                          {bestPrice === tcgPrice && tcgPrice > justPrice && (
                            <div className="text-xs text-blue-600">
                              TCGPlayer
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
