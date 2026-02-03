"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

interface Card {
  id: string;
  sku: string;
  cardName: string;
  setName: string;
  location: string;
  displayLocation?: string;
  shelfNumber?: string;
  binderInfo?: string;
}

export default function LocationManagement() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [bulkLocation, setBulkLocation] = useState({
    displayLocation: "",
    shelfNumber: "",
    binderInfo: "",
  });

  // Preset locations
  const displayLocations = [
    "Display Case 1",
    "Display Case 2",
    "Display Case 3",
    "Wall Display A",
    "Wall Display B",
    "Counter Display",
    "Binder Section",
    "Storage",
  ];

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      const snapshot = await getDocs(collection(db, "inventory"));
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        sku: doc.data().sku,
        cardName: doc.data().cardName || doc.data().name,
        setName: doc.data().setName || doc.data().set,
        location: doc.data().location || "MAIN",
        displayLocation: doc.data().displayLocation,
        shelfNumber: doc.data().shelfNumber,
        binderInfo: doc.data().binderInfo,
      }));
      setCards(items);
    } catch (error) {
      console.error("Error loading cards:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateCardLocation = async (cardId: string, locationData: any) => {
    try {
      await updateDoc(doc(db, "inventory", cardId), {
        displayLocation: locationData.displayLocation || null,
        shelfNumber: locationData.shelfNumber || null,
        binderInfo: locationData.binderInfo || null,
        locationUpdatedAt: new Date().toISOString(),
      });

      // Update local state
      setCards(
        cards.map((card) =>
          card.id === cardId ? { ...card, ...locationData } : card,
        ),
      );
    } catch (error) {
      console.error("Error updating location:", error);
    }
  };

  const bulkUpdateLocations = async () => {
    if (selectedCards.size === 0) {
      alert("Please select cards to update");
      return;
    }

    if (
      !bulkLocation.displayLocation &&
      !bulkLocation.shelfNumber &&
      !bulkLocation.binderInfo
    ) {
      alert("Please enter at least one location field");
      return;
    }

    try {
      const batch = writeBatch(db);

      selectedCards.forEach((cardId) => {
        const docRef = doc(db, "inventory", cardId);
        batch.update(docRef, {
          ...(bulkLocation.displayLocation && {
            displayLocation: bulkLocation.displayLocation,
          }),
          ...(bulkLocation.shelfNumber && {
            shelfNumber: bulkLocation.shelfNumber,
          }),
          ...(bulkLocation.binderInfo && {
            binderInfo: bulkLocation.binderInfo,
          }),
          locationUpdatedAt: new Date().toISOString(),
        });
      });

      await batch.commit();

      alert(`Updated location for ${selectedCards.size} cards!`);
      setSelectedCards(new Set());
      setBulkLocation({ displayLocation: "", shelfNumber: "", binderInfo: "" });
      loadCards();
    } catch (error) {
      console.error("Error bulk updating:", error);
      alert("Error updating locations");
    }
  };

  const filteredCards = cards.filter(
    (card) =>
      card.cardName?.toLowerCase().includes(filter.toLowerCase()) ||
      card.setName?.toLowerCase().includes(filter.toLowerCase()) ||
      card.sku?.toLowerCase().includes(filter.toLowerCase()) ||
      card.displayLocation?.toLowerCase().includes(filter.toLowerCase()),
  );

  const toggleSelectCard = (cardId: string) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const selectAll = () => {
    setSelectedCards(new Set(filteredCards.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelectedCards(new Set());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading inventory...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Location Management
              </h1>
              <p className="text-gray-600 mt-2">
                Organize your inventory by display, shelf, and binder
              </p>
            </div>
            <span className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full text-sm font-bold">
              🧪 BETA
            </span>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search by card name, set, SKU, or location..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3"
            />
          </div>

          {/* Selection Info */}
          {selectedCards.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-blue-900">
                  {selectedCards.size} card{selectedCards.size !== 1 ? "s" : ""}{" "}
                  selected
                </span>
                <button
                  onClick={deselectAll}
                  className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                >
                  Deselect All
                </button>
              </div>

              {/* Bulk Location Update */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Location
                  </label>
                  <select
                    value={bulkLocation.displayLocation}
                    onChange={(e) =>
                      setBulkLocation({
                        ...bulkLocation,
                        displayLocation: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">Select Display...</option>
                    {displayLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shelf Number
                  </label>
                  <input
                    type="text"
                    value={bulkLocation.shelfNumber}
                    onChange={(e) =>
                      setBulkLocation({
                        ...bulkLocation,
                        shelfNumber: e.target.value,
                      })
                    }
                    placeholder="e.g., A1, B2, Top"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Binder Info
                  </label>
                  <input
                    type="text"
                    value={bulkLocation.binderInfo}
                    onChange={(e) =>
                      setBulkLocation({
                        ...bulkLocation,
                        binderInfo: e.target.value,
                      })
                    }
                    placeholder="e.g., Binder 1 - Page 5"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
              </div>

              <button
                onClick={bulkUpdateLocations}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
              >
                Update {selectedCards.size} Card
                {selectedCards.size !== 1 ? "s" : ""}
              </button>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Select All ({filteredCards.length})
            </button>
            <button
              onClick={loadCards}
              className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg text-sm font-semibold"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => {
            const isSelected = selectedCards.has(card.id);
            const hasLocation =
              card.displayLocation || card.shelfNumber || card.binderInfo;

            return (
              <div
                key={card.id}
                onClick={() => toggleSelectCard(card.id)}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                  isSelected
                    ? "ring-4 ring-blue-500 bg-blue-50"
                    : "hover:shadow-lg"
                } ${!hasLocation ? "border-2 border-orange-300" : ""}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-1">
                      {card.cardName}
                    </h3>
                    <p className="text-sm text-gray-600">{card.setName}</p>
                    <p className="text-xs text-gray-400 mt-1">{card.sku}</p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      isSelected
                        ? "bg-blue-600 border-blue-600"
                        : "border-gray-300"
                    }`}
                  >
                    {isSelected && (
                      <span className="text-white text-sm">✓</span>
                    )}
                  </div>
                </div>

                {/* Location Info */}
                <div className="space-y-2 text-sm">
                  {card.displayLocation ? (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">📍</span>
                      <span className="font-medium">
                        {card.displayLocation}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-orange-600">
                      <span>⚠️</span>
                      <span className="font-medium">No display location</span>
                    </div>
                  )}

                  {card.shelfNumber && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">📚</span>
                      <span>Shelf {card.shelfNumber}</span>
                    </div>
                  )}

                  {card.binderInfo && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">📓</span>
                      <span>{card.binderInfo}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredCards.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-xl font-semibold text-gray-800 mb-2">
              No cards found
            </div>
            <div className="text-gray-600">Try adjusting your search</div>
          </div>
        )}
      </div>
    </div>
  );
}
