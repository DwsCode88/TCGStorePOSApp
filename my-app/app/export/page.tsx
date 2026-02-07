'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, getDocs } from 'firebase/firestore';

interface InventoryItem {
  id: string;
  sku: string;
  cardName: string;
  setName: string;
  game: string;
  printing?: string;
  condition?: string;
  notes?: string;
  sellPrice?: number;
  costBasis?: number;
  quantity?: number;
  location?: string;
  acquisitionType?: string;
  customerId?: string;
  customerVendorCode?: string;
}

export default function ExportPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<'web' | 'store' | 'both'>('both');

  useEffect(() => {
    loadInventory();
    // Load saved availability setting
    const saved = localStorage.getItem('exportAvailability');
    if (saved === 'web' || saved === 'store' || saved === 'both') {
      setAvailability(saved);
    }
  }, []);

  const loadInventory = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'inventory'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      setItems(data);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIDs = (item: InventoryItem): string => {
    const game = (item.game || '').toLowerCase();
    const categories: string[] = ['683']; // Single Cards (Main)
    
    // Check if graded
    const isGraded = 
      item.condition?.toLowerCase().includes('graded') ||
      item.notes?.toLowerCase().includes('graded') ||
      item.printing?.toLowerCase().includes('graded');

    // Game-specific categories
    if (game.includes('one piece')) {
      categories.push('684'); // One Piece SUB
      if (isGraded) {
        categories.push('687'); // Graded Cards SUB
      }
    } else if (game.includes('pokemon')) {
      categories.push('686'); // Pokemon SUB
      if (isGraded) {
        categories.push('688'); // Graded Cards SUB
      }
    }

    return categories.join(',');
  };

  const exportToCSV = () => {
    const selectedItems = items.filter(item => selected.has(item.id));
    
    if (selectedItems.length === 0) {
      alert('Please select at least one item to export');
      return;
    }

    console.log(`📤 Exporting ${selectedItems.length} items to CSV...`);
    console.log(`📦 Availability setting: ${availability}`);

    // Extract vendor codes from items
    const itemsWithVendorCodes = selectedItems.map(item => {
      let vendorCode = item.customerVendorCode || '';
      
      // Try to extract from SKU if not in field
      if (!vendorCode && item.sku) {
        const skuParts = item.sku.split('-');
        if (skuParts.length >= 4) {
          vendorCode = skuParts[skuParts.length - 1];
        }
      }
      
      return { ...item, extractedVendorCode: vendorCode };
    });

    // Count items with vendor codes
    const vendorCodeItems = itemsWithVendorCodes.filter(item => item.extractedVendorCode);
    console.log(`👤 Found ${vendorCodeItems.length} items with vendor codes`);
    
    // Show sample vendor codes
    const vendorSamples = vendorCodeItems.slice(0, 5);
    vendorSamples.forEach(item => {
      console.log(`  - ${item.cardName}: ${item.extractedVendorCode} (from ${item.customerVendorCode ? 'field' : 'SKU'})`);
    });

    // Count consignment items
    const consignmentItems = selectedItems.filter(item => 
      item.acquisitionType?.toLowerCase() === 'consignment'
    );
    if (consignmentItems.length > 0) {
      console.log(`🤝 Found ${consignmentItems.length} consignment items`);
    }

    // CSV Headers (36 columns) - Match exact POS template format
    const headers = [
      'Category IDs (Comma separate)',
      'Dept Code',
      'Status',
      'Product Title',
      'Short Description',
      'Unit of Measurement(each/per yard)',
      'Availability(web/store/both)',
      'Unlimited Inventory(yes/no)',
      'Options',
      'Assigned option values',
      'sku',
      'upc',
      'Manufacturer Product Id',
      'Alternate Lookups',
      'Manufacturer',
      'Primary Vendor',
      'Serial Number',
      'Store Location ID',
      'Weight',
      'Default Cost',
      'Price',
      'Sale Price',
      'Wholesale Price',
      'MAP Price',
      'Wholesale Description',
      'Cost',
      'Inventory',
      'Re-Order Point',
      'Desired Stock Level',
      'Case Unit Qty',
      'Retail Unit Type(items,inches,feet,yards,meters)',
      'Case Unit Type(case,bolt,box,roll,pack)',
      'Tax Code',
      'Vendor Consignment (yes/no)',
      'Alt Barcode Title',
      'Bin Location'
    ];

    // Build rows
    const rows = selectedItems.map(item => {
      const title = `${item.cardName}${item.setName ? ' - ' + item.setName : ''}`;
      const description = [item.game, item.printing, item.condition]
        .filter(Boolean)
        .join(' | ');

      // Determine vendor and consignment status
      const isConsignment = item.acquisitionType?.toLowerCase() === 'consignment';
      
      // Get vendor code - check field first, then extract from SKU
      let vendorCode = item.customerVendorCode || '';
      
      // If no vendor code field, try to extract from SKU (format: PREFIX-SET-NUMBER-VENDORCODE)
      if (!vendorCode && item.sku) {
        const skuParts = item.sku.split('-');
        // If SKU has 4 parts, last part is vendor code
        if (skuParts.length >= 4) {
          vendorCode = skuParts[skuParts.length - 1];
        }
      }
      
      const primaryVendor = vendorCode || '5325102';
      const vendorConsignment = isConsignment ? 'yes' : 'no';

      return [
        getCategoryIDs(item),            // Category IDs (comma-separated)
        '',                              // Dept Code
        'active',                        // Status
        title,                           // Product Title
        description,                     // Short Description
        'each',                          // Unit of Measurement
        availability,                    // Availability (from settings)
        'no',                            // Unlimited Inventory
        '',                              // Options
        '',                              // Assigned option values
        item.sku,                        // sku
        '',                              // upc
        '',                              // Manufacturer Product Id
        '',                              // Alternate Lookups
        '',                              // Manufacturer
        primaryVendor,                   // Primary Vendor (5325102 or customer code)
        '',                              // Serial Number
        item.location || '',             // Store Location ID
        '',                              // Weight
        (item.costBasis || 0).toFixed(2), // Default Cost
        (item.sellPrice || 0).toFixed(2), // Price
        '',                              // Sale Price
        '',                              // Wholesale Price
        '',                              // MAP Price
        '',                              // Wholesale Description
        (item.costBasis || 0).toFixed(2), // Cost
        (item.quantity || 1).toString(), // Inventory
        '',                              // Re-Order Point
        '',                              // Desired Stock Level
        '',                              // Case Unit Qty
        'items',                         // Retail Unit Type
        '',                              // Case Unit Type
        '',                              // Tax Code
        vendorConsignment,               // Vendor Consignment
        '',                              // Alt Barcode Title
        ''                               // Bin Location (empty)
      ];
    });

    // Convert to CSV
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const stringCell = String(cell);
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          return `"${stringCell.replace(/"/g, '""')}"`;
        }
        return stringCell;
      }).join(','))
      .join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `vaulttrove-batch-${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ CSV export complete!');
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const selectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(item => item.id)));
    }
  };

  const handleAvailabilityChange = (value: 'web' | 'store' | 'both') => {
    setAvailability(value);
    localStorage.setItem('exportAvailability', value);
    console.log(`📦 Availability setting changed to: ${value}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">Loading inventory...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Export to POS (36 Columns)</h1>
          
          <div className="flex gap-4 items-center mb-4">
            <button
              onClick={selectAll}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {selected.size === items.length ? 'Deselect All' : 'Select All'}
            </button>
            
            <button
              onClick={exportToCSV}
              disabled={selected.size === 0}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              Export {selected.size} Items
            </button>

            <div className="text-sm text-gray-600">
              {items.length} total items | {selected.size} selected
            </div>
          </div>

          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ⚙️ Availability Setting
            </label>
            <div className="flex gap-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="availability"
                  value="web"
                  checked={availability === 'web'}
                  onChange={(e) => handleAvailabilityChange(e.target.value as 'web')}
                  className="mr-2"
                />
                <span className="text-sm">
                  <span className="font-medium">Web Only</span>
                  <span className="text-gray-500 ml-1">(online store)</span>
                </span>
              </label>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="availability"
                  value="store"
                  checked={availability === 'store'}
                  onChange={(e) => handleAvailabilityChange(e.target.value as 'store')}
                  className="mr-2"
                />
                <span className="text-sm">
                  <span className="font-medium">Store Only</span>
                  <span className="text-gray-500 ml-1">(in-person)</span>
                </span>
              </label>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="availability"
                  value="both"
                  checked={availability === 'both'}
                  onChange={(e) => handleAvailabilityChange(e.target.value as 'both')}
                  className="mr-2"
                />
                <span className="text-sm">
                  <span className="font-medium">Both</span>
                  <span className="text-gray-500 ml-1">(web + store)</span>
                </span>
              </label>
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-4">
            <p><strong>Format:</strong> 36 columns, POS-compatible</p>
            <p><strong>Category IDs:</strong> Pokemon = 683,686 | One Piece = 683,684</p>
            <p><strong>Availability:</strong> {availability} (configurable above)</p>
            <p><strong>Vendor:</strong> Extracted from SKU (last segment) or defaults to 5325102</p>
            <p className="text-xs mt-1">Example: POK-CELE-0060-<strong>KYLEW</strong> → Primary Vendor = KYLEW</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    onChange={selectAll}
                  />
                </th>
                <th className="p-3 text-left">SKU</th>
                <th className="p-3 text-left">Card</th>
                <th className="p-3 text-left">Set</th>
                <th className="p-3 text-left">Game</th>
                <th className="p-3 text-left">Price</th>
                <th className="p-3 text-left">Qty</th>
                <th className="p-3 text-left">Type</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                // Extract vendor code from SKU if not in field
                let vendorCode = item.customerVendorCode || '';
                if (!vendorCode && item.sku) {
                  const skuParts = item.sku.split('-');
                  if (skuParts.length >= 4) {
                    vendorCode = skuParts[skuParts.length - 1];
                  }
                }
                
                return (
                  <tr 
                    key={item.id}
                    className={`border-b hover:bg-gray-50 ${selected.has(item.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="p-3 text-sm font-mono">{item.sku}</td>
                    <td className="p-3">{item.cardName}</td>
                    <td className="p-3 text-sm text-gray-600">{item.setName}</td>
                    <td className="p-3 text-sm">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {item.game}
                      </span>
                    </td>
                    <td className="p-3">${(item.sellPrice || 0).toFixed(2)}</td>
                    <td className="p-3">{item.quantity || 1}</td>
                    <td className="p-3 text-xs">
                      {vendorCode ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-mono">
                          {vendorCode}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                          5325102
                        </span>
                      )}
                      {item.acquisitionType === 'consignment' && (
                        <span className="ml-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                          consign
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}