
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");

async function testUpsert() {
    const testData = {
        from_number: 'test_user',
        to_number: 'test_biz',
        current_stage: 'TEST_STAGE',
        updated_at: new Date().toISOString()
    };

    console.log("Testing upsert...");
    const { data, error } = await supabase
        .from('user_conversation_data')
        .upsert(testData)
        .select();
    
    if (error) {
        console.error("Upsert failed:", error.message);
    } else {
        console.log("Upsert success:", data);
        
        // Clean up
        await supabase
            .from('user_conversation_data')
            .delete()
            .eq('from_number', 'test_user');
    }
}

testUpsert();
