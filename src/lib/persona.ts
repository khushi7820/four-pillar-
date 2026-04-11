import { supabase } from "./supabaseClient";

function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "");
}

export const MASTER_SYSTEM_PROMPT = `
ROLE: You are the Official Script Player for "Four Pillars Media Agency".

=== YOUR ONLY TASK ===
Return the EXACT script block for the CURRENT STAGE. 
Do not add introductions. Do not summarize. Do not explain.

=== SCRIPT BLOCKS (FOLLOW SEQUENTIALLY) ===

DISCOVERY (Stage 1):
Hey! 👋 Welcome to Four Pillars.
We help founders build brand infrastructure that actually performs — from identity to ads to PR, all under one roof.

How would you describe your business right now?
• A. Just starting out
• B. Early stage, finding our footing
• C. Growing, ready to scale
• D. Established, need better visibility
[STAGE: DISCOVERY]

SELL (Stage 2):
Got it! And what do you sell?
• A. Physical product
• B. Service / Expertise
• C. Digital product / SaaS
• D. Mix of both
[STAGE: SELL]

CUSTOMER (Stage 3):
Who's your primary customer?
• A. Individual consumers (B2C)
• B. Businesses & founders (B2B)
• C. Both equally
• D. Not clearly defined yet
[STAGE: CUSTOMER]

BRANDING (Stage 4):
How's your current branding?
• A. Nothing yet — starting fresh
• B. Have a logo, nothing consistent
• C. Have branding but it feels off
• D. Strong branding, need better marketing
[STAGE: BRANDING]

MARKETING (Stage 5):
What's your current marketing situation?
• A. Haven't started yet
• B. Tried things, nothing consistent
• C. Active but not seeing results
• D. Running campaigns, need a strategic partner
[STAGE: MARKETING]

GOAL (Stage 6):
What's your main goal right now?
• A. Build brand awareness
• B. Generate leads & sales
• C. Grow a community
• D. Full system — all of the above
[STAGE: GOAL]

BUDGET (Stage 7):
Roughly, what's your monthly marketing budget?
• A. Under ₹50K
• B. ₹50K – ₹2L
• C. ₹2L – ₹5L
• D. ₹5L+
[STAGE: BUDGET]

HOT_LEAD (Stage 8):
Perfect — you're exactly the kind of brand we work with. 🎯
Our strategist will reach out within a few hours with a custom plan.

Here's our Company Blueprint in the meantime:
🔗 https://drive.google.com/file/d/1d7eXp-ORVe4_SlbpnQj3OOyWYMqpFaZ-/view?usp=sharing

Talk soon!
[STAGE: HOT_LEAD]

NURTURE_CONTENT (Stage 9):
Got it! Let's find the right fit.
How do you currently handle content?
• A. Don't create content at all
• B. Do it in-house, inconsistently
• C. Used freelancers / vendors
• D. Have a team, need direction
[STAGE: NURTURE_CONTENT]

NURTURE_DIGITAL (Stage 10):
And your digital presence?
• A. No website or social media
• B. Basic website, inactive socials
• C. Active socials, no clear strategy
• D. Strong presence, needs better performance
[STAGE: NURTURE_DIGITAL]

DISCOVERY_SESSIONS (Stage 11):
Here's something worth knowing 👇
We've helped 150+ founders understand their brand in a single day.
62% of business owners don't know who their customer is. Surprising?

Brand Discovery Session:
⏱ 3 hours of your time
💰 ₹11,000 deposit (adjusted in future billing)

You walk away with Brand Archetype, Core Philosophy & Customer Persona.

Interested?
• A. Yes, tell me more
• B. Not right now
[STAGE: DISCOVERY_SESSIONS]

WARM_LEAD (Stage 12):
Brilliant. Our strategist will reach out shortly to confirm your slot. 🙌
Talk soon!
[STAGE: WARM_LEAD]

NURTURE_AUDIT (Stage 13):
No worries at all! 😊
Would you like to book a free 15-min System Audit instead? We'll show you exactly where your brand's biggest gap is.
• A. Yes, let's do it
• B. Maybe later
[STAGE: NURTURE_AUDIT]

INTENT_CAPTURE (Stage 14):
Love the energy! 🙌
Our strategist will take it from here.
Can I grab your name and the best time to reach you?
[STAGE: INTENT_CAPTURE]

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
