"use client";

import { useState, useEffect, useRef } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InventoryItem } from "@/types/inventory";
import { Printer, CheckSquare, Square, Save, RotateCcw } from "lucide-react";
import { jsPDF } from "jspdf";
import bwipjs from "bwip-js";

interface LabelElement {
  id: string;
  type: "store" | "card" | "set" | "price" | "barcode" | "sku";
  x: number; // percentage
  y: number; // percentage
  fontSize: number;
  width?: number; // percentage (for barcode)
  height?: number; // percentage (for barcode)
  align?: "left" | "center" | "right";
  enabled: boolean;
}

const DEFAULT_LAYOUT: LabelElement[] = [
  {
    id: "1",
    type: "store",
    x: 5,
    y: 5,
    fontSize: 8,
    align: "left",
    enabled: true,
  },
  {
    id: "2",
    type: "card",
    x: 5,
    y: 20,
    fontSize: 10,
    align: "left",
    enabled: true,
  },
  {
    id: "3",
    type: "set",
    x: 5,
    y: 35,
    fontSize: 7,
    align: "left",
    enabled: true,
  },
  {
    id: "4",
    type: "price",
    x: 5,
    y: 50,
    fontSize: 16,
    align: "left",
    enabled: true,
  },
  {
    id: "5",
    type: "barcode",
    x: 5,
    y: 65,
    width: 90,
    height: 15,
    enabled: true,
  },
  {
    id: "6",
    type: "sku",
    x: 50,
    y: 90,
    fontSize: 8,
    align: "center",
    enabled: true,
  },
];

export default function LabelDesignerPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Label settings
  const [width, setWidth] = useState(2.0);
  const [height, setHeight] = useState(1.0);
  const [spacing, setSpacing] = useState(0.1);
  const [statusFilter, setStatusFilter] = useState<string>("priced");

  // Layout designer
  const [layout, setLayout] = useState<LabelElement[]>(DEFAULT_LAYOUT);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Sample item for preview
  const [previewItem] = useState<InventoryItem>({
    sku: "VT-PKM-123456",
    cardName: "Pikachu",
    setName: "Base Set",
    condition: "NM" as const,
    printing: "1st Edition",
    sellPrice: 45.0,
  } as InventoryItem);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const inventoryRef = collection(db, "inventory");
      const snapshot = await getDocs(inventoryRef);

      const loadedItems = snapshot.docs.map((doc) => ({
        ...doc.data(),
        sku: doc.id,
      })) as InventoryItem[];

      const sorted = loadedItems.sort((a, b) => {
        if (a.status === "priced" && b.status !== "priced") return -1;
        if (a.status !== "priced" && b.status === "priced") return 1;
        return 0;
      });

      setItems(sorted);
      toast.success(`Loaded ${sorted.length} items`);
    } catch (error: any) {
      console.error("Failed to load inventory:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (sku: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(sku)) {
      newSelected.delete(sku);
    } else {
      newSelected.add(sku);
    }
    setSelectedItems(newSelected);
  };

  const toggleAll = () => {
    const filtered = getFilteredItems();
    if (selectedItems.size === filtered.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filtered.map((item) => item.sku)));
    }
  };

  const getFilteredItems = () => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Find clicked element
    const clicked = layout.find((el) => {
      if (!el.enabled) return false;
      if (el.type === "barcode") {
        return (
          x >= el.x &&
          x <= el.x + (el.width || 90) &&
          y >= el.y &&
          y <= el.y + (el.height || 15)
        );
      }
      return Math.abs(x - el.x) < 10 && Math.abs(y - el.y) < 5;
    });

    setSelectedElement(clicked?.id || null);
  };

  const handleDragElement = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedElement || !canvasRef.current || !dragging) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
    );
    const y = Math.max(
      0,
      Math.min(100, ((e.clientY - rect.top) / rect.height) * 100),
    );

    setLayout(
      layout.map((el) => (el.id === selectedElement ? { ...el, x, y } : el)),
    );
  };

  const updateElement = (id: string, updates: Partial<LabelElement>) => {
    setLayout(layout.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  };

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
    toast.success("Layout reset to default");
  };

  const generatePDF = async (itemsToLabel: InventoryItem[]) => {
    const labelWidthWithMargin = width + spacing;
    const labelHeightWithMargin = height + spacing;

    const labelsPerRow = Math.floor(8.5 / labelWidthWithMargin);
    const labelsPerCol = Math.floor(11 / labelHeightWithMargin);
    const labelsPerPage = labelsPerRow * labelsPerCol;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: "letter",
    });

    for (let i = 0; i < itemsToLabel.length; i++) {
      if (i > 0 && i % labelsPerPage === 0) {
        pdf.addPage();
      }

      const item = itemsToLabel[i];
      const labelIndex = i % labelsPerPage;
      const row = Math.floor(labelIndex / labelsPerRow);
      const col = labelIndex % labelsPerRow;

      const labelX = col * labelWidthWithMargin;
      const labelY = row * labelHeightWithMargin;

      // Render each element based on layout
      for (const element of layout) {
        if (!element.enabled) continue;

        const absX = labelX + (element.x / 100) * width;
        const absY = labelY + (element.y / 100) * height;

        if (element.type === "store") {
          pdf.setFontSize(element.fontSize);
          pdf.setFont("helvetica", "bold");
          pdf.text("VaultTrove", absX, absY, { align: element.align });
        } else if (element.type === "card") {
          pdf.setFontSize(element.fontSize);
          pdf.setFont("helvetica", "bold");
          pdf.text((item.cardName || "Card").substring(0, 25), absX, absY, {
            align: element.align,
          });
        } else if (element.type === "set") {
          pdf.setFontSize(element.fontSize);
          pdf.setFont("helvetica", "normal");
          const setInfo = item.setName || "Set";
          const printing =
            item.printing && item.printing !== "Normal"
              ? ` (${item.printing})`
              : "";
          pdf.text(`${setInfo}${printing}`.substring(0, 30), absX, absY, {
            align: element.align,
          });
        } else if (element.type === "price") {
          pdf.setFontSize(element.fontSize);
          pdf.setFont("helvetica", "bold");
          pdf.text(
            `${item.condition || "NM"}  $${(item.sellPrice || 0).toFixed(2)}`,
            absX,
            absY,
            { align: element.align },
          );
        } else if (element.type === "barcode") {
          try {
            const canvas = document.createElement("canvas");
            bwipjs.toCanvas(canvas, {
              bcid: "code128",
              text: item.sku,
              scale: 3,
              height: 8,
              includetext: false,
            });
            const img = canvas.toDataURL("image/png");
            const barcodeWidth = ((element.width || 90) / 100) * width;
            const barcodeHeight = ((element.height || 15) / 100) * height;
            pdf.addImage(img, "PNG", absX, absY, barcodeWidth, barcodeHeight);
          } catch (e) {
            console.error("Barcode error:", e);
          }
        } else if (element.type === "sku") {
          pdf.setFontSize(element.fontSize);
          pdf.setFont("courier", "normal");
          pdf.text(item.sku, absX, absY, { align: element.align });
        }
      }
    }

    return pdf.output("blob");
  };

  const handleGenerateLabels = async () => {
    if (selectedItems.size === 0) {
      toast.error("Please select at least one item");
      return;
    }

    setGenerating(true);
    try {
      const itemsToLabel = items.filter((item) => selectedItems.has(item.sku));

      console.log(
        `🏷️ Generating ${itemsToLabel.length} labels with custom layout`,
      );
      toast.loading(`Generating ${itemsToLabel.length} labels...`);

      const pdfBlob = await generatePDF(itemsToLabel);

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `labels-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const updatePromises = itemsToLabel.map((item) =>
        updateDoc(doc(db, "inventory", item.sku), {
          status: "labeled",
          updatedAt: new Date(),
        }),
      );
      await Promise.all(updatePromises);

      setItems(
        items.map((item) =>
          selectedItems.has(item.sku)
            ? { ...item, status: "labeled" as const }
            : item,
        ),
      );

      toast.success(`Generated ${itemsToLabel.length} labels!`);
      setSelectedItems(new Set());
    } catch (error: any) {
      console.error("Failed:", error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const filteredItems = getFilteredItems();
  const allSelected =
    filteredItems.length > 0 && selectedItems.size === filteredItems.length;
  const selectedEl = layout.find((el) => el.id === selectedElement);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-7xl">
        <h1 className="text-4xl font-bold mb-2">Label Designer</h1>
        <p className="text-gray-600 mb-8">Design your label layout and print</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Label Designer */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Layout Designer</h2>
              <Button onClick={resetLayout} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>

            {/* Canvas */}
            <div
              ref={canvasRef}
              className="border-2 border-gray-300 rounded-lg bg-white relative cursor-crosshair mb-4"
              style={{
                width: "100%",
                paddingBottom: `${(height / width) * 100}%`,
              }}
              onClick={handleCanvasClick}
              onMouseMove={handleDragElement}
              onMouseDown={() => setDragging(true)}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
            >
              <div className="absolute inset-0 p-2">
                {/* Render preview */}
                {layout.map((element) => {
                  if (!element.enabled) return null;

                  const style: React.CSSProperties = {
                    position: "absolute",
                    left: `${element.x}%`,
                    top: `${element.y}%`,
                    fontSize: `${element.fontSize}px`,
                    cursor: "move",
                    userSelect: "none",
                    border:
                      selectedElement === element.id
                        ? "2px solid blue"
                        : "1px dashed gray",
                    padding: "2px 4px",
                    backgroundColor:
                      selectedElement === element.id
                        ? "rgba(59, 130, 246, 0.1)"
                        : "transparent",
                  };

                  if (element.type === "barcode") {
                    return (
                      <div
                        key={element.id}
                        style={{
                          ...style,
                          width: `${element.width}%`,
                          height: `${element.height}%`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          color: "#666",
                        }}
                      >
                        [Barcode]
                      </div>
                    );
                  }

                  let text = "";
                  if (element.type === "store") text = "VaultTrove";
                  else if (element.type === "card") text = previewItem.cardName;
                  else if (element.type === "set")
                    text = `${previewItem.setName} (${previewItem.printing})`;
                  else if (element.type === "price")
                    text = `${previewItem.condition}  $${previewItem.sellPrice.toFixed(2)}`;
                  else if (element.type === "sku") text = previewItem.sku;

                  return (
                    <div
                      key={element.id}
                      style={{
                        ...style,
                        textAlign: element.align,
                        fontWeight:
                          element.type === "store" ||
                          element.type === "card" ||
                          element.type === "price"
                            ? "bold"
                            : "normal",
                        fontFamily:
                          element.type === "sku" ? "monospace" : "sans-serif",
                      }}
                    >
                      {text}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-gray-600 mb-4">
              Click elements to select, drag to move. {width}" × {height}" label
            </div>

            {/* Element Controls */}
            {selectedEl && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">
                  Editing: {selectedEl.type.toUpperCase()}
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      X Position (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={Math.round(selectedEl.x)}
                      onChange={(e) =>
                        updateElement(selectedEl.id, {
                          x: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Y Position (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={Math.round(selectedEl.y)}
                      onChange={(e) =>
                        updateElement(selectedEl.id, {
                          y: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>

                  {selectedEl.type !== "barcode" && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Font Size
                        </label>
                        <input
                          type="number"
                          min="4"
                          max="32"
                          step="1"
                          value={selectedEl.fontSize}
                          onChange={(e) =>
                            updateElement(selectedEl.id, {
                              fontSize: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Align
                        </label>
                        <select
                          value={selectedEl.align}
                          onChange={(e) =>
                            updateElement(selectedEl.id, {
                              align: e.target.value as any,
                            })
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    </>
                  )}

                  {selectedEl.type === "barcode" && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Width (%)
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="100"
                          step="5"
                          value={selectedEl.width}
                          onChange={(e) =>
                            updateElement(selectedEl.id, {
                              width: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Height (%)
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="50"
                          step="5"
                          value={selectedEl.height}
                          onChange={(e) =>
                            updateElement(selectedEl.id, {
                              height: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedEl.enabled}
                      onChange={(e) =>
                        updateElement(selectedEl.id, {
                          enabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span>Show on label</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Settings & Controls */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Settings</h2>

            {/* Label Size */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">
                Quick Sizes
              </label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => {
                    setWidth(2.0);
                    setHeight(1.0);
                  }}
                  className="p-2 border-2 rounded hover:border-blue-500 text-sm"
                >
                  Standard
                  <br />
                  <span className="text-xs text-gray-600">2.0" × 1.0"</span>
                </button>
                <button
                  onClick={() => {
                    setWidth(2.25);
                    setHeight(1.25);
                  }}
                  className="p-2 border-2 rounded hover:border-blue-500 text-sm"
                >
                  Large
                  <br />
                  <span className="text-xs text-gray-600">2.25" × 1.25"</span>
                </button>
                <button
                  onClick={() => {
                    setWidth(4.0);
                    setHeight(2.0);
                  }}
                  className="p-2 border-2 rounded hover:border-blue-500 text-sm"
                >
                  Dymo 4×2
                  <br />
                  <span className="text-xs text-gray-600">4.0" × 2.0"</span>
                </button>
                <button
                  onClick={() => {
                    setWidth(4.0);
                    setHeight(3.0);
                  }}
                  className="p-2 border-2 rounded hover:border-blue-500 text-sm"
                >
                  Dymo 4×3
                  <br />
                  <span className="text-xs text-gray-600">4.0" × 3.0"</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Width
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="8"
                    value={width}
                    onChange={(e) =>
                      setWidth(parseFloat(e.target.value) || 2.0)
                    }
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Height
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="6"
                    value={height}
                    onChange={(e) =>
                      setHeight(parseFloat(e.target.value) || 1.0)
                    }
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Spacing
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="0.5"
                    value={spacing}
                    onChange={(e) =>
                      setSpacing(parseFloat(e.target.value) || 0.1)
                    }
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Filter Items
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="all">All Items</option>
                <option value="priced">Ready to Label</option>
                <option value="pending">Pending</option>
                <option value="labeled">Already Labeled</option>
              </select>
            </div>

            {/* Selection */}
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm font-medium text-blue-900">
                  {selectedItems.size} items selected
                </div>
                <div className="text-xs text-blue-700">
                  {filteredItems.length} available
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button onClick={toggleAll} variant="outline" className="w-full">
                <CheckSquare className="w-4 h-4 mr-2" />
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
              <Button
                onClick={handleGenerateLabels}
                disabled={selectedItems.size === 0 || generating}
                className="w-full bg-blue-600"
                size="lg"
              >
                <Printer className="w-4 h-4 mr-2" />
                {generating
                  ? "Generating..."
                  : `Generate ${selectedItems.size} Labels`}
              </Button>
            </div>
          </div>
        </div>

        {/* Items Grid */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">
            Select Items ({filteredItems.length})
          </h2>

          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No items found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {filteredItems.map((item) => {
                const isSelected = selectedItems.has(item.sku);
                return (
                  <div
                    key={item.sku}
                    onClick={() => toggleItem(item.sku)}
                    className={`relative p-3 border-2 rounded-lg cursor-pointer transition text-sm ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="absolute top-2 right-2">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300" />
                      )}
                    </div>

                    <div className="pr-6">
                      <div className="font-semibold text-gray-900 mb-1 text-sm">
                        {item.cardName}
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        {item.setName}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <span className="text-sm font-bold text-green-600">
                          ${(item.sellPrice || 0).toFixed(2)}
                        </span>
                        <span className="text-xs font-semibold">
                          {item.condition}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
