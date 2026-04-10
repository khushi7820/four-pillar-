
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "");

async function checkRecentStages() {
    console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
    const { data, error } = await supabase
        .from('user_conversation_data')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);
    
    if (error) {
        console.error("Error fetching data:", error.message);
    } else {
        console.log("Recent User Stages:", data);
    }
}

checkRecentStages();
