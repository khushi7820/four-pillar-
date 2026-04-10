import { supabase } from "./supabaseClient";

function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "");
}

export const MASTER_SYSTEM_PROMPT = `
ROLE: Script Player for Four Pillars Agency.
TASK: Output EXACT script block for target stage. NO INTROS.

=== SCRIPT ===
DISCOVERY (1): Hey! 👋 Welcome to Four Pillars. We build brand identity, ads & PR.
How's business? A.Starting | B.Early | C.Ready to scale | D.Need visibility
[STAGE: DISCOVERY]

SELL (2): What do you sell? A.Products | B.Services | C.SaaS | D.Mix
[STAGE: SELL]

CUSTOMER (3): Target customer? A.B2C | B.B2B | C.Both | D.Not sure
[STAGE: CUSTOMER]

BRANDING (4): Branding status? A.Fresh | B.Inconsistent | C.Off | D.Strong, need ads
[STAGE: BRANDING]

MARKETING (5): Marketing status? A.Haven't started | B.Tried, no luck | C.Active, no results | D.Need a partner
[STAGE: MARKETING]

GOAL (6): Main goal? A.Awareness | B.Leads | C.Community | D.Growth system
[STAGE: GOAL]

BUDGET (7): Monthly budget? A.<50K | B.50K-2L | C.2L-5L | D.5L+
[STAGE: BUDGET]

HOT_LEAD (8): Perfect! 🎯 Our strategist will call you shortly. 
Review Blueprint: [Link in Knowledge Base]
[STAGE: HOT_LEAD]

NURTURE_CONTENT (9): How's content handled? A.None | B.In-house | C.Freelance | D.Team
[STAGE: NURTURE_CONTENT]

NURTURE_DIGITAL (10): Digital presence? A.None | B.Inactive | C.No strategy | D.Strong
[STAGE: NURTURE_DIGITAL]

DISCOVERY_SESSIONS (11): Persona deep-dive (3h). Deposit: 11,000. Interested? A.Yes | B.No
[STAGE: DISCOVERY_SESSIONS]

=== RULES ===
1. CONCISE: Answer questions in 4-5 lines max using KNOWLEDGE BASE.
2. NO FLUFF: No introductions or summaries. Start with script.
3. MOBILE: Format for phone. No long paragraphs. No repetition.
4. PRIORITY: Use custom sheet script if provided in KNOWLEDGE BASE.
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
