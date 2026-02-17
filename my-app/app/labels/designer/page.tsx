"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DraggableElement {
  id: string;
  name: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  fontSize: number;
  content: string;
  type: "text" | "qr" | "barcode";
}

export default function VisualLabelDesigner() {
  const [width, setWidth] = useState(4.0);
  const [height, setHeight] = useState(2.0);
  const [rotated, setRotated] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [elements, setElements] = useState<DraggableElement[]>([
    {
      id: "price",
      name: "Price",
      x: 50,
      y: 10,
      fontSize: 24,
      content: "$10.00 NM",
      type: "text",
    },
    {
      id: "qr",
      name: "QR Code",
      x: 50,
      y: 35,
      fontSize: 0,
      content: "",
      type: "qr",
    },
    {
      id: "card",
      name: "Card Name",
      x: 50,
      y: 60,
      fontSize: 12,
      content: "Monkey.D.Luffy",
      type: "text",
    },
    {
      id: "set",
      name: "Set Name",
      x: 50,
      y: 75,
      fontSize: 9,
      content: "Romance Dawn",
      type: "text",
    },
    {
      id: "sku",
      name: "SKU",
      x: 50,
      y: 92,
      fontSize: 8,
      content: "OP01-001-NM",
      type: "text",
    },
  ]);

  const displayWidth = rotated ? height * 96 : width * 96;
  const displayHeight = rotated ? width * 96 : height * 96;

  const handleMouseDown = (id: string) => {
    setSelectedElement(id);
    setDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging || !selectedElement) return;

    const label = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - label.left) / label.width) * 100;
    const y = ((e.clientY - label.top) / label.height) * 100;

    setElements((prev) =>
      prev.map((el) =>
        el.id === selectedElement
          ? {
              ...el,
              x: Math.max(0, Math.min(100, x)),
              y: Math.max(0, Math.min(100, y)),
            }
          : el,
      ),
    );
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const saveLayout = () => {
    const layout = {
      width,
      height,
      rotated,
      elements: elements.map((el) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        fontSize: el.fontSize,
      })),
    };
    localStorage.setItem("visualLabelLayout", JSON.stringify(layout));
    toast.success("Layout saved!");
    console.log("Saved layout:", layout);
  };

  const updateFontSize = (id: string, size: number) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, fontSize: size } : el)),
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">🎨 Visual Label Designer</h1>
          <p className="text-gray-600">
            Drag elements to position them on your label
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Label Preview */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Label Preview</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => setRotated(!rotated)}
                  variant={rotated ? "default" : "outline"}
                >
                  {rotated ? "📱 Rotated" : "📏 Normal"}
                </Button>
              </div>
            </div>

            {/* Label Canvas */}
            <div className="flex items-center justify-center p-8 bg-gray-100 rounded-lg">
              <div
                className="relative bg-white border-4 border-gray-800 shadow-2xl cursor-crosshair"
                style={{
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                  transform: rotated ? "rotate(90deg)" : "none",
                  transformOrigin: "center",
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Grid */}
                <div className="absolute inset-0 pointer-events-none opacity-10">
                  {[0, 25, 50, 75, 100].map((percent) => (
                    <div
                      key={`h-${percent}`}
                      className="absolute w-full border-t border-blue-300"
                      style={{ top: `${percent}%` }}
                    />
                  ))}
                  {[0, 25, 50, 75, 100].map((percent) => (
                    <div
                      key={`v-${percent}`}
                      className="absolute h-full border-l border-blue-300"
                      style={{ left: `${percent}%` }}
                    />
                  ))}
                </div>

                {/* Draggable Elements */}
                {elements.map((el) => (
                  <div
                    key={el.id}
                    className={`absolute cursor-move transition-all ${
                      selectedElement === el.id
                        ? "ring-4 ring-blue-500 bg-blue-50"
                        : "hover:ring-2 hover:ring-blue-300"
                    }`}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      transform: "translate(-50%, -50%)",
                      fontSize:
                        el.type === "text" ? `${el.fontSize}px` : undefined,
                    }}
                    onMouseDown={() => handleMouseDown(el.id)}
                  >
                    {el.type === "text" && (
                      <div className="font-bold whitespace-nowrap px-2 py-1">
                        {el.content}
                      </div>
                    )}
                    {el.type === "qr" && (
                      <div
                        className="border-2 border-black"
                        style={{
                          width: "60px",
                          height: "60px",
                          display: "grid",
                          gridTemplateColumns: "repeat(7, 1fr)",
                          gap: "1px",
                          backgroundColor: "black",
                        }}
                      >
                        {Array.from({ length: 49 }).map((_, i) => (
                          <div
                            key={i}
                            className={
                              Math.random() > 0.5 ? "bg-black" : "bg-white"
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Position Indicator */}
                {selectedElement && (
                  <div className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded">
                    {selectedElement}:{" "}
                    {elements
                      .find((e) => e.id === selectedElement)
                      ?.x.toFixed(0)}
                    %,{" "}
                    {elements
                      .find((e) => e.id === selectedElement)
                      ?.y.toFixed(0)}
                    %
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>💡 Tip:</strong> Click and drag elements to reposition
                them. The blue grid helps with alignment.
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Label Size */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-3">📏 Label Size</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Width (inches)</label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(parseFloat(e.target.value))}
                    step="0.1"
                    className="w-full px-3 py-2 border rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Height (inches)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(parseFloat(e.target.value))}
                    step="0.1"
                    className="w-full px-3 py-2 border rounded-lg mt-1"
                  />
                </div>
                <div className="pt-2 border-t">
                  <div className="text-xs text-gray-600">
                    {width}" × {height}" ({(width * 2.54).toFixed(1)}cm ×{" "}
                    {(height * 2.54).toFixed(1)}cm)
                  </div>
                </div>
              </div>
            </div>

            {/* Element Controls */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-3">🎨 Elements</h3>
              <div className="space-y-3">
                {elements.map((el) => (
                  <div
                    key={el.id}
                    className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      selectedElement === el.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                    onClick={() => setSelectedElement(el.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{el.name}</span>
                      <span className="text-xs text-gray-500">
                        {el.x.toFixed(0)}%, {el.y.toFixed(0)}%
                      </span>
                    </div>
                    {el.type === "text" && (
                      <div>
                        <label className="text-xs text-gray-600">
                          Font Size
                        </label>
                        <input
                          type="range"
                          min="6"
                          max="32"
                          value={el.fontSize}
                          onChange={(e) =>
                            updateFontSize(el.id, parseInt(e.target.value))
                          }
                          className="w-full"
                        />
                        <div className="text-xs text-gray-500 text-right">
                          {el.fontSize}pt
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Presets */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-3">⚡ Quick Presets</h3>
              <div className="space-y-2">
                <Button
                  onClick={() => {
                    setWidth(2.0);
                    setHeight(1.0);
                    setRotated(false);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  2" × 1" Standard
                </Button>
                <Button
                  onClick={() => {
                    setWidth(4.0);
                    setHeight(2.0);
                    setRotated(true);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  4" × 2" Vertical
                </Button>
                <Button
                  onClick={() => {
                    setWidth(4.0);
                    setHeight(6.0);
                    setRotated(false);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  4" × 6" Large
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button onClick={saveLayout} className="w-full" size="lg">
                💾 Save Layout
              </Button>
              <Button
                onClick={() => toast.info("Generate feature coming soon!")}
                variant="outline"
                className="w-full"
              >
                🖨️ Generate Labels
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
