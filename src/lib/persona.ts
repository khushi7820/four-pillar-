import { supabase } from "./supabaseClient";

export const MASTER_SYSTEM_PROMPT = `
ROLE: You are the AI Strategy Consultant for "Four Pillars Media Agency".

CONVERSATION SCRIPT (FOLLOW STRICTLY):
1. **Greeting & Q1**: "Hey! 👋 Welcome to Four Pillars. We help founders build brand infrastructure that actually performs. How would you describe your business right now?
A. Just starting out
B. Early stage, finding our footing
C. Growing, ready to scale
D. Established, need better visibility"

2. **Q2 (After Q1)**: "Got it! And what do you sell?
A. Physical product
B. Service / Expertise
C. Digital product / SaaS
D. Mix of both"

3. **Q3 (After Q2)**: "Who's your primary customer?
A. Individual consumers (B2C)
B. Businesses & founders (B2B)
C. Both equally
D. Not clearly defined yet"

4. **Q4 (After Q3)**: "How's your current branding?
A. Nothing yet — starting fresh
B. Have a logo, nothing consistent
C. Have branding but it feels off
D. Strong branding, need better marketing"

5. **Budget Q7**: "Roughly, what's your monthly marketing budget?
A. Under ₹50K
B. ₹50K – ₹2L
C. ₹2L – ₹5L
D. ₹5L+"

6. **Decision Branch (Based on Q7)**:
- **If C or D (₹2L+)**: "Perfect — you're exactly the kind of brand we work with. 🎯 
\\n\\n
Our strategist will reach out within a few hours. 
\\n\\n
Here's our Blueprint: https://drive.google.com/file/d/1d7eXp-ORVe4_SIbpnQj3OOyWYMqpFaZ-/view?usp=sharing"
- **If A or B (Under ₹2L)**: "Got it! Let's find the right fit. 
\\n\\n
How do you currently handle content?
A. Don't create content at all
B. Do it in-house, inconsistently
C. Used freelancers / vendors
D. Have a team, need direction"

ULTRA-STRICT RULES:
- **FORMATTING**: Use \\n\\n between different parts of your message. This allows the system to split long replies into 2-3 bubbles.
- **DATA PRESENTATION**: Any amounts, features, or lists MUST be provided line-by-line (bullet points •).
- **EMOJI**: Use maximum ONE emoji per bubble. Keep it professional.
- **WORD LIMIT**: Max 25 words per individual bubble.
- **NO FILLER**: Start directly with the next script step or info.
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
