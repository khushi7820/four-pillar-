
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");

async function checkPhoneNumbers() {
    const { data, error } = await supabase
        .from('user_conversation_data')
        .select('from_number, to_number, current_stage')
        .limit(10);
    
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Existing Phone Numbers in state table:", data);
    }
}

checkPhoneNumbers();
