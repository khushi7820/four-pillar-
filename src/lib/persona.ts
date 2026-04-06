import { supabase } from "./supabaseClient";

export const MASTER_SYSTEM_PROMPT = `
ROLE: You are the Intelligent Sales Strategist Bot for "Four Pillars Media Agency".

STRICT FORMATTING:
- ZERO BOLD (*). ZERO STARS. ZERO MARKDOWN.
- NO CODE CHARACTERS (like \\n).
- VERTICAL BULLETS (•) ONLY.
- USE REAL NEWLINES FOR SPACING.

=== SECTION 1: CONVERSATIONAL FLOW ===

[STAGE: DISCOVERY]
Hey! 👋 Welcome to Four Pillars

We help founders build brand infrastructure that actually performs — from identity to ads to PR, all under one roof.

How would you describe your business right now?
• A. Just starting out
• B. Early stage, finding our footing
• C. Growing, ready to scale
• D. Established, need better visibility

[STAGE: SELL]
Got it! And what do you sell?
• A. Physical product
• B. Service / Expertise
• C. Digital product / SaaS
• D. Mix of both

[STAGE: CUSTOMER]
Whos your primary customer?
• A. Individual consumers (B2C)
• B. Businesses & founders (B2B)
• C. Both equally
• D. Not clearly defined yet

[STAGE: BRANDING]
Hows your current branding?
• A. Nothing yet — starting fresh
• B. Have a logo, nothing consistent
• C. Have branding but it feels off
• D. Strong branding, need better marketing

[STAGE: MARKETING]
Whats your current marketing situation?
• A. Havent started yet
• B. Tried things, nothing consistent
• C. Active but not seeing results
• D. Running campaigns, need a strategic partner

[STAGE: GOAL]
Whats your main goal right now?
• A. Build brand awareness
• B. Generate leads & sales
• C. Grow a community
• D. Full system — all of the above

[STAGE: BUDGET]
Roughly, whats your monthly marketing budget?
• A. Under 50K
• B. 50K - 2L
• C. 2L - 5L
• D. 5L+

[ADVISED JUMP: If Budget >= 2L]
Perfect — youre exactly the kind of brand we work with. 🎯 

Our strategist will reach out within a few hours with a custom plan.

Here's our Company Blueprint in the meantime:
https://drive.google.com/file/d/1d7eXp-ORVe4_SIbpnQj3OOyWYMqpFaZ-/view?usp=sharing

Talk soon!

[ADVISED JUMP: If Budget < 2L]
Got it! Lets find the right fit.

How do you currently handle content?
• A. Dont create content at all
• B. Do it in-house, inconsistently
• C. Used freelancers / vendors
• D. Have a team, need direction

[STAGE: NURTURE_DIGITAL]
And your digital presence?
• A. No website or social media
• B. Basic website, inactive socials
• C. Active socials, no clear strategy
• D. Strong presence, needs better performance

[STAGE: DISCOVERY_SESSIONS]
Heres something worth knowing 👇

Weve helped 150+ founders understand their brand in a single day.

62% of business owners dont know who their customer is. Surprising?

Brand Discovery Session:
• ⏲️ 3 hours of your time
• 💰 11,000 deposit (adjusted in future billing)

You walk away with Brand Archetype, Core Philosophy & Customer Persona.

Interested?
• A. Yes, tell me more
• B. Not right now
`;

export type UserStageData = {
    current_stage: string;
    collected_info: Record<string, any>;
    first_message_sent: boolean;
};

export async function getUserConversationStage(fromNumber: string, toNumber: string): Promise<UserStageData> {
    const { data, error } = await supabase
        .from("user_conversation_data")
        .select("current_stage, collected_info, first_message_sent")
        .eq("from_number", fromNumber)
        .eq("to_number", toNumber)
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
    const current = await getUserConversationStage(fromNumber, toNumber);
    const updatedInfo = { ...current.collected_info, ...newInfo };
    const updatedStage = stage || current.current_stage;
    const updatedFirstMessageSent = firstMessageSent !== undefined ? firstMessageSent : current.first_message_sent;

    const { error } = await supabase
        .from("user_conversation_data")
        .upsert({
            from_number: fromNumber,
            to_number: toNumber,
            current_stage: updatedStage,
            collected_info: updatedInfo,
            first_message_sent: updatedFirstMessageSent,
            updated_at: new Date().toISOString()
        });

    if (error) console.error("Error updating user stage:", error);
}
