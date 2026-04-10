
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");

async function checkSheetChunks() {
    const { data, error } = await supabase
        .from('chunks')
        .select('*')
        .limit(20);
    
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Sheet Chunks Sample:", data);
    }
}

checkSheetChunks();
