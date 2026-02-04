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

interface JustTCGMatch {
  tcgPlayerCard: TCGPlayerCard;
  found: boolean;
  justTCGCard?: any;
  price?: number;
  error?: string;
}

export default function TCGPlayerMatcherPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<JustTCGMatch[]>([]);
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

  const searchJustTCG = async (card: TCGPlayerCard): Promise<JustTCGMatch> => {
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

      console.log(
        `🔍 Searching JustTCG: "${cardName}" #${card.number} from "${card.set}"`,
      );

      // Try 1: Search with card name AND number in query
      let searchResponse = await fetch("/api/justtcg", {
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
        console.error(`❌ API Error:`, errorData);
        return {
          tcgPlayerCard: card,
          found: false,
          error: errorData.error || `API Error: ${searchResponse.status}`,
        };
      }

      let data = await searchResponse.json();
      let cards = data.data || [];

      console.log(`📊 Search with name+number: ${cards.length} results`);

      // Try 2: If no results, search with name only (fallback)
      if (cards.length === 0) {
        console.log(`🔄 Retrying with name only...`);

        // Add delay before retry to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));

        searchResponse = await fetch("/api/justtcg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "search",
            cardName: cardName,
            cardNumber: "", // No number this time
          }),
        });

        if (searchResponse.ok) {
          data = await searchResponse.json();
          cards = data.data || [];
          console.log(`📊 Search with name only: ${cards.length} results`);
        }
      }

      if (cards.length === 0) {
        console.log(`❌ NO MATCH for "${cardName}"`);
        return {
          tcgPlayerCard: card,
          found: false,
          error: "No match found in JustTCG",
        };
      }

      // Get the first match
      const matchedCard = cards[0];

      // LOG THE COMPLETE CARD DATA
      console.log(
        `✅ FOUND CARD - FULL DATA:`,
        JSON.stringify(matchedCard, null, 2),
      );

      console.log(
        `✅ FOUND: "${matchedCard.name}" #${matchedCard.number || "N/A"} from "${matchedCard.set_name || "Unknown"}"`,
      );

      // Extract price from card variants (search already returns full variant data!)
      let price = 0;

      if (matchedCard.variants && matchedCard.variants.length > 0) {
        // Use first variant (usually Near Mint)
        const firstVariant = matchedCard.variants[0];
        price = firstVariant.price || 0;
        console.log(
          `💰 Price from variants: $${price.toFixed(2)} (${firstVariant.condition} - ${firstVariant.printing})`,
        );
      } else if (matchedCard.price) {
        price = matchedCard.price;
        console.log(`💰 Price from card: $${price.toFixed(2)}`);
      } else {
        console.log(`⚠️ No price data available for this card`);
      }

      return {
        tcgPlayerCard: card,
        found: true,
        justTCGCard: {
          id: matchedCard.id,
          name: matchedCard.name,
          setName: matchedCard.set?.name || "Unknown",
          number: matchedCard.number,
          rarity: matchedCard.rarity,
          image: matchedCard.image,
        },
        price,
      };
    } catch (error: any) {
      console.error(`❌ Search error:`, error);
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

      // JustTCG rate limit: 10 requests per minute
      // Each card needs 1-2 requests (search, maybe price)
      // Safe rate: 1 card every 6-12 seconds
      const DELAY_MS = 6000; // 6 seconds between cards
      const estimatedMinutes = Math.ceil((cards.length * DELAY_MS) / 1000 / 60);

      console.log(
        `⏱️ Processing ${cards.length} cards (~${estimatedMinutes} min at 10 req/min limit)`,
      );

      const allMatches: JustTCGMatch[] = [];

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const remainingCards = cards.length - i - 1;
        const remainingMin = Math.ceil((remainingCards * DELAY_MS) / 1000 / 60);

        console.log(
          `\n🔍 [${i + 1}/${cards.length}] ${card.productName} (~${remainingMin} min left)`,
        );

        const match = await searchJustTCG(card);
        allMatches.push(match);

        // Update progress
        setProgress({ current: i + 1, total: cards.length });
        setResults([...allMatches]);

        // Rate limiting: Wait 6 seconds between requests
        if (i < cards.length - 1) {
          console.log(`⏱️ Waiting 6 seconds for rate limit...`);
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
      }

      const foundCount = allMatches.filter((m) => m.found).length;
      const notFoundCount = allMatches.filter((m) => !m.found).length;
      const withPrices = allMatches.filter(
        (m) => m.found && m.price && m.price > 0,
      ).length;
      const totalValue = allMatches
        .filter((m) => m.found && m.price)
        .reduce((sum, m) => sum + (m.price || 0) * m.tcgPlayerCard.quantity, 0);

      console.log(`\n📊 COMPARISON SUMMARY:`);
      console.log(
        `✅ Found on JustTCG: ${foundCount}/${cards.length} (${((foundCount / cards.length) * 100).toFixed(1)}%)`,
      );
      console.log(`❌ Not Found: ${notFoundCount}/${cards.length}`);
      console.log(`💰 Cards with Prices: ${withPrices}/${foundCount}`);
      console.log(`💵 Total Value: $${totalValue.toFixed(2)}`);

      // Show not found cards
      const notFound = allMatches.filter((m) => !m.found);
      if (notFound.length > 0) {
        console.log(`\n❌ Cards NOT FOUND on JustTCG:`);
        notFound.forEach((nf) => {
          console.log(
            `  - ${nf.tcgPlayerCard.productName} (${nf.tcgPlayerCard.set})`,
          );
        });
      }

      // Show top 10 most valuable cards
      const topCards = [...allMatches]
        .filter((m) => m.found && m.price)
        .sort((a, b) => (b.price || 0) - (a.price || 0))
        .slice(0, 10);

      if (topCards.length > 0) {
        console.log(`\n💎 TOP 10 MOST VALUABLE CARDS:`);
        topCards.forEach((card, idx) => {
          console.log(
            `  ${idx + 1}. ${card.justTCGCard?.name} - $${card.price?.toFixed(2)}`,
          );
        });
      }

      toast.success(
        `✅ Processed ${cards.length} cards. Found ${foundCount} matches (${withPrices} with prices)!`,
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
      "TCGPlayer Name,Number,Set,Rarity,Qty,Found,JustTCG Name,JustTCG Set,JustTCG Number,JustTCG Price,TCGPlayer Saved Price,Price Difference,Error",
    ];

    results.forEach((result) => {
      const tc = result.tcgPlayerCard;
      const cx = result.justTCGCard;
      const justTCGPrice = result.price || 0;
      const tcgPlayerPrice = tc.savedPrice ? parseFloat(tc.savedPrice) : 0;
      const priceDiff =
        justTCGPrice && tcgPlayerPrice
          ? (justTCGPrice - tcgPlayerPrice).toFixed(2)
          : "";

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
          tcgPlayerPrice || "",
          priceDiff,
          result.error ? `"${result.error}"` : "",
        ].join(","),
      );
    });

    const csvContent = csvLines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `justtcg_matches_${Date.now()}.csv`;
    a.click();

    toast.success("✅ Results exported!");
  };

  const foundCount = results.filter((r) => r.found).length;
  const notFoundCount = results.filter((r) => !r.found).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">
          🔄 TCGPlayer → JustTCG Matcher
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
                : "Find Matches on JustTCG"}
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
              <h2 className="text-2xl font-semibold">
                TCGPlayer vs JustTCG Comparison
              </h2>
              <Button onClick={exportResults} variant="outline">
                📥 Export to CSV
              </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-3xl font-bold">{results.length}</div>
                <div className="text-sm text-gray-600">Total Cards</div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-3xl font-bold text-green-600">
                  {foundCount}
                </div>
                <div className="text-sm text-gray-600">Found on JustTCG</div>
                <div className="text-xs text-green-700 mt-1">
                  {((foundCount / results.length) * 100).toFixed(1)}% match rate
                </div>
              </div>
              <div className="bg-red-50 p-4 rounded">
                <div className="text-3xl font-bold text-red-600">
                  {notFoundCount}
                </div>
                <div className="text-sm text-gray-600">Not Found</div>
              </div>
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-3xl font-bold text-blue-600">
                  {
                    results.filter((r) => r.found && r.price && r.price > 0)
                      .length
                  }
                </div>
                <div className="text-sm text-gray-600">With Prices</div>
              </div>
            </div>

            {/* Total Value */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">
                    Total Collection Value
                  </div>
                  <div className="text-3xl font-bold text-green-700">
                    $
                    {results
                      .filter((r) => r.found && r.price)
                      .reduce(
                        (sum, r) =>
                          sum + (r.price || 0) * r.tcgPlayerCard.quantity,
                        0,
                      )
                      .toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Average Price</div>
                  <div className="text-xl font-semibold text-blue-700">
                    $
                    {(
                      results
                        .filter((r) => r.found && r.price && r.price > 0)
                        .reduce((sum, r) => sum + (r.price || 0), 0) /
                        results.filter((r) => r.found && r.price && r.price > 0)
                          .length || 0
                    ).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Cards */}
            {results.filter((r) => r.found && r.price && r.price > 0).length >
              0 && (
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">💎 Top 5 Most Valuable</h3>
                <div className="space-y-1">
                  {[...results]
                    .filter((r) => r.found && r.price)
                    .sort((a, b) => (b.price || 0) - (a.price || 0))
                    .slice(0, 5)
                    .map((r, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="truncate mr-2">
                          {r.justTCGCard?.name}
                        </span>
                        <span className="font-semibold text-green-700">
                          ${r.price?.toFixed(2)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
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
                      JustTCG Match
                    </th>
                    <th className="text-left p-3 font-semibold">
                      JustTCG Price
                    </th>
                    <th className="text-left p-3 font-semibold">
                      TCGPlayer Price
                    </th>
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
                        {result.justTCGCard ? (
                          <div>
                            <div className="font-semibold text-xs">
                              {result.justTCGCard.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {result.justTCGCard.setName}
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
                      <td className="p-3">
                        {result.tcgPlayerCard.savedPrice ? (
                          <span className="font-semibold text-blue-600">
                            $
                            {parseFloat(
                              result.tcgPlayerCard.savedPrice,
                            ).toFixed(2)}
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
