import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // Step 1: Get all phone mappings
        // We select only what we need, but we'll try to handle missing columns gracefully
        const { data: mappings, error: mappingError } = await supabase
            .from("phone_document_mapping")
            .select("*") // Selecting all to see what's available
            .order("phone_number", { ascending: true });

        if (mappingError) {
            console.error("Supabase error in phone-groups:", mappingError);
            throw mappingError;
        }

        console.log(`Found ${mappings?.length || 0} mappings`);

        // Step 2: Collect all non-null file IDs
        const fileIds = (mappings || [])
            .map((m: any) => m.file_id)
            .filter((id: string | null) => id != null);

        // Step 3: Fetch file details if there are any file IDs
        let filesMap: Record<string, any> = {};
        if (fileIds.length > 0) {
            const { data: files, error: filesError } = await supabase
                .from("rag_files")
                .select("id, name, file_type, created_at")
                .in("id", fileIds);

            if (!filesError && files) {
                files.forEach((f: any) => {
                    filesMap[f.id] = f;
                });
            }
        }

        // Step 4: Get chunk counts (try, but don't fail if table doesn't exist)
        let chunkCountMap: Record<string, number> = {};
        try {
            const { data: chunkCounts, error: chunkError } = await supabase
                .from("rag_chunks")
                .select("file_id");

            if (!chunkError && chunkCounts) {
                chunkCounts.forEach((chunk: any) => {
                    chunkCountMap[chunk.file_id] = (chunkCountMap[chunk.file_id] || 0) + 1;
                });
            }
        } catch {
            // rag_chunks table may not exist yet - continue gracefully
        }

        // Step 5: Group by phone number
        const phoneGroups: Record<string, any> = {};

        (mappings || []).forEach((mapping: any) => {
            const phone = mapping.phone_number;

            if (!phoneGroups[phone]) {
                phoneGroups[phone] = {
                    phone_number: phone,
                    intent: mapping.intent,
                    system_prompt: mapping.system_prompt,
                    auth_token: mapping.auth_token || "",
                    origin: mapping.origin || "",
                    gemini_api_key: mapping.gemini_api_key || null,
                    groq_api_key: mapping.groq_api_key || null,
                    mistral_api_key: mapping.mistral_api_key || null,
                    files: [],
                };
            }

            const file = mapping.file_id ? filesMap[mapping.file_id] : null;
            if (file) {
                phoneGroups[phone].files.push({
                    id: file.id,
                    name: file.name,
                    file_type: file.file_type,
                    chunk_count: chunkCountMap[file.id] || 0,
                    created_at: file.created_at,
                });
            }
        });

        const groups = Object.values(phoneGroups);

        return NextResponse.json({
            success: true,
            groups,
        });
    } catch (error) {
        console.error("Error fetching phone groups:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch phone groups",
            },
            { status: 500 }
        );
    }
}
