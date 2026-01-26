"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  searchCards,
  setAPIProvider,
  getAvailableProviders,
  getProviderName,
  type APIProvider,
} from "@/lib/card-api-adapter";
import { createInventoryItem } from "@/lib/firebase/inventory";
import {
  calculateCostBasis,
  calculateSellPrice,
  getPricingBreakdown,
} from "@/lib/pricing";
import { Button } from "@/components/ui/button";

const GAME_MAPPING: Record<string, string> = {
  pokemon: "pokemon",
  mtg: "mtg",
  onepiece: "one-piece-card-game",
  lorcana: "disney-lorcana",
  digimon: "digimon-card-game",
  yugioh: "yugioh",
  "flesh-and-blood": "flesh-and-blood-tcg",
  "star-wars": "star-wars-unlimited",
  "dragon-ball": "dragon-ball-super-fusion-world",
};

const intakeSchema = z.object({
  cardId: z.string().min(1, "Card is required"),
  condition: z.string().min(1, "Condition is required"),
  printing: z.string().min(1, "Printing is required"),
  language: z.string().default("English"),
  acquisitionType: z.enum(["buy", "trade", "pull"]),
  costBasis: z.number().min(0, "Cost basis must be positive"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  location: z.string().min(1, "Location is required"),
  notes: z.string().optional(),
});

type IntakeFormData = z.infer<typeof intakeSchema>;

export default function IntakePage() {
  const [apiProvider, setApiProviderState] = useState<APIProvider | null>(null);
  const [availableProviders, setAvailableProviders] = useState<APIProvider[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [gameFilter, setGameFilter] = useState("pokemon");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [availableConditions, setAvailableConditions] = useState<string[]>([]);
  const [marketPrice, setMarketPrice] = useState(0);
  const [costBasis, setCostBasis] = useState(0);
  const [suggestedPrice, setSuggestedPrice] = useState(0);
  const [profit, setProfit] = useState(0);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const form = useForm<IntakeFormData>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      quantity: 1,
      language: "English",
      acquisitionType: "buy",
      condition: "NM",
      printing: "Normal",
      location: "A-1",
      costBasis: 0,
    },
  });

  useEffect(() => {
    const providers = getAvailableProviders();
    setAvailableProviders(providers);

    if (providers.length === 0) {
      toast.error("No API keys configured!");
      return;
    }

    const preferredProvider = providers.includes("tcgcodex")
      ? "tcgcodex"
      : providers[0];

    setApiProviderState(preferredProvider);
    setAPIProvider(preferredProvider);
  }, []);

  const handleProviderChange = (provider: APIProvider) => {
    setApiProviderState(provider);
    setAPIProvider(provider);
    toast.success(`Switched to ${getProviderName(provider)}`);
    setSearchResults([]);
    setSelectedCard(null);
    setStep(1);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() && !cardNumber.trim()) {
      toast.error("Please enter a card name or number");
      return;
    }

    setLoading(true);
    try {
      const gameSlug = GAME_MAPPING[gameFilter] || gameFilter;

      const results = await searchCards({
        q: searchQuery || undefined,
        number: cardNumber || undefined,
        game: gameSlug,
        limit: 20,
      });

      setSearchResults(results || []);

      if (!results || results.length === 0) {
        toast.info("No cards found. Try a different search.");
      } else {
        toast.success(`Found ${results.length} cards`);
      }
    } catch (error: any) {
      console.error("❌ Search error:", error);
      toast.error(error.message || "Search failed");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Recalculate pricing when acquisition type or condition changes
  const updatePricing = async (
    market: number,
    acqType: "buy" | "trade" | "pull",
    cond: string,
  ) => {
    try {
      console.log("💰 Calculating pricing:", { market, acqType, cond });

      const breakdown = await getPricingBreakdown(market, acqType, cond);

      console.log("💰 Pricing breakdown:", breakdown);

      setCostBasis(breakdown.costBasis);
      setSuggestedPrice(breakdown.sellPrice);
      setProfit(breakdown.profit);

      form.setValue("costBasis", breakdown.costBasis);
    } catch (error) {
      console.error("❌ Failed to calculate pricing:", error);

      // Fallback to manual calculation if Firebase fails
      let fallbackCost = 0;
      if (acqType === "buy") {
        fallbackCost = market * 0.7;
      } else if (acqType === "trade") {
        fallbackCost = market * 0.75;
      }

      const fallbackSell = market * 1.15;
      const fallbackProfit = fallbackSell - fallbackCost;

      console.log("⚠️ Using fallback pricing:", {
        fallbackCost,
        fallbackSell,
        fallbackProfit,
      });

      setCostBasis(fallbackCost);
      setSuggestedPrice(fallbackSell);
      setProfit(fallbackProfit);
      form.setValue("costBasis", fallbackCost);

      toast.warning("Using default pricing (Firebase unavailable)");
    }
  };

  const handleSelectCard = async (card: any) => {
    console.log("🎯 Card selected:", card);

    try {
      setSelectedCard(card);
      setStep(2);
      form.setValue("cardId", String(card.id));

      if (!card.variants || card.variants.length === 0) {
        toast.warning("No pricing available. Please enter manually.");

        form.setValue("condition", "NM");
        form.setValue("printing", "Normal");
        setMarketPrice(0);
        setCostBasis(0);
        setSuggestedPrice(0);
        setAvailableConditions(["NM", "LP", "MP", "HP", "DMG"]);
        return;
      }

      const conditions = [
        ...new Set(
          card.variants
            .map((v: any) => v.condition)
            .filter((c: any) => c && c.trim()),
        ),
      ];

      if (conditions.length === 0) {
        setAvailableConditions(["NM", "LP", "MP", "HP", "DMG"]);
        form.setValue("condition", "NM");
      } else {
        setAvailableConditions(conditions);
        form.setValue("condition", conditions[0]);
      }

      const variantWithPrice = card.variants.find(
        (v: any) => v.price && v.price > 0,
      );

      if (variantWithPrice) {
        const price = variantWithPrice.price;
        setMarketPrice(price);

        // Set form values FIRST
        form.setValue("condition", variantWithPrice.condition || "NM");
        form.setValue("printing", variantWithPrice.printing || "Normal");
        form.setValue("acquisitionType", "buy"); // Ensure acquisition type is set

        // Then calculate pricing based on default acquisition type (buy)
        await updatePricing(price, "buy", variantWithPrice.condition || "NM");
      } else {
        toast.warning("No price available. Please enter manually.");
        setMarketPrice(0);
        setCostBasis(0);
        setSuggestedPrice(0);
        form.setValue("printing", card.variants[0]?.printing || "Normal");
      }
    } catch (error: any) {
      console.error("❌ Error selecting card:", error);
      toast.error("Error loading card details");
    }
  };

  const handleAcquisitionTypeChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const acqType = e.target.value as "buy" | "trade" | "pull";
    form.setValue("acquisitionType", acqType);

    if (marketPrice > 0) {
      await updatePricing(marketPrice, acqType, form.getValues("condition"));
    }
  };

  const handleConditionChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const condition = e.target.value;
    form.setValue("condition", condition);

    if (marketPrice > 0) {
      await updatePricing(
        marketPrice,
        form.getValues("acquisitionType"),
        condition,
      );
    }
  };

  const onSubmit = async (data: IntakeFormData) => {
    if (!selectedCard) {
      toast.error("Please select a card");
      return;
    }

    if (suggestedPrice === 0) {
      toast.error("Please set a sell price");
      return;
    }

    setLoading(true);
    try {
      const sku = await createInventoryItem({
        ...data,
        cardName: selectedCard.name,
        setName: selectedCard.setName || "Unknown Set",
        game: selectedCard.game || gameFilter,
        marketPrice,
        sellPrice: suggestedPrice,
        status: "priced",
        priceSource: apiProvider ? getProviderName(apiProvider) : "Unknown",
        imageUrl: selectedCard.imageUrl,
      } as any);

      toast.success(`✅ Card added! SKU: ${sku}`);

      form.reset();
      setSelectedCard(null);
      setSearchQuery("");
      setCardNumber("");
      setSearchResults([]);
      setMarketPrice(0);
      setCostBasis(0);
      setSuggestedPrice(0);
      setProfit(0);
      setAvailableConditions([]);
      setStep(1);
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(`Failed to add card: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!apiProvider) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Singles Intake</h1>
              <p className="text-gray-600">
                Search for cards and add them to your inventory
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Currently using:{" "}
                <span className="font-semibold">
                  {getProviderName(apiProvider)}
                </span>
              </p>
            </div>

            {availableProviders.length > 1 && (
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Price Source
                </label>
                <div className="flex gap-2">
                  {availableProviders.map((provider) => (
                    <button
                      key={provider}
                      onClick={() => handleProviderChange(provider)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        apiProvider === provider
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {getProviderName(provider)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center mb-8">
          <div
            className={`flex items-center ${step >= 1 ? "text-blue-600" : "text-gray-400"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-blue-600 text-white" : "bg-gray-300"}`}
            >
              1
            </div>
            <span className="ml-2 font-medium">Search Card</span>
          </div>
          <div className="w-24 h-1 mx-4 bg-gray-300"></div>
          <div
            className={`flex items-center ${step >= 2 ? "text-blue-600" : "text-gray-400"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-blue-600 text-white" : "bg-gray-300"}`}
            >
              2
            </div>
            <span className="ml-2 font-medium">Add Details</span>
          </div>
        </div>

        {/* Step 1: Search - Same as before */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Search for a Card</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Game</label>
              <select
                value={gameFilter}
                onChange={(e) => setGameFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pokemon">Pokémon</option>
                <option value="mtg">Magic: The Gathering</option>
                <option value="onepiece">One Piece</option>
                <option value="lorcana">Lorcana</option>
                <option value="digimon">Digimon</option>
                <option value="yugioh">Yu-Gi-Oh!</option>
                <option value="flesh-and-blood">Flesh and Blood</option>
                <option value="star-wars">Star Wars Unlimited</option>
                <option value="dragon-ball">Dragon Ball Super</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Card Name
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., Luffy, Pikachu"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Card Number (Optional)
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="e.g., 001, ST01-001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>

            <Button
              onClick={handleSearch}
              disabled={loading}
              size="lg"
              className="w-full mb-6"
            >
              {loading ? "Searching..." : "Search"}
            </Button>

            {searchResults.length > 0 && (
              <div>
                <h3 className="font-medium mb-3">
                  Results ({searchResults.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
                  {searchResults.map((card: any) => (
                    <div
                      key={card.id}
                      onClick={() => handleSelectCard(card)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-lg cursor-pointer transition-all bg-white"
                    >
                      {card.imageUrl && (
                        <div className="mb-3 bg-gray-100 rounded-lg p-2">
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            className="w-full h-48 object-contain rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                      )}

                      <div className="font-semibold text-lg">{card.name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {card.setName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {card.number && `#${card.number}`}{" "}
                        {card.rarity && `• ${card.rarity}`}
                      </div>
                      {card.variants &&
                      card.variants.length > 0 &&
                      card.variants[0]?.price > 0 ? (
                        <div className="text-xs text-blue-600 mt-2 font-medium">
                          ${card.variants[0].price.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 mt-2">
                          No price
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Details with dynamic pricing */}
        {step === 2 && selectedCard && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <Button
              onClick={() => setStep(1)}
              variant="outline"
              className="mb-4"
            >
              ← Back to Search
            </Button>

            <h2 className="text-xl font-semibold mb-4">Card Details</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-4">
              {selectedCard.imageUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={selectedCard.imageUrl}
                    alt={selectedCard.name}
                    className="w-32 h-44 object-contain rounded border border-blue-200"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}

              <div className="flex-1">
                <h3 className="font-bold text-lg">{selectedCard.name}</h3>
                <p className="text-sm text-gray-600">{selectedCard.setName}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedCard.number && `#${selectedCard.number}`}{" "}
                  {selectedCard.rarity && `• ${selectedCard.rarity}`}
                </p>
              </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Acquisition Type *
                  </label>
                  <select
                    {...form.register("acquisitionType")}
                    onChange={handleAcquisitionTypeChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="buy">Buy (Cash)</option>
                    <option value="trade">Trade (Credit)</option>
                    <option value="pull">Pull (Opened)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Condition *
                  </label>
                  <select
                    {...form.register("condition")}
                    onChange={handleConditionChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {availableConditions.map((condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Language
                  </label>
                  <select
                    {...form.register("language")}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="English">English</option>
                    <option value="Japanese">Japanese</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Printing
                  </label>
                  <input
                    type="text"
                    {...form.register("printing")}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    {...form.register("quantity", { valueAsNumber: true })}
                    min="1"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Location *
                  </label>
                  <input
                    type="text"
                    {...form.register("location")}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  {...form.register("notes")}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              {/* Pricing Breakdown */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-semibold mb-4">💰 Pricing Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-gray-600">
                      Market Price
                    </label>
                    <div className="text-xl font-bold">
                      ${marketPrice.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Cost Basis</label>
                    <div className="text-xl font-bold text-red-600">
                      ${costBasis.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">
                      Sell Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={suggestedPrice}
                      onChange={(e) => {
                        const newPrice = parseFloat(e.target.value) || 0;
                        setSuggestedPrice(newPrice);
                        setProfit(newPrice - costBasis);
                      }}
                      className="text-xl font-bold w-full px-2 py-1 border rounded"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Profit</label>
                    <div
                      className={`text-xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      ${profit.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || suggestedPrice === 0}
              >
                {loading ? "Adding..." : "Add to Inventory"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
