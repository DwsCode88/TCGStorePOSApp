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
  collection,
  getDocs,
  addDoc,
  getDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
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

// SKU Generator - generates proper SKUs for all item types
const generateSKU = (
  cardNumber?: string,
  tcgplayerId?: string,
  acquisitionType?: string,
  vendorCode?: string
): string => {
  // For consignment with vendor code, use vendor code + card identifier
  if (acquisitionType === 'consignment' && vendorCode) {
    // Use card number if available (e.g., OP01-001)
    if (cardNumber) {
      return `${vendorCode}-${cardNumber}`;
    }
    // Otherwise use TCGPlayer ID
    if (tcgplayerId) {
      return `${vendorCode}-${tcgplayerId}`;
    }
    // Fallback to random if neither available
    const random = Math.floor(100000 + Math.random() * 900000);
    return `${vendorCode}-${random}`;
  }
  
  // For all other items (buy/trade/pull), use card number or TCGPlayer ID
  if (cardNumber) {
    return cardNumber;
  }
  
  if (tcgplayerId) {
    return tcgplayerId;
  }
  
  // Fallback to random
  return `CARD-${Math.floor(100000 + Math.random() * 900000)}`;
};

const intakeSchema = z.object({
  cardId: z.string().min(1, "Card is required"),
  condition: z.string().min(1, "Condition is required"),
  printing: z.string().min(1, "Printing is required"),
  language: z.string().default("English"),
  acquisitionType: z.enum(["buy", "trade", "pull", "consignment"]),
  costBasis: z.number().min(0, "Cost basis must be positive"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  location: z.string().min(1, "Location is required"),
  notes: z.string().optional(),
  consignorPayoutPercent: z.number().optional(),
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

export const dynamic = 'force-dynamic';

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
  const [step, setStep] = useState(1);
  const [sessionCards, setSessionCards] = useState<SessionCard[]>([]);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [tempSelectedCard, setTempSelectedCard] = useState<any>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCardData, setManualCardData] = useState({
    name: "",
    setName: "",
    number: "",
    rarity: "",
    marketPrice: "",
  });
  const [customers, setCustomers] = useState<
    Array<{
      id: string;
      name: string;
      phone: string;
      email: string;
      vendorCode?: string;
    }>
  >([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    vendorCode: "",
  });

  // Pricing settings with defaults (stored as percentages)
  const [conditionBuyPercents, setConditionBuyPercents] = useState({
    NM: 70,
    LP: 65,
    MP: 55,
    HP: 45,
    DMG: 35,
  });
  const [sellMarkupPercent, setSellMarkupPercent] = useState(40);

  // Load settings and customers from localStorage/Firebase on mount
  useEffect(() => {
    const savedBuyPercents = localStorage.getItem("conditionBuyPercents");
    const savedMarkup = localStorage.getItem("sellMarkupPercent");

    if (savedBuyPercents) {
      setConditionBuyPercents(JSON.parse(savedBuyPercents));
    }
    if (savedMarkup) {
      setSellMarkupPercent(parseFloat(savedMarkup));
    }

    // Load customers from Firebase
    const loadCustomers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "customers"));
        const customerList = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          phone: doc.data().phone || "",
          email: doc.data().email || "",
          vendorCode: doc.data().vendorCode || "",
        }));
        setCustomers(customerList);
      } catch (error) {
        console.error("Error loading customers:", error);
      }
    };

    loadCustomers();
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
      consignorPayoutPercent: 60,
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

  const handleAddCustomer = async () => {
    if (!newCustomer.name) {
      toast.error("Customer name is required");
      return;
    }

    if (!newCustomer.phone && !newCustomer.email) {
      toast.error("Please provide phone or email");
      return;
    }

    try {
      const customerData = {
        name: newCustomer.name,
        phone: newCustomer.phone || "",
        email: newCustomer.email || "",
        vendorCode: newCustomer.vendorCode || "",
        createdAt: new Date().toISOString(),
        totalConsignments: 0,
        totalOwed: 0,
      };

      const docRef = await addDoc(collection(db, "customers"), customerData);

      // Add to local state
      const newCustomerData = {
        id: docRef.id,
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email,
        vendorCode: newCustomer.vendorCode,
      };

      setCustomers([...customers, newCustomerData]);
      setSelectedCustomerId(docRef.id);

      // Reset form
      setNewCustomer({ name: "", phone: "", email: "", vendorCode: "" });
      setShowAddCustomerModal(false);

      toast.success(`Customer "${newCustomer.name}" added!`);
    } catch (error: any) {
      console.error("Error adding customer:", error);
      toast.error(`Failed to add customer: ${error.message}`);
    }
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
      console.error("Search error:", error);
      toast.error(error.message || "Search failed");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const updatePricing = async (
    market: number,
    acqType: "buy" | "trade" | "pull" | "consignment",
    cond: string,
  ) => {
    try {
      const breakdown = await getPricingBreakdown(market, acqType, cond);

      const normalizedCond = cond.toUpperCase().trim();
      const expectedBuyPercent =
        conditionBuyPercents[
          normalizedCond as keyof typeof conditionBuyPercents
        ] || conditionBuyPercents.NM;
      const expectedCost = market * (expectedBuyPercent / 100);

      const percentDiff =
        Math.abs((breakdown.costBasis - expectedCost) / expectedCost) * 100;

      if (percentDiff > 1) {
        let localCost = 0;
        if (acqType === "buy") {
          localCost = market * (expectedBuyPercent / 100);
        } else if (acqType === "trade") {
          localCost = market * ((expectedBuyPercent + 5) / 100);
        } else if (acqType === "consignment") {
          const payoutPercent = form.getValues("consignorPayoutPercent") || 70;
          localCost = market * 1.3 * (payoutPercent / 100);
        }

        const localSell = localCost * (1 + sellMarkupPercent / 100);
        const localProfit = localSell - localCost;

        setCostBasis(localCost);
        setSuggestedPrice(localSell);
        setProfit(localProfit);
        form.setValue("costBasis", localCost);
      } else {
        setCostBasis(breakdown.costBasis);
        setSuggestedPrice(breakdown.sellPrice);
        setProfit(breakdown.profit);
        form.setValue("costBasis", breakdown.costBasis);
      }
    } catch (error) {
      const normalizedCond = cond.toUpperCase().trim();
      const buyPercent =
        conditionBuyPercents[
          normalizedCond as keyof typeof conditionBuyPercents
        ] || conditionBuyPercents.NM;

      let fallbackCost = 0;
      if (acqType === "buy") {
        fallbackCost = market * (buyPercent / 100);
      } else if (acqType === "trade") {
        fallbackCost = market * ((buyPercent + 5) / 100);
      } else if (acqType === "consignment") {
        const payoutPercent = form.getValues("consignorPayoutPercent") || 70;
        fallbackCost = market * 1.3 * (payoutPercent / 100);
      }

      const fallbackSell = fallbackCost * (1 + sellMarkupPercent / 100);
      const fallbackProfit = fallbackSell - fallbackCost;

      setCostBasis(fallbackCost);
      setSuggestedPrice(fallbackSell);
      setProfit(fallbackProfit);
      form.setValue("costBasis", fallbackCost);
    }
  };

  const handleSelectCard = async (card: any) => {
    try {
      setTempSelectedCard(card);
      setAvailableConditions(["NM", "LP", "MP", "HP", "DMG"]);
      setShowConditionModal(true);
    } catch (error: any) {
      console.error("Error selecting card:", error);
      toast.error("Error loading card details");
    }
  };

  const handleManualEntry = () => {
    setShowManualEntry(true);
  };

  const handleManualSubmit = () => {
    if (!manualCardData.name || !manualCardData.marketPrice) {
      toast.error("Card name and market price are required");
      return;
    }

    const price = parseFloat(manualCardData.marketPrice);
    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid market price");
      return;
    }

    const manualCard = {
      id: `manual-${Date.now()}`,
      name: manualCardData.name,
      setName: manualCardData.setName || "Unknown Set",
      number: manualCardData.number || "",
      rarity: manualCardData.rarity || "",
      game: gameFilter,
      imageUrl: null,
      variants: [
        {
          price: price,
          condition: "NM",
          printing: "Normal",
        },
      ],
    };

    setTempSelectedCard(manualCard);
    setShowManualEntry(false);
    setAvailableConditions(["NM", "LP", "MP", "HP", "DMG"]);
    setShowConditionModal(true);

    setManualCardData({
      name: "",
      setName: "",
      number: "",
      rarity: "",
      marketPrice: "",
    });

    toast.success("Manual card added");
  };

  const handleConditionSelected = async (selectedCondition: string) => {
    if (!tempSelectedCard) return;

    try {
      setSelectedCard(tempSelectedCard);
      setShowConditionModal(false);
      setStep(2);
      form.setValue("cardId", String(tempSelectedCard.id));
      form.setValue("condition", selectedCondition);

      setAvailableConditions(["NM", "LP", "MP", "HP", "DMG"]);

      let variantWithPrice = tempSelectedCard.variants?.find(
        (v: any) => v.condition === selectedCondition && v.price && v.price > 0,
      );

      if (!variantWithPrice) {
        variantWithPrice = tempSelectedCard.variants?.find(
          (v: any) => v.price && v.price > 0,
        );
      }

      if (variantWithPrice) {
        const marketPriceFromAPI = variantWithPrice.price;
        setMarketPrice(marketPriceFromAPI);
        form.setValue("printing", variantWithPrice.printing || "Normal");
        form.setValue("acquisitionType", "buy");

        await updatePricing(marketPriceFromAPI, "buy", selectedCondition);
      } else {
        toast.warning("No price available for this card");
        setMarketPrice(0);
        setCostBasis(0);
        setSuggestedPrice(0);
        form.setValue("printing", "Normal");
      }
    } catch (error: any) {
      console.error("Error selecting condition:", error);
      toast.error("Error loading pricing");
    }
  };

  const handleAcceptOffer = () => {
    setStep(3);
  };

  const handleDeclineOffer = () => {
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

    if (data.acquisitionType === "consignment") {
      if (!selectedCustomerId) {
        toast.error("Please select a customer for consignment");
        return;
      }
    }

    setLoading(true);
    try {
      let customerVendorCode = "";
      let sku: string;

      if (data.acquisitionType === "consignment" && selectedCustomerId) {
        const customer = customers.find((c) => c.id === selectedCustomerId);
        customerVendorCode = customer?.vendorCode || "";
      }

      sku = generateSKU(
        selectedCard.number || "",
        String(selectedCard.id),
        data.acquisitionType,
        customerVendorCode || undefined
      );

      const inventoryData = {
        ...data,
        sku: sku,
        cardName: selectedCard.name,
        setName: selectedCard.setName || "Unknown Set",
        game: selectedCard.game || gameFilter,
        marketPrice,
        sellPrice: suggestedPrice,
        status: "priced",
        priceSource: apiProvider ? getProviderName(apiProvider) : "Unknown",
        imageUrl: selectedCard.imageUrl,
        ...(data.acquisitionType === "consignment" && {
          customerId: selectedCustomerId,
          customerVendorCode: customerVendorCode,
          consignorPayoutPercent: data.consignorPayoutPercent || 60,
          consignorOwed: 0,
          consignorPaid: false,
          consignmentDate: new Date().toISOString(),
        }),
      };

      const docRef = await addDoc(collection(db, "inventory"), {
        ...inventoryData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

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
      setSelectedCustomerId("");
      setStep(1);
    } catch (error: any) {
      console.error("Error saving card:", error);
      toast.error(`Failed to add card: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const acceptedCards = sessionCards.filter((c) => c.accepted);
  const declinedCards = sessionCards.filter((c) => !c.accepted);
  const totalPayout = acceptedCards.reduce((sum, c) => sum + c.buyPrice, 0);

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
        {/* Header */}
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

            <div className="text-center mb-6">
              <span className="text-gray-500 text-sm">OR</span>
            </div>

            <Button
              onClick={handleManualEntry}
              variant="outline"
              size="lg"
              className="w-full mb-6"
            >
              📝 Manual Entry from TCGplayer
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

        {/* Manual Entry Modal */}
        {showManualEntry && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-2">
                Manual Entry from TCGplayer
              </h2>
              <p className="text-gray-600 mb-6">
                Enter card details and market price from TCGplayer
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Card Name *
                  </label>
                  <input
                    type="text"
                    value={manualCardData.name}
                    onChange={(e) =>
                      setManualCardData({
                        ...manualCardData,
                        name: e.target.value,
                      })
                    }
                    placeholder="e.g., Monkey.D.Luffy"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Set Name
                  </label>
                  <input
                    type="text"
                    value={manualCardData.setName}
                    onChange={(e) =>
                      setManualCardData({
                        ...manualCardData,
                        setName: e.target.value,
                      })
                    }
                    placeholder="e.g., Romance Dawn"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={manualCardData.number}
                      onChange={(e) =>
                        setManualCardData({
                          ...manualCardData,
                          number: e.target.value,
                        })
                      }
                      placeholder="e.g., OP01-001"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Rarity
                    </label>
                    <input
                      type="text"
                      value={manualCardData.rarity}
                      onChange={(e) =>
                        setManualCardData({
                          ...manualCardData,
                          rarity: e.target.value,
                        })
                      }
                      placeholder="e.g., SR, R, C"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Market Price (from TCGplayer) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={manualCardData.marketPrice}
                      onChange={(e) =>
                        setManualCardData({
                          ...manualCardData,
                          marketPrice: e.target.value,
                        })
                      }
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the current market price from TCGplayer
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={handleManualSubmit}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  Continue
                </Button>
                <Button
                  onClick={() => {
                    setShowManualEntry(false);
                    setManualCardData({
                      name: "",
                      setName: "",
                      number: "",
                      rarity: "",
                      marketPrice: "",
                    });
                  }}
                  variant="outline"
                  size="lg"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add Customer Modal */}
        {showAddCustomerModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            style={{ zIndex: 9999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAddCustomerModal(false);
              }
            }}
          >
            <div
              className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-2">➕ Add Customer</h2>
              <p className="text-gray-600 mb-6 text-sm">
                Add a new consignment customer
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, name: e.target.value })
                    }
                    placeholder="John Doe"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, phone: e.target.value })
                    }
                    placeholder="555-1234"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, email: e.target.value })
                    }
                    placeholder="john@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Vendor Code
                  </label>
                  <input
                    type="text"
                    value={newCustomer.vendorCode}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        vendorCode: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="CUST01 (optional)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono uppercase"
                    maxLength={10}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional code for this customer's consignments
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  * At least phone or email is required
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddCustomer();
                  }}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  size="lg"
                >
                  Add Customer
                </Button>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAddCustomerModal(false);
                    setNewCustomer({
                      name: "",
                      phone: "",
                      email: "",
                      vendorCode: "",
                    });
                  }}
                  variant="outline"
                  size="lg"
                >
                  Cancel
                </Button>
              </div>
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
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  How are you acquiring this card?
                </label>
                <select
                  {...form.register("acquisitionType")}
                  onChange={(e) => {
                    const newType = e.target.value;
                    form.setValue("acquisitionType", newType as any);

                    if (newType === "consignment") {
                      setCostBasis(0);
                    } else {
                      updatePricing(
                        marketPrice,
                        newType as any,
                        form.getValues("condition"),
                      );
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="buy">💰 Buy (Pay Cash)</option>
                  <option value="trade">🔄 Trade (Store Credit)</option>
                  <option value="pull">📦 Pull (Opened Product)</option>
                  <option value="consignment">
                    🤝 Consignment (Sell for Customer)
                  </option>
                </select>
              </div>

              {/* Consignment Fields */}
              {form.watch("acquisitionType") === "consignment" && (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-5 mb-4">
                  <h3 className="font-semibold text-purple-900 mb-3 text-lg">
                    🤝 Consignment Customer
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium">
                          Select Customer *
                        </label>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowAddCustomerModal(true);
                          }}
                          className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                        >
                          ➕ Add New
                        </button>
                      </div>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white text-lg"
                        required
                      >
                        <option value="">-- Select Customer --</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}{" "}
                            {customer.phone && `(${customer.phone})`}
                            {customer.vendorCode && ` [${customer.vendorCode}]`}
                          </option>
                        ))}
                      </select>
                      {customers.length === 0 && (
                        <div className="mt-2 text-sm text-amber-600">
                          No customers yet. Click "Add New" to create one.
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Customer Gets (% of sale)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          {...form.register("consignorPayoutPercent", {
                            valueAsNumber: true,
                          })}
                          min="0"
                          max="100"
                          className="w-28 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg font-semibold"
                        />
                        <span className="text-2xl font-bold">%</span>
                      </div>
                    </div>

                    <div className="mt-3 p-4 bg-white border border-purple-200 rounded-lg">
                      <div className="text-sm font-semibold text-gray-700 mb-2">
                        When sold for ${suggestedPrice.toFixed(2)}:
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="text-purple-700">
                          <span className="font-medium">Customer gets:</span>
                          <div className="text-2xl font-bold">
                            $
                            {(
                              suggestedPrice *
                              ((form.watch("consignorPayoutPercent") || 60) /
                                100)
                            ).toFixed(2)}
                          </div>
                        </div>
                        <div className="text-green-700">
                          <span className="font-medium">Shop keeps:</span>
                          <div className="text-2xl font-bold">
                            $
                            {(
                              suggestedPrice *
                              (1 -
                                (form.watch("consignorPayoutPercent") || 60) /
                                  100)
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
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