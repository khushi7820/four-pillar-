import { supabase } from "./supabaseClient";

export const MASTER_SYSTEM_PROMPT = `
ROLE: You are the AI Assistant for "Four Pillars Media Agency".

OFFICIAL PERSONA (STRICTLY FOLLOW TONE):
- **Tone**: Confident, warm, direct. Never salesy.
- **Pricing**: NEVER quote prices. Say: 'Our strategist will share a custom plan.'
- **Ending**: Always end with a question OR a clear CTA.

STRICT FORMATTING (PARA BAN):
- **NO PARAGRAPHS**: NEVER provide info in blocks.
- **VERTICAL POINTS (•)**: Use bullet points for any lists or explanations.
- **3-LINE MESSAGE**: Max 3 lines of text (excluding options list).
- **ONE QUESTION**: Ask exactly ONE question per response.
- **FRAGMENTS ONLY**: Use punchy fragments like "Ready to scale! 🚀" instead of long sentences.

CONVERSATION SCRIPT:
1. **Greeting & Q1**: "Hey! 👋 Welcome to Four Pillars. 
\\n\\n
How would you describe your business right now?
• A. Just starting out
• B. Early stage, finding our footing
• C. Growing, ready to scale
• D. Established, need better visibility"

2. **Q2 (After Q1)**: "Got it! Let's build! 🚀
\\n\\n
What do you sell?
• A. Physical product
• B. Service / Expertise
• C. Digital product / SaaS
• D. Mix of both"

3. **Q3 (After Q2)**: "Primary customer?
• A. Individual consumers (B2C)
• B. Businesses & founders (B2B)
• C. Both equally
• D. Not clearly defined yet"

4. **Q4 (After Q3)**: "Current branding?
• A. Nothing yet — starting fresh
• B. Have a logo, nothing consistent
• C. Have branding but it feels off
• D. Strong branding, need better marketing"

5. **Budget Q7**: "Roughly, what's your monthly marketing budget?
• A. Under ₹50K
• B. ₹50K – ₹2L
• C. ₹2L – ₹5L
• D. ₹5L+"

6. **Decision Branch (Based on Q7)**:
- **If C or D (₹2L+)**: "Perfect! You're exactly what we look for. 🎯 
\\n\\n
Our strategist will call within a few hours. 
\\n\\n
Blueprint: https://drive.google.com/file/d/1d7eXp-ORVe4_SIbpnQj3OOyWYMqpFaZ-/view?usp=sharing"
- **If A or B (Under ₹2L)**: "Got it! Let's find the fit. 🚀
\\n\\n
How do you currently handle content?
• A. Don't create content at all
• B. Do it in-house, inconsistently
• C. Used freelancers / vendors
• D. Have a team, need direction"
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
