import { NextRequest, NextResponse } from "next/server";
import { Client, Environment } from "square";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, locationId, item } = body;

    console.log("🔍 API Route called");
    console.log("  - Has accessToken?", !!accessToken);
    console.log("  - Has locationId?", !!locationId);
    console.log("  - Token length:", accessToken?.length);
    console.log("  - Token starts with:", accessToken?.substring(0, 10));
    console.log("  - Item:", item?.cardName);
    console.log("  - Quantity:", item?.quantity);

    if (!accessToken || !item) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    console.log("🔄 Syncing to Square:", item.cardName);

    // Use Production environment (works for both prod and sandbox tokens)
    const client = new Client({
      accessToken: accessToken,
      environment: Environment.Production,
    });

    console.log("  - Using environment: Production");

    console.log("  - Client created, calling Square API...");

    // Create catalog object using SDK
    const response = await client.catalogApi.upsertCatalogObject({
      idempotencyKey: item.sku,
      object: {
        type: "ITEM",
        id: `#${item.sku}`,
        itemData: {
          name: item.cardName,
          description: `${item.setName} - ${item.printing || "Normal"} - ${item.condition}`,
          variations: [
            {
              type: "ITEM_VARIATION",
              id: `#${item.sku}-variation`,
              itemVariationData: {
                itemId: `#${item.sku}`,
                name: item.condition,
                pricingType: "FIXED_PRICING",
                priceMoney: {
                  amount: BigInt(Math.round((item.sellPrice || 0) * 100)), // Convert to cents
                  currency: "USD",
                },
                sku: item.sku,
              },
            },
          ],
          productType: "REGULAR",
        },
      },
    });

    const catalogObject = response.result.catalogObject;

    if (!catalogObject) {
      throw new Error("No catalog object returned from Square");
    }

    console.log("✅ Synced:", item.cardName, "→", catalogObject.id);

    // Update inventory quantity
    const variationId = catalogObject.itemData?.variations?.[0]?.id;

    console.log(`📦 Inventory sync check:`);
    console.log(`  - Variation ID: ${variationId}`);
    console.log(`  - Location ID: ${locationId}`);
    console.log(`  - Quantity: ${item.quantity}`);

    if (!variationId) {
      console.error("❌ No variation ID - cannot set inventory");
    } else if (!locationId) {
      console.error("❌ No location ID - cannot set inventory");
    } else if (!item.quantity || item.quantity <= 0) {
      console.log("ℹ️ Quantity is 0 or not set - skipping inventory");
    } else {
      console.log(
        `📦 Setting inventory quantity to ${item.quantity} at location ${locationId}...`,
      );

      try {
        const inventoryChange = {
          type: "PHYSICAL_COUNT" as const,
          physicalCount: {
            catalogObjectId: variationId,
            state: "IN_STOCK" as const,
            locationId: locationId,
            quantity: item.quantity.toString(),
            occurredAt: new Date().toISOString(),
          },
        };

        console.log(
          "📦 Inventory change request:",
          JSON.stringify(inventoryChange, null, 2),
        );

        const inventoryResponse =
          await client.inventoryApi.batchChangeInventory({
            idempotencyKey: `${item.sku}-inv-${Date.now()}`,
            changes: [inventoryChange],
          });

        console.log("✅ Inventory API response:", inventoryResponse.result);
        console.log(`✅ Set inventory to ${item.quantity} units`);
      } catch (invError: any) {
        console.error("❌ Inventory update failed:", {
          message: invError.message,
          errors: invError.errors,
          statusCode: invError.statusCode,
        });
        // Don't fail the whole sync if inventory update fails
      }
    }

    return NextResponse.json({
      success: true,
      squareItemId: catalogObject.id,
      squareVariationId: catalogObject.itemData?.variations?.[0]?.id,
      quantitySet: item.quantity || 0,
    });
  } catch (error: any) {
    console.error("API route error:", error);

    // Handle Square SDK errors
    if (error.errors) {
      const squareError = error.errors[0];
      return NextResponse.json(
        {
          error: squareError.detail || squareError.code,
          details: error.errors,
        },
        { status: error.statusCode || 500 },
      );
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
