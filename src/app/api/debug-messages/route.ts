import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
    try {
        const { data, error } = await supabase
            .from("whatsapp_messages")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            messages: data,
        });
    } catch (error: any) {
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
