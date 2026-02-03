"use client";

import { useState } from "react";

interface SearchResult {
  api: string;
  name: string;
  set: string;
  price: number;
  image?: string;
  rarity?: string;
  number?: string;
}

export default function TripleAPIComparison() {
  const [query, setQuery] = useState("Charizard");
  const [game, setGame] = useState("pokemon");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{
    justtcg: SearchResult[];
    tcgcodex: SearchResult[];
    cardtrader: SearchResult[];
  }>({
    justtcg: [],
    tcgcodex: [],
    cardtrader: [],
  });
  const [errors, setErrors] = useState<{
    justtcg?: string;
    tcgcodex?: string;
    cardtrader?: string;
  }>({});

  const searchAll = async () => {
    setSearching(true);
    setResults({ justtcg: [], tcgcodex: [], cardtrader: [] });
    setErrors({});

    console.log(`\n🔍 Searching all APIs for: "${query}" (${game})`);

    // Search JustTCG
    try {
      console.log("  🟦 Searching JustTCG...");
      const justResponse = await fetch("/api/justtcg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", query, game }),
      });

      if (justResponse.ok) {
        const data = await justResponse.json();
        const formatted = (data.results || []).slice(0, 5).map((card: any) => ({
          api: "JustTCG",
          name: card.name,
          set: card.set_name || "",
          price: card.variants?.[0]?.price || 0,
          image: card.image,
          rarity: card.rarity,
          number: card.number,
        }));
        setResults((prev) => ({ ...prev, justtcg: formatted }));
        console.log(`  ✅ JustTCG: ${formatted.length} results`);
      } else {
        const error = "API error";
        setErrors((prev) => ({ ...prev, justtcg: error }));
        console.log(`  ❌ JustTCG: ${error}`);
      }
    } catch (error: any) {
      setErrors((prev) => ({ ...prev, justtcg: error.message }));
      console.log(`  ❌ JustTCG: ${error.message}`);
    }

    // Search TCGCodex
    try {
      console.log("  🟩 Searching TCGCodex...");
      const tcgResponse = await fetch("/api/tcgcodex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", query, game }),
      });

      if (tcgResponse.ok) {
        const data = await tcgResponse.json();
        const formatted = (data.results || []).slice(0, 5).map((card: any) => ({
          api: "TCGCodex",
          name: card.name,
          set: card.set_name || "",
          price: card.market_price || 0,
          image: card.image,
          rarity: card.rarity,
          number: card.number,
        }));
        setResults((prev) => ({ ...prev, tcgcodex: formatted }));
        console.log(`  ✅ TCGCodex: ${formatted.length} results`);
      } else {
        const error = "API error";
        setErrors((prev) => ({ ...prev, tcgcodex: error }));
        console.log(`  ❌ TCGCodex: ${error}`);
      }
    } catch (error: any) {
      setErrors((prev) => ({ ...prev, tcgcodex: error.message }));
      console.log(`  ❌ TCGCodex: ${error.message}`);
    }

    // Search CardTrader
    try {
      console.log("  🟨 Searching CardTrader...");
      const ctResponse = await fetch("/api/cardtrader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", query, game }),
      });

      if (ctResponse.ok) {
        const data = await ctResponse.json();
        const formatted = (data.results || []).slice(0, 5).map((card: any) => ({
          api: "CardTrader",
          name: card.name,
          set: card.set_name || "",
          price: card.market_price || 0,
          image: card.image,
          rarity: card.rarity,
          number: card.number,
        }));
        setResults((prev) => ({ ...prev, cardtrader: formatted }));
        console.log(`  ✅ CardTrader: ${formatted.length} results`);
      } else {
        const data = await ctResponse.json();
        const error = data.error || "API error";
        setErrors((prev) => ({ ...prev, cardtrader: error }));
        console.log(`  ❌ CardTrader: ${error}`);
      }
    } catch (error: any) {
      setErrors((prev) => ({ ...prev, cardtrader: error.message }));
      console.log(`  ❌ CardTrader: ${error.message}`);
    }

    setSearching(false);
  };

  const totalResults =
    results.justtcg.length +
    results.tcgcodex.length +
    results.cardtrader.length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Triple API Price Comparison
          </h1>
          <p className="text-gray-600">
            Compare prices from JustTCG, TCGCodex, and CardTrader
          </p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Name
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && searchAll()}
                placeholder="e.g., Charizard, Pikachu"
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Game
              </label>
              <select
                value={game}
                onChange={(e) => setGame(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
              >
                <option value="pokemon">Pokemon</option>
                <option value="magic">Magic: The Gathering</option>
                <option value="yugioh">Yu-Gi-Oh!</option>
                <option value="onepiece">One Piece</option>
              </select>
            </div>
          </div>

          <button
            onClick={searchAll}
            disabled={searching}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg"
          >
            {searching ? "🔍 Searching All APIs..." : "🔍 Search All APIs"}
          </button>
        </div>

        {/* Results Summary */}
        {totalResults > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Summary</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {results.justtcg.length}
                </div>
                <div className="text-sm text-gray-600">JustTCG Results</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {results.tcgcodex.length}
                </div>
                <div className="text-sm text-gray-600">TCGCodex Results</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {results.cardtrader.length}
                </div>
                <div className="text-sm text-gray-600">CardTrader Results</div>
              </div>
            </div>
          </div>
        )}

        {/* API Results */}
        <div className="grid grid-cols-3 gap-6">
          {/* JustTCG */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-blue-600 text-white p-4">
              <h3 className="text-xl font-bold">🟦 JustTCG</h3>
              <div className="text-sm opacity-90">
                {results.justtcg.length} results
              </div>
            </div>
            <div className="p-4">
              {errors.justtcg && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-4">
                  {errors.justtcg}
                </div>
              )}
              {results.justtcg.length === 0 && !errors.justtcg && (
                <div className="text-center text-gray-500 py-8">No results</div>
              )}
              <div className="space-y-3">
                {results.justtcg.map((card, i) => (
                  <div key={i} className="border border-gray-200 rounded p-3">
                    <div className="font-semibold text-sm mb-1">
                      {card.name}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">{card.set}</div>
                    <div className="text-lg font-bold text-green-600">
                      ${card.price.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TCGCodex */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-green-600 text-white p-4">
              <h3 className="text-xl font-bold">🟩 TCGCodex</h3>
              <div className="text-sm opacity-90">
                {results.tcgcodex.length} results
              </div>
            </div>
            <div className="p-4">
              {errors.tcgcodex && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-4">
                  {errors.tcgcodex}
                </div>
              )}
              {results.tcgcodex.length === 0 && !errors.tcgcodex && (
                <div className="text-center text-gray-500 py-8">No results</div>
              )}
              <div className="space-y-3">
                {results.tcgcodex.map((card, i) => (
                  <div key={i} className="border border-gray-200 rounded p-3">
                    <div className="font-semibold text-sm mb-1">
                      {card.name}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">{card.set}</div>
                    <div className="text-lg font-bold text-green-600">
                      ${card.price.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CardTrader */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-yellow-500 text-white p-4">
              <h3 className="text-xl font-bold">🟨 CardTrader</h3>
              <div className="text-sm opacity-90">
                {results.cardtrader.length} results
              </div>
            </div>
            <div className="p-4">
              {errors.cardtrader && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-4">
                  {errors.cardtrader}
                </div>
              )}
              {results.cardtrader.length === 0 && !errors.cardtrader && (
                <div className="text-center text-gray-500 py-8">No results</div>
              )}
              <div className="space-y-3">
                {results.cardtrader.map((card, i) => (
                  <div key={i} className="border border-gray-200 rounded p-3">
                    <div className="font-semibold text-sm mb-1">
                      {card.name}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">{card.set}</div>
                    <div className="text-lg font-bold text-green-600">
                      ${card.price.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
