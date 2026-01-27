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
import { Check, X } from "lucide-react";

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

interface SessionCard {
  card: any;
  marketPrice: number;
  buyPrice: number;
  sellPrice: number;
  condition: string;
  accepted: boolean;
}

export default function IntakePage() {
  const [apiProvider, setApiProviderState] = useState<APIProvider | null>(null);
  const [availableProviders, setAvailableProviders] = useState<APIProvider[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [gameFilter, setGameFilter] = useState("onepiece");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [availableConditions, setAvailableConditions] = useState<string[]>([]);
  const [marketPrice, setMarketPrice] = useState(0);
  const [costBasis, setCostBasis] = useState(0);
  const [suggestedPrice, setSuggestedPrice] = useState(0);
  const [profit, setProfit] = useState(0);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=Search, 2=ConditionSelect, 3=Offer, 4=Details
  const [sessionCards, setSessionCards] = useState<SessionCard[]>([]);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [tempSelectedCard, setTempSelectedCard] = useState<any>(null);

  // Pricing settings with defaults (stored as percentages)
  const [conditionBuyPercents, setConditionBuyPercents] = useState({
    NM: 70,
    LP: 65,
    MP: 55,
    HP: 45,
    DMG: 35,
  });
  const [sellMarkupPercent, setSellMarkupPercent] = useState(40);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedBuyPercents = localStorage.getItem("conditionBuyPercents");
    const savedMarkup = localStorage.getItem("sellMarkupPercent");

    if (savedBuyPercents) {
      const loaded = JSON.parse(savedBuyPercents);
      setConditionBuyPercents(loaded);
      console.log("✅ Loaded buy percents:", loaded);
    }
    if (savedMarkup) {
      const loaded = parseFloat(savedMarkup);
      setSellMarkupPercent(loaded);
      console.log("✅ Loaded markup percent:", loaded);
    }
  }, []);

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

  // Debug: Log when prices change
  useEffect(() => {
    if (step === 2 && selectedCard) {
      console.log("📊 Prices updated:", {
        market: marketPrice,
        buyPrice: costBasis,
        sellPrice: suggestedPrice,
        profit: profit,
        condition: form.getValues("condition"),
      });
    }
  }, [costBasis, suggestedPrice, profit, step]);

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

  const updatePricing = async (
    market: number,
    acqType: "buy" | "trade" | "pull",
    cond: string,
  ) => {
    console.log("💰 updatePricing called:", { market, acqType, cond });
    console.log("💰 Current buy percents:", conditionBuyPercents);
    console.log("💰 Current markup percent:", sellMarkupPercent);

    try {
      const breakdown = await getPricingBreakdown(market, acqType, cond);
      console.log("💰 Breakdown from Firebase:", breakdown);

      setCostBasis(breakdown.costBasis);
      setSuggestedPrice(breakdown.sellPrice);
      setProfit(breakdown.profit);
      form.setValue("costBasis", breakdown.costBasis);
    } catch (error) {
      console.log("⚠️ Firebase pricing failed, using fallback with settings");

      // Get buy percent for condition - normalize condition string
      const normalizedCond = cond.toUpperCase().trim();
      const buyPercent =
        conditionBuyPercents[
          normalizedCond as keyof typeof conditionBuyPercents
        ] || conditionBuyPercents.NM;

      console.log("💰 Condition lookup:", {
        original: cond,
        normalized: normalizedCond,
        buyPercent: buyPercent,
        availableKeys: Object.keys(conditionBuyPercents),
      });

      let fallbackCost = 0;
      if (acqType === "buy") {
        fallbackCost = market * (buyPercent / 100); // Convert percent to decimal
      } else if (acqType === "trade") {
        fallbackCost = market * ((buyPercent + 5) / 100); // Trade is 5% more
      }
      // pull = 0 cost

      // Sell price uses markup percent
      const fallbackSell = fallbackCost * (1 + sellMarkupPercent / 100);
      const fallbackProfit = fallbackSell - fallbackCost;

      console.log("💰 Fallback pricing calculated:", {
        condition: normalizedCond,
        buyPercent: buyPercent,
        marketPrice: market,
        buyPrice: fallbackCost,
        sellMarkupPercent: sellMarkupPercent,
        sellPrice: fallbackSell,
        profit: fallbackProfit,
      });

      setCostBasis(fallbackCost);
      setSuggestedPrice(fallbackSell);
      setProfit(fallbackProfit);
      form.setValue("costBasis", fallbackCost);

      console.log(
        "💰 State updated - costBasis:",
        fallbackCost,
        "suggestedPrice:",
        fallbackSell,
      );
    }
  };

  const handleSelectCard = async (card: any) => {
    try {
      setTempSelectedCard(card);

      // Always show all conditions - employee needs to pick based on physical card
      setAvailableConditions(["NM", "LP", "MP", "HP", "DMG"]);

      // Show condition selection modal
      setShowConditionModal(true);
    } catch (error: any) {
      console.error("❌ Error selecting card:", error);
      toast.error("Error loading card details");
    }
  };

  const handleConditionSelected = async (selectedCondition: string) => {
    if (!tempSelectedCard) return;

    try {
      setSelectedCard(tempSelectedCard);
      setShowConditionModal(false);
      setStep(2); // Go to offer screen
      form.setValue("cardId", String(tempSelectedCard.id));
      form.setValue("condition", selectedCondition);

      // Always ensure all conditions are available for adjustment on offer screen
      setAvailableConditions(["NM", "LP", "MP", "HP", "DMG"]);

      // Try to find a variant with this specific condition
      let variantWithPrice = tempSelectedCard.variants?.find(
        (v: any) => v.condition === selectedCondition && v.price && v.price > 0,
      );

      // If no exact match, use any variant with a price
      if (!variantWithPrice) {
        variantWithPrice = tempSelectedCard.variants?.find(
          (v: any) => v.price && v.price > 0,
        );
      }

      if (variantWithPrice) {
        // Use the market price from API
        const marketPriceFromAPI = variantWithPrice.price;
        setMarketPrice(marketPriceFromAPI);
        form.setValue("printing", variantWithPrice.printing || "Normal");
        form.setValue("acquisitionType", "buy");

        // Calculate buy price based on selected condition
        await updatePricing(marketPriceFromAPI, "buy", selectedCondition);
      } else {
        // No price available
        toast.warning("No price available for this card");
        setMarketPrice(0);
        setCostBasis(0);
        setSuggestedPrice(0);
        form.setValue("printing", "Normal");
      }
    } catch (error: any) {
      console.error("❌ Error selecting condition:", error);
      toast.error("Error loading pricing");
    }
  };

  const handleAcceptOffer = () => {
    // Move to detailed form
    setStep(3);
  };

  const handleDeclineOffer = () => {
    // Track declined and go back to search
    if (selectedCard) {
      setSessionCards([
        ...sessionCards,
        {
          card: selectedCard,
          marketPrice,
          buyPrice: costBasis,
          sellPrice: suggestedPrice,
          condition: form.getValues("condition"),
          accepted: false,
        },
      ]);
    }

    toast.info(`Declined ${selectedCard?.name}`);
    setSelectedCard(null);
    setSearchQuery("");
    setCardNumber("");
    setStep(1);
  };

  const handleConditionChange = async (condition: string) => {
    console.log(
      "🔄 Condition changed to:",
      condition,
      "Market price:",
      marketPrice,
    );
    form.setValue("condition", condition);
    if (marketPrice > 0) {
      await updatePricing(
        marketPrice,
        form.getValues("acquisitionType"),
        condition,
      );
      // Log the updated values (they'll be in the next render)
      console.log("✅ Pricing update triggered for condition:", condition);
    } else {
      console.warn("⚠️ Cannot update pricing - market price is 0");
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

      // Track accepted
      setSessionCards([
        ...sessionCards,
        {
          card: selectedCard,
          marketPrice,
          buyPrice: costBasis,
          sellPrice: suggestedPrice,
          condition: data.condition,
          accepted: true,
        },
      ]);

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

  const acceptedCards = sessionCards.filter((c) => c.accepted);
  const declinedCards = sessionCards.filter((c) => !c.accepted);
  const totalPayout = acceptedCards.reduce((sum, c) => sum + c.buyPrice, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-5xl">
        {/* Header with Session Stats */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <h1 className="text-4xl font-bold mb-2">Card Intake</h1>
                <a
                  href="/settings"
                  className="inline-flex items-center px-3 py-1 mb-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  ⚙️ Settings
                </a>
              </div>
              <p className="text-gray-600">Make offers to buy cards</p>
              <p className="text-xs text-gray-500 mt-1">
                Using:{" "}
                <span className="font-semibold">
                  {getProviderName(apiProvider)}
                </span>
              </p>
            </div>

            {availableProviders.length > 1 && (
              <div className="bg-white rounded-lg shadow-sm p-4 border">
                <label className="block text-sm font-medium mb-2">
                  Price Source
                </label>
                <div className="flex gap-2">
                  {availableProviders.map((provider) => (
                    <button
                      key={provider}
                      onClick={() => handleProviderChange(provider)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        apiProvider === provider
                          ? "bg-blue-600 text-white"
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

        {/* Session Stats */}
        {sessionCards.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Cards Offered</div>
              <div className="text-2xl font-bold">{sessionCards.length}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Accepted</div>
              <div className="text-2xl font-bold text-green-600">
                {acceptedCards.length}
              </div>
              <div className="text-xs text-gray-500">
                ${totalPayout.toFixed(2)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Declined</div>
              <div className="text-2xl font-bold text-red-600">
                {declinedCards.length}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Payout</div>
              <div className="text-2xl font-bold text-purple-600">
                ${totalPayout.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Search */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Search for a Card</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Game</label>
              <select
                value={gameFilter}
                onChange={(e) => setGameFilter(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="onepiece">One Piece</option>
                <option value="pokemon">Pokémon</option>
                <option value="mtg">Magic: The Gathering</option>
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
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Card Number
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="e.g., OP01-001, ST01-001"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                      className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-lg cursor-pointer transition-all bg-white"
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

        {/* Condition Selection Modal */}
        {showConditionModal && tempSelectedCard && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full mx-4">
              <h2 className="text-2xl font-bold mb-4">Select Condition</h2>

              {/* Card Preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-4">
                {tempSelectedCard.imageUrl && (
                  <div className="flex-shrink-0">
                    <img
                      src={tempSelectedCard.imageUrl}
                      alt={tempSelectedCard.name}
                      className="w-32 h-44 object-contain rounded border border-blue-200"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{tempSelectedCard.name}</h3>
                  <p className="text-sm text-gray-600">
                    {tempSelectedCard.setName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {tempSelectedCard.number && `#${tempSelectedCard.number}`}{" "}
                    {tempSelectedCard.rarity && `• ${tempSelectedCard.rarity}`}
                  </p>
                </div>
              </div>

              <p className="text-gray-600 mb-4">
                Choose the card's condition to see pricing:
              </p>

              {/* Condition Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                {availableConditions.map((condition) => (
                  <button
                    key={condition}
                    onClick={() => handleConditionSelected(condition)}
                    className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
                  >
                    {condition}
                  </button>
                ))}
              </div>

              <Button
                onClick={() => {
                  setShowConditionModal(false);
                  setTempSelectedCard(null);
                }}
                variant="outline"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Offer Screen */}
        {step === 2 && selectedCard && (
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-2xl p-8 text-white">
            <div className="text-center mb-6">
              <div className="text-sm font-semibold text-blue-200 mb-2">
                OFFER FOR CUSTOMER
              </div>
              <h2 className="text-4xl font-bold mb-2">{selectedCard.name}</h2>
              <p className="text-xl text-blue-100">{selectedCard.setName}</p>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
                <div className="text-sm text-blue-200 mb-1">Market Price</div>
                <div className="text-3xl font-bold">
                  ${marketPrice.toFixed(2)}
                </div>
              </div>

              <div className="bg-white bg-opacity-30 rounded-lg p-4 text-center border-4 border-white">
                <div className="text-sm text-blue-100 mb-1 font-semibold">
                  WE OFFER
                </div>
                <div className="text-5xl font-bold text-green-300">
                  ${costBasis.toFixed(2)}
                </div>
                <div className="text-xs text-blue-200 mt-1">
                  (
                  {marketPrice > 0
                    ? ((costBasis / marketPrice) * 100).toFixed(0)
                    : 0}
                  % of market)
                </div>
              </div>

              <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
                <div className="text-sm text-blue-200 mb-1">Our Sell Price</div>
                <div className="text-3xl font-bold">
                  ${suggestedPrice.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Condition Selector */}
            <div className="mb-6">
              <div className="text-sm text-blue-200 mb-2 text-center">
                Adjust Condition:
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                {availableConditions.map((cond) => (
                  <button
                    key={cond}
                    onClick={() => handleConditionChange(cond)}
                    className={`px-4 py-2 rounded font-semibold transition-all ${
                      form.getValues("condition") === cond
                        ? "bg-white text-blue-700"
                        : "bg-white bg-opacity-20 text-white hover:bg-opacity-30"
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div className="bg-white bg-opacity-10 rounded p-3">
                <div className="text-blue-200">Condition</div>
                <div className="font-semibold">
                  {form.getValues("condition")}
                </div>
              </div>
              <div className="bg-white bg-opacity-10 rounded p-3">
                <div className="text-blue-200">Source</div>
                <div className="font-semibold">
                  {getProviderName(apiProvider)}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleDeclineOffer}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xl py-6"
                size="lg"
              >
                <X className="w-6 h-6 mr-2" />
                Decline Offer
              </Button>
              <Button
                onClick={handleAcceptOffer}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xl py-6"
                size="lg"
              >
                <Check className="w-6 h-6 mr-2" />
                Accept Offer
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Details Form */}
        {step === 3 && selectedCard && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <Button
              onClick={() => setStep(2)}
              variant="outline"
              className="mb-4"
            >
              ← Back to Offer
            </Button>

            <h2 className="text-xl font-semibold mb-4">Finalize Details</h2>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-semibold mb-4">💰 Final Pricing</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-gray-600">Market</label>
                    <div className="text-xl font-bold">
                      ${marketPrice.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">We Pay</label>
                    <div className="text-xl font-bold text-red-600">
                      ${costBasis.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">We Sell</label>
                    <div className="text-xl font-bold text-green-600">
                      ${suggestedPrice.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Profit</label>
                    <div className="text-xl font-bold text-blue-600">
                      ${profit.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
                disabled={loading}
              >
                {loading ? "Adding..." : "Add to Inventory"}
              </Button>
            </form>
          </div>
        )}

        {/* Session Summary */}
        {sessionCards.length > 0 && step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {acceptedCards.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-green-600 mb-3">
                  ✓ Accepted ({acceptedCards.length})
                </h3>
                <div className="space-y-2">
                  {acceptedCards.map((sc, idx) => (
                    <div key={idx} className="text-sm bg-green-50 p-2 rounded">
                      <div className="font-medium">{sc.card.name}</div>
                      <div className="text-xs text-gray-600">
                        Paid: ${sc.buyPrice.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {declinedCards.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-red-600 mb-3">
                  ✗ Declined ({declinedCards.length})
                </h3>
                <div className="space-y-2">
                  {declinedCards.map((sc, idx) => (
                    <div
                      key={idx}
                      className="text-sm bg-gray-50 p-2 rounded opacity-60"
                    >
                      <div className="font-medium">{sc.card.name}</div>
                      <div className="text-xs text-gray-600">
                        Offered: ${sc.buyPrice.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
