"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TCGPlayerCard {
  productLine: string;
  productName: string;
  condition: string;
  number: string;
  set: string;
  rarity: string;
  quantity: number;
  savedPrice: string;
}

interface TCGCodexMatch {
  tcgPlayerCard: TCGPlayerCard;
  found: boolean;
  tcgCodexCard?: any;
  price?: number;
  error?: string;
}

export default function TCGPlayerMatcherPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TCGCodexMatch[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const parseTCGPlayerCSV = (csvText: string): TCGPlayerCard[] => {
    // Remove null characters, BOM, and normalize line endings
    csvText = csvText
      .replace(/\0/g, "") // Remove null characters
      .replace(/^\uFEFF/, "") // Remove UTF-8 BOM
      .replace(/^\ufffe/, "") // Remove UTF-16 LE BOM
      .replace(/^\ufeff/, "") // Remove UTF-16 BE BOM
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    const lines = csvText.split("\n").filter((line) => line.trim().length > 0);
    const cards: TCGPlayerCard[] = [];

    console.log(`📄 CSV has ${lines.length} lines (including header)`);
    if (lines.length > 0) {
      console.log("📋 Header:", lines[0]);
      if (lines.length > 1) {
        console.log("📋 First card line:", lines[1]);
      }
    }

    // Skip header (first line)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Parse CSV line (handle quoted fields)
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < 7) {
          console.warn(
            `⚠️ Line ${i + 1}: Could not parse (${matches?.length || 0} fields)`,
          );
          continue;
        }

        const [
          productLine,
          productName,
          condition,
          number,
          set,
          rarity,
          quantity,
          savedPrice,
        ] = matches.map((m) => m.replace(/^"|"$/g, "").trim());

        // Skip if no product name
        if (!productName || productName === "") {
          console.warn(`⚠️ Line ${i + 1}: Empty product name, skipping`);
          continue;
        }

        cards.push({
          productLine,
          productName,
          condition,
          number,
          set,
          rarity,
          quantity: parseInt(quantity) || 1,
          savedPrice: savedPrice || "",
        });
      } catch (error) {
        console.warn(`⚠️ Line ${i + 1}: Parse error`, error);
      }
    }

    console.log(`✅ Parsed ${cards.length} valid cards`);
    if (cards.length > 0) {
      console.log("📋 Sample parsed card:", cards[0]);
    }
    return cards;
  };

  const searchTCGCodex = async (
    card: TCGPlayerCard,
  ): Promise<TCGCodexMatch> => {
    try {
      // Extract card name (remove number suffix if present)
      let cardName = card.productName;

      // Skip if no card name
      if (!cardName || cardName.trim() === "") {
        return {
          tcgPlayerCard: card,
          found: false,
          error: "Empty card name",
        };
      }

      // Remove patterns like " - 009", " - 166/132" from the name
      cardName = cardName.replace(/\s*-\s*\d+(?:\/\d+)?$/, "").trim();

      console.log(`  → Searching: "${cardName}" #${card.number}`);

      // Search via our API route
      const searchResponse = await fetch("/api/tcgcodex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          cardName: cardName,
          cardNumber: card.number,
        }),
      });

      if (!searchResponse.ok) {
        const errorData = await searchResponse.json().catch(() => ({}));
        console.error(`  ✗ API Error:`, errorData);
        return {
          tcgPlayerCard: card,
          found: false,
          error: errorData.error || `API Error: ${searchResponse.status}`,
        };
      }

      const data = await searchResponse.json();
      const cards = data.data || [];

      if (cards.length === 0) {
        console.log(`  ✗ No match found`);
        return {
          tcgPlayerCard: card,
          found: false,
          error: "No match found",
        };
      }

      // Get the first match
      const matchedCard = cards[0];
      const attrs = matchedCard.attributes || {};

      console.log(`  ✓ Found: ${attrs.name}`);

      // Try to get price
      let price = 0;
      try {
        const priceResponse = await fetch("/api/tcgcodex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "prices",
            cardId: matchedCard.id,
          }),
        });

        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          if (priceData.data && priceData.data.length > 0) {
            const firstPrice = priceData.data[0];
            price = firstPrice.attributes?.price || 0;
          }
        }
      } catch (e) {
        // Price fetch failed, continue without price
        console.warn(`  ⚠ Could not fetch price`);
      }

      return {
        tcgPlayerCard: card,
        found: true,
        tcgCodexCard: {
          id: matchedCard.id,
          name: attrs.name,
          setName: attrs.set?.name || "Unknown",
          number: attrs.number,
          rarity: attrs.rarity?.rarity,
          image: attrs.image ? `https://tcgcodex.com/${attrs.image}` : null,
        },
        price,
      };
    } catch (error: any) {
      console.error(`  ✗ Error:`, error.message);
      return {
        tcgPlayerCard: card,
        found: false,
        error: error.message,
      };
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setResults([]);
    }
  };

  const processCSV = async () => {
    if (!file) {
      toast.error("Please upload a CSV file");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      // Read file with proper encoding detection
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Detect encoding by checking BOM
      let text = "";
      if (uint8Array[0] === 0xff && uint8Array[1] === 0xfe) {
        // UTF-16 LE BOM
        console.log("📄 Detected UTF-16 LE encoding");
        const decoder = new TextDecoder("utf-16le");
        text = decoder.decode(uint8Array);
      } else if (uint8Array[0] === 0xfe && uint8Array[1] === 0xff) {
        // UTF-16 BE BOM
        console.log("📄 Detected UTF-16 BE encoding");
        const decoder = new TextDecoder("utf-16be");
        text = decoder.decode(uint8Array);
      } else if (
        uint8Array[0] === 0xef &&
        uint8Array[1] === 0xbb &&
        uint8Array[2] === 0xbf
      ) {
        // UTF-8 BOM
        console.log("📄 Detected UTF-8 encoding");
        const decoder = new TextDecoder("utf-8");
        text = decoder.decode(uint8Array);
      } else {
        // No BOM, assume UTF-8
        console.log("📄 No BOM detected, assuming UTF-8");
        const decoder = new TextDecoder("utf-8");
        text = decoder.decode(uint8Array);
      }

      const cards = parseTCGPlayerCSV(text);

      if (cards.length === 0) {
        toast.error("No valid cards found in CSV. Check console for details.");
        setLoading(false);
        return;
      }

      console.log(`📋 Parsed ${cards.length} cards from CSV`);
      setProgress({ current: 0, total: cards.length });

      // Process each card
      const matches: TCGCodexMatch[] = [];

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        console.log(
          `🔍 [${i + 1}/${cards.length}] Searching: ${card.productName}`,
        );

        const match = await searchTCGCodex(card);
        matches.push(match);
        setProgress({ current: i + 1, total: cards.length });

        // Update results in real-time
        setResults([...matches]);

        // Rate limiting: wait 100ms between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const foundCount = matches.filter((m) => m.found).length;
      toast.success(
        `✅ Processed ${cards.length} cards. Found ${foundCount} matches!`,
      );
    } catch (error: any) {
      console.error("Error processing CSV:", error);
      toast.error(`Failed to process CSV: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exportResults = () => {
    if (results.length === 0) {
      toast.error("No results to export");
      return;
    }

    const csvLines = [
      "TCGPlayer Name,Number,Set,Rarity,Qty,Found,TCGCodex Name,TCGCodex Set,TCGCodex Number,Price,Error",
    ];

    results.forEach((result) => {
      const tc = result.tcgPlayerCard;
      const cx = result.tcgCodexCard;

      csvLines.push(
        [
          `"${tc.productName}"`,
          `"${tc.number}"`,
          `"${tc.set}"`,
          `"${tc.rarity}"`,
          tc.quantity,
          result.found ? "YES" : "NO",
          cx ? `"${cx.name}"` : "",
          cx ? `"${cx.setName}"` : "",
          cx ? `"${cx.number}"` : "",
          result.price || "",
          result.error ? `"${result.error}"` : "",
        ].join(","),
      );
    });

    const csvContent = csvLines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tcgcodex_matches_${Date.now()}.csv`;
    a.click();

    toast.success("✅ Results exported!");
  };

  const foundCount = results.filter((r) => r.found).length;
  const notFoundCount = results.filter((r) => !r.found).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">
          🔄 TCGPlayer → TCGCodex Matcher
        </h1>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Upload TCGPlayer CSV</h2>
          <div className="space-y-4">
            <div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </div>
            {file && (
              <div className="text-sm text-gray-600">
                Selected: <span className="font-semibold">{file.name}</span>
              </div>
            )}
            <Button
              onClick={processCSV}
              disabled={!file || loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading
                ? `Processing... (${progress.current}/${progress.total})`
                : "Find Matches on TCGCodex"}
            </Button>
          </div>
        </div>

        {/* Progress */}
        {loading && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Progress:</span>
              <span className="text-sm">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Results Summary</h2>
              <Button onClick={exportResults} variant="outline">
                📥 Export to CSV
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-3xl font-bold">{results.length}</div>
                <div className="text-sm text-gray-600">Total Cards</div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-3xl font-bold text-green-600">
                  {foundCount}
                </div>
                <div className="text-sm text-gray-600">Found on TCGCodex</div>
              </div>
              <div className="bg-red-50 p-4 rounded">
                <div className="text-3xl font-bold text-red-600">
                  {notFoundCount}
                </div>
                <div className="text-sm text-gray-600">Not Found</div>
              </div>
            </div>
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">#</th>
                    <th className="text-left p-3 font-semibold">
                      TCGPlayer Card
                    </th>
                    <th className="text-left p-3 font-semibold">Number</th>
                    <th className="text-left p-3 font-semibold">Set</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">
                      TCGCodex Match
                    </th>
                    <th className="text-left p-3 font-semibold">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3">{idx + 1}</td>
                      <td className="p-3">
                        <div className="font-semibold">
                          {result.tcgPlayerCard.productName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.tcgPlayerCard.condition} • Qty:{" "}
                          {result.tcgPlayerCard.quantity}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {result.tcgPlayerCard.number}
                      </td>
                      <td className="p-3 text-xs">
                        {result.tcgPlayerCard.set}
                      </td>
                      <td className="p-3">
                        {result.found ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                            ✓ Found
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                            ✗ Not Found
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {result.tcgCodexCard ? (
                          <div>
                            <div className="font-semibold text-xs">
                              {result.tcgCodexCard.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {result.tcgCodexCard.setName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-red-600">
                            {result.error}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {result.price ? (
                          <span className="font-semibold text-green-600">
                            ${result.price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
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
