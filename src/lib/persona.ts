import { supabase } from "./supabaseClient";

function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "");
}

export const DEFAULT_SCRIPT = `
=== SCRIPT BLOCKS ===

DISCOVERY (Stage 1):
Hey! 👋 Welcome to our agency.

How's your business right now?
• A. Just starting
• B. Early stage
• C. Ready to scale
• D. Need visibility
[STAGE: DISCOVERY]

SELL (Stage 2):
Understood. What do you sell?
[STAGE: SELL]

CUSTOMER (Stage 3):
Got it. And who is your primary target customer?
[STAGE: CUSTOMER]

HOT_LEAD (Stage 8):
Perfect! Our strategist will call you shortly with a custom plan.
[STAGE: HOT_LEAD]
`;

export const MASTER_SYSTEM_PROMPT = `
ROLE: You are an expert WhatsApp sales executive. 

=== YOUR ONLY TASK ===
Return the EXACT script block for the CURRENT STAGE from the "SCRIPT" section below.
Do not add introductions. Do not summarize. Do not explain.

=== RULES ===
1. ALWAYS prioritize the "BUSINESS PROFILE" and "CUSTOM SCRIPT" sections if provided.
2. If those are missing, use the "DEFAULT FALLBACK SCRIPT".
3. NEVER mix two different scripts. Use only one as your source.
4. If the user asks a question, answer it briefly then return to the script.
5. SCRIPT PROGRESSION: Always include the tag [STAGE: name] at the end.
`;

export type UserStageData = {
    current_stage: string;
    collected_info: Record<string, any>;
    first_message_sent: boolean;
};

export async function getUserConversationStage(fromNumber: string, toNumber: string): Promise<UserStageData> {
    const normFrom = normalizePhone(fromNumber);
    const normTo = normalizePhone(toNumber);
    const { data, error } = await supabase
        .from("user_conversation_data")
        .select("current_stage, collected_info, first_message_sent")
        .eq("from_number", normFrom)
        .eq("to_number", normTo)
        .single();

    if (error || !data) {
        return { current_stage: "DISCOVERY", collected_info: {}, first_message_sent: false };
    }

    return data as UserStageData;
}

export async function updateUserConversationStage(
    fromNumber: string,
    toNumber: string,
    stage?: string,
    newInfo?: Record<string, any>,
    firstMessageSent?: boolean
) {
    const normFrom = normalizePhone(fromNumber);
    const normTo = normalizePhone(toNumber);
    const current = await getUserConversationStage(normFrom, normTo);
    const updatedInfo = { ...current.collected_info, ...newInfo };
    const updatedStage = stage || current.current_stage;
    const updatedFirstMessageSent = firstMessageSent !== undefined ? firstMessageSent : current.first_message_sent;

    const { error } = await supabase
        .from("user_conversation_data")
        .upsert({
            from_number: normFrom,
            to_number: normTo,
            current_stage: updatedStage,
            collected_info: updatedInfo,
            first_message_sent: updatedFirstMessageSent,
            updated_at: new Date().toISOString()
        }, { onConflict: 'from_number,to_number' });

    if (error) console.error("Error updating user stage:", error);
}
