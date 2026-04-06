import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { readGoogleSheet } from "@/lib/googleSheet";
import { embedText, embedBatch } from "@/lib/embeddings";
import { createHash } from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { phone_number } = body;

    if (!phone_number) {
      return NextResponse.json(
        { error: "phone_number is required" },
        { status: 400 }
      );
    }

    // 1️⃣ Get saved sheet mapping for this phone number
    let sheetMapping;
    try {
      const { data, error: mappingError } = await supabase
        .from("google_sheet_mappings")
        .select("*")
        .eq("phone_number", phone_number)
        .single();

      if (mappingError) {
        if (mappingError.code === 'PGRST116') {
          return NextResponse.json(
            { error: "No Google Sheet configured for this number" },
            { status: 404 }
          );
        }
        throw mappingError;
      }

      sheetMapping = data;
    } catch (dbError) {
      console.error("Database error fetching sheet mapping:", dbError);
      return NextResponse.json(
        { error: "Database error while fetching sheet mapping" },
        { status: 500 }
      );
    }

    // ⭐ NEW: Fetch phone mapping to get custom API keys
    const { data: phoneMapping } = await supabase
      .from("phone_document_mapping")
      .select("mistral_api_key")
      .eq("phone_number", phone_number)
      .limit(1)
      .single();

    const mistralKey = phoneMapping?.mistral_api_key;

    if (!sheetMapping.sheet_id) {
      return NextResponse.json(
        { error: "Invalid sheet mapping - missing sheet_id" },
        { status: 400 }
      );
    }

    console.log(`Reading Google Spreadsheet: ${sheetMapping.sheet_id}`);

    const { getSpreadsheetSheets } = await import("@/lib/googleSheet");
    const allSheetNames = await getSpreadsheetSheets(sheetMapping.sheet_id);
    console.log(`Found ${allSheetNames.length} sheets: ${allSheetNames.join(", ")}`);

    const rowData: Array<{
      hash: string;
      content: string;
    }> = [];

    for (const tabName of allSheetNames) {
      console.log(`Processing sheet: ${tabName}`);
      let sheetData;
      try {
        sheetData = await readGoogleSheet(sheetMapping.sheet_id, `${tabName}!A1:Z5000`);
      } catch (err) {
        console.error(`Error reading sheet ${tabName}:`, err);
        continue;
      }

      if (!sheetData || sheetData.length <= 1) continue;

      const dataRows = sheetData.slice(1); // Skip header row
      dataRows.forEach((row) => {
        // Convert row to string (join non-empty cells with " | ")
        const rowString = row
          .map(cell => (cell || "").toString().trim())
          .filter(cell => cell.length > 0)
          .join(" | ");

        if (rowString.trim()) {
          // Include tab name in content for context
          const finalContent = `[Source: ${tabName}] ${rowString}`;
          
          // Generate SHA256 hash (including tab name to differentiate same data on different tabs)
          const hash = createHash('sha256')
            .update(finalContent)
            .digest('hex');

          rowData.push({
            hash,
            content: finalContent
          });
        }
      });
    }

    console.log(`Total data rows across all sheets: ${rowData.length}`);

    // 3️⃣ Create a set of current hashes for comparison
    const currentSheetHashes = new Set(rowData.map(r => r.hash));

    // 4️⃣ Get existing chunks for this phone number and source
    let existingChunks: Array<{ id: string; row_hash: string; content: string }> = [];
    try {
      const { data: existingData, error: existingError } = await supabase
        .from("chunks")
        .select("id, row_hash, content")
        .eq("phone_number", phone_number)
        .eq("source", "google_sheet");

      if (existingError) {
        console.error("Error fetching existing chunks:", existingError);
        return NextResponse.json(
          { error: "Failed to fetch existing chunks" },
          { status: 500 }
        );
      }

      existingChunks = existingData || [];
    } catch (fetchError) {
      console.error("Database error fetching chunks:", fetchError);
      return NextResponse.json(
        { error: "Database error fetching chunks" },
        { status: 500 }
      );
    }

    // 5️⃣ Calculate what to add, delete, update
    const existingHashes = new Set(existingChunks.map(c => c.row_hash));
    const existingHashToChunk = new Map(existingChunks.map(c => [c.row_hash, c]));

    const toAdd = rowData.filter(row => !existingHashes.has(row.hash));
    const toDelete = existingChunks.filter(chunk => !currentSheetHashes.has(chunk.row_hash));
    const toUpdate = rowData.filter(row => {
      const existing = existingHashToChunk.get(row.hash);
      return existing && existing.content !== row.content;
    });

    console.log(`To add: ${toAdd.length}, to delete: ${toDelete.length}, to update: ${toUpdate.length}`);

    let added = 0;
    let deleted = 0;
    let updated = 0;

    // 6️⃣ Delete old chunks
    if (toDelete.length > 0) {
      try {
        const deleteIds = toDelete.map(chunk => chunk.id);
        const { error: deleteError } = await supabase
          .from("chunks")
          .delete()
          .in("id", deleteIds);

        if (deleteError) {
          console.error("Error deleting chunks:", deleteError);
          return NextResponse.json(
            { error: "Failed to delete old chunks" },
            { status: 500 }
          );
        }

        deleted = toDelete.length;
        console.log(`Deleted ${deleted} old chunks`);
      } catch (deleteError) {
        console.error("Database error during deletion:", deleteError);
        return NextResponse.json(
          { error: "Database error during deletion" },
          { status: 500 }
        );
      }
    }

    // 7️⃣ Update changed chunks
    if (toUpdate.length > 0) {
      try {
        for (const row of toUpdate) {
          const existing = existingHashToChunk.get(row.hash)!;
          const newEmbedding = await embedText(row.content, 3, mistralKey);

          const { error: updateError } = await supabase
            .from("chunks")
            .update({
              content: row.content,
              embedding: newEmbedding
            })
            .eq("id", existing.id);

          if (updateError) {
            console.error("Error updating chunk:", updateError);
            return NextResponse.json(
              { error: "Failed to update chunk" },
              { status: 500 }
            );
          }
        }

        updated = toUpdate.length;
        console.log(`Updated ${updated} chunks`);
      } catch (updateError) {
        console.error("Error during update:", updateError);
        return NextResponse.json(
          { error: "Failed to update chunks" },
          { status: 500 }
        );
      }
    }

    // 8️⃣ Add new chunks
    if (toAdd.length > 0) {
      try {
        // Process in batches to avoid rate limits
        const BATCH_SIZE = 50;
        const BATCH_DELAY_MS = 2000;

        for (let i = 0; i < toAdd.length; i += BATCH_SIZE) {
          const batch = toAdd.slice(i, i + BATCH_SIZE);
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(toAdd.length / BATCH_SIZE);

          console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} rows)...`);

          // Generate embeddings for batch efficiently
          const embeddings = await embedBatch(batch.map(row => row.content), 3, mistralKey);

          // Prepare data for insertion
          const chunksToInsert = batch.map((row, idx) => ({
            phone_number,
            content: row.content,
            embedding: embeddings[idx],
            source: "google_sheet",
            row_hash: row.hash
          }));

          // Insert chunks
          const { error: insertError } = await supabase
            .from("chunks")
            .insert(chunksToInsert);

          if (insertError) {
            console.error("Error inserting chunks:", insertError);
            return NextResponse.json(
              { error: "Failed to save chunks" },
              { status: 500 }
            );
          }

          // Wait before next batch
          if (i + BATCH_SIZE < toAdd.length) {
            console.log(`Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`);
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }

        added = toAdd.length;
        console.log(`Added ${added} new chunks`);
      } catch (addError) {
        console.error("Error during addition:", addError);
        return NextResponse.json(
          { error: "Failed to add new chunks" },
          { status: 500 }
        );
      }
    }

    // 9️⃣ Update last_synced_at and last_row_count
    try {
      const { error: updateError } = await supabase
        .from("google_sheet_mappings")
        .update({
          last_synced_at: new Date().toISOString(),
          last_row_count: rowData.length
        })
        .eq("phone_number", phone_number);

      if (updateError) {
        console.error("Error updating sync metadata:", updateError);
        // Don't fail the request for this
      }
    } catch (updateError) {
      console.error("Database error updating sync metadata:", updateError);
      // Don't fail the request for this
    }

    // 🔟 Return success response
    return NextResponse.json({
      totalRows: rowData.length,
      newRows: added,
      deletedRows: deleted,
      lastSyncedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json(
      { error: "Failed to sync Google Sheet" },
      { status: 500 }
    );
  }
}