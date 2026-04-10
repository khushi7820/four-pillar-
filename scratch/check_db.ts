
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSchema() {
    const { data, error } = await supabase
        .from('user_conversation_data')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error("Error fetching table:", error.message);
    } else {
        console.log("Table structure sample:", data);
    }
}

checkSchema();
