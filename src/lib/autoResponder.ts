import { supabase } from "./supabaseClient";
import { embedText } from "./embeddings";
import { retrieveRelevantChunksForPhoneNumber } from "./retrieval";
import { getFilesForPhoneNumber } from "./phoneMapping";
import { sendWhatsAppMessage } from "./whatsappSender";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MASTER_SYSTEM_PROMPT, getUserConversationStage, updateUserConversationStage } from "./persona";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!,
});

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export type AutoResponseResult = {
    success: boolean;
    response?: string;
    error?: string;
    noDocuments?: boolean;
    sent?: boolean;
};

/**
 * Generate an automatic response for a WhatsApp message
 * Works with ANY custom system prompt - not limited to marketing
 */
export async function generateAutoResponse(
    fromNumber: string,
    toNumber: string,
    messageText: string,
    messageId: string,
    senderName?: string
): Promise<AutoResponseResult> {
    try {
        console.log(`--- Starting Fast Auto-Response for ${toNumber} ---`);
        const startTime = Date.now();

        // 1. Fetch mapping first (needed for custom API keys)
        const mappingResult = await supabase
            .from("phone_document_mapping")
            .select("system_prompt, auth_token, origin, gemini_api_key, groq_api_key, mistral_api_key")
            .eq("phone_number", toNumber)
            .single();

        const phoneMapping = mappingResult.data;
        if (mappingResult.error || !phoneMapping) {
            console.error("Error fetching phone mapping:", mappingResult.error);
            return {
                success: false,
                error: "Failed to fetch phone mapping details or number not found",
            };
        }

        // 2. Parallelize remaining data fetching using custom keys if available
        const [fileIds, queryEmbedding, historyResult, userStageData] = await Promise.all([
            getFilesForPhoneNumber(toNumber),
            embedText(messageText, 3, phoneMapping.mistral_api_key),
            supabase
                .from("whatsapp_messages")
                .select("content_text, event_type, from_number, to_number, received_at")
                .or(`and(from_number.eq.${fromNumber},to_number.eq.${toNumber}),and(from_number.eq.${toNumber},to_number.eq.${fromNumber})`)
                .gte("received_at", new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString())
                .order("received_at", { ascending: true })
                .limit(40),
            getUserConversationStage(fromNumber, toNumber)
        ]);

        if (fileIds.length === 0) {
            console.log(`No documents mapped for business number: ${toNumber}`);
            return {
                success: false,
                noDocuments: true,
                error: "No documents mapped to this business number",
            };
        }


        const customSystemPrompt = phoneMapping.system_prompt;
        const auth_token = phoneMapping.auth_token;
        const origin = phoneMapping.origin;

        if (!auth_token || !origin) {
            console.error("No credentials found for phone number");
            return {
                success: false,
                error: "No WhatsApp API credentials found",
            };
        }

        if (!queryEmbedding) {
            return {
                success: false,
                error: "Failed to generate embedding",
            };
        }

        // 2. Vector Search (Depends on embedding)
        const matches = await retrieveRelevantChunksForPhoneNumber(
            queryEmbedding,
            toNumber,
            5
        );

        const contextText = matches.length > 0
            ? matches.map((m) => m.chunk).join("\n\n")
            : "";

        // 1.5 Calculate Time Gap
        const historyRows = historyResult.data || [];
        const lastMsg = historyRows[historyRows.length - 1];
        const lastMessageAt = lastMsg ? new Date(lastMsg.received_at).getTime() : 0;
        const timeGapDays = lastMessageAt > 0 ? (Date.now() - lastMessageAt) / (1000 * 60 * 60 * 24) : 0;
        const isReturningUser = timeGapDays > 3;

        // 3. Process history
        const history = historyRows
            .filter(m => m.content_text && (m.event_type === "MoMessage" || m.event_type === "MtMessage"))
            .map(m => ({
                role: m.event_type === "MoMessage" ? "user" as const : "assistant" as const,
                content: m.content_text
            }));

        // 4. Detect language
        const detectedLanguage = detectLanguage(messageText, history);

        console.log(`Pre-processing took ${Date.now() - startTime}ms (Gap: ${timeGapDays.toFixed(1)} days)`);

        // 7. Build the system prompt using the master persona ONLY
        // We IGNORE custom prompts to ensure the script mirror is perfect
        let systemPrompt: string = MASTER_SYSTEM_PROMPT;

        const STAGE_MAP: Record<string, string> = {
            "DISCOVERY": "SELL",
            "SELL": "CUSTOMER",
            "CUSTOMER": "BRANDING",
            "BRANDING": "MARKETING",
            "MARKETING": "GOAL",
            "GOAL": "BUDGET",
            "BUDGET": "HOT_LEAD",
            "NURTURE_CONTENT": "NURTURE_DIGITAL",
            "NURTURE_DIGITAL": "DISCOVERY_SESSIONS",
            "DISCOVERY_SESSIONS": "HOT_LEAD",
            "PROMPT_CONTINUE": "DISCOVERY" // Fallback if they say anything
        };

        const isGreeting = /^(hey|hi|hello|menu|hy|hyy|hii|hiii|heyy|heyyy|namaste|kem cho|kese ho|kaise ho)$/i.test(messageText.trim());
        const isStartFresh = /^(start fresh|fresh one|fresh|new topic|new|restart|start new|start over|start again)$/i.test(messageText.trim());
        const isContinue = /^(continue|same|old|yes|y)$/i.test(messageText.trim());

        let nextStage = STAGE_MAP[userStageData.current_stage] || userStageData.current_stage;

        if (isGreeting) {
            if (!userStageData.first_message_sent) {
                // First time ever saying hello
                nextStage = "DISCOVERY";
            } else {
                // Returning user saying hello, ALWAYS ask to continue
                nextStage = "PROMPT_CONTINUE";
            }
        } else if (isStartFresh) {
            nextStage = "DISCOVERY";
        } else if (isContinue) {
            // Re-send the current stage question that they left off at so they can answer it!
            nextStage = userStageData.current_stage;
        }

        // Add current state (for AI's internal knowledge ONLY)
        systemPrompt += `\n\n=== CONTEXT ===\n`;
        systemPrompt += `- Detected Language: ${detectedLanguage}\n`;
        systemPrompt += `- Current Stage: ${userStageData.current_stage}\n`;
        systemPrompt += `- Next Expected Stage: ${nextStage}\n`;

        if (!userStageData.first_message_sent) {
            systemPrompt += `\n\n=== TASK ===\n`;
            systemPrompt += `This is your first message. You MUST output EXACTLY the "DISCOVERY" stage text.\n`;
        }

        // STRICT SCRIPT ENFORCEMENT
        systemPrompt += `\n\n=== STRICT RULES ===\n`;
        systemPrompt += `1. NO CHATBOT BEHAVIOR: Do not be chatty. Do not summarize. Do not acknowledge their answer.\n`;
        systemPrompt += `2. COPY PASTE ONLY: Your ONLY job is to output the EXACT text for the Next Expected Stage (${nextStage}) from the SCRIPT BLOCKS above.\n`;
        
        if (nextStage === "PROMPT_CONTINUE") {
            systemPrompt += `3. SPECIAL TASK: The user said hello. You MUST ONLY output this exact question: "Would you like to continue our previous conversation, or should we start fresh with this new inquiry?"\n`;
            systemPrompt += `4. ALWAYS include the tag [STAGE: ${userStageData.current_stage}] at the end so we keep their old place saved.\n`;
        } else {
            systemPrompt += `3. DO NOT MAKE UP PLANS: Never invent pricing, plans, or services. Just output the script block.\n`;
            systemPrompt += `4. SCRIPT PROGRESSION: Always include the tag [STAGE: ${nextStage}] at the end of your message so the database updates.\n`;
            systemPrompt += `5. If the next stage is HOT_LEAD, just output the HOT_LEAD text and stop.\n`;
        }

        // 8. Add document context to system prompt (if any)
        if (contextText) {
            systemPrompt += `\n\n=== ADDITIONAL INFO ===\n${contextText}\n`;
        }

        const messages = [
            {
                role: "system" as const,
                content: `${systemPrompt}`,
            },
            ...history.slice(-20), // Last 20 messages for context
            {
                role: "user" as const,
                content: messageText
            }
        ];

        console.log(`Sending to LLM with ${messages.length} total messages. Target Stage: ${nextStage}`);

        // 10. Generate response with Priority Swap (Gemini Primary -> Groq Fallback)
        let response = "";
        let attemptStartTime = Date.now();

        // Use custom keys or default env vars
        const geminiKey = phoneMapping.gemini_api_key || process.env.GEMINI_API_KEY;
        const groqKey = phoneMapping.groq_api_key || process.env.GROQ_API_KEY;

        async function tryGemini() {
            if (!geminiKey) throw new Error("Gemini API key not configured");
            console.log("Attempting Gemini 1.5 Flash (Primary)...");
            const localGenAI = new GoogleGenerativeAI(geminiKey);
            const model = localGenAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            // Format messages for Gemini
            const geminiMessages = messages.map(m => ({
                role: m.role === "system" ? "user" : (m.role === "user" ? "user" : "model"),
                parts: [{ text: m.content }]
            }));

            const result = await model.generateContent({
                contents: geminiMessages.slice(1),
                systemInstruction: messages[0].content,
            });

            return result.response.text();
        }

        async function tryGroq(model: string) {
            if (!groqKey) throw new Error("Groq API key not configured");
            console.log(`Attempting Groq ${model} (Fallback)...`);
            const localGroq = new Groq({ apiKey: groqKey });
            const completion = await localGroq.chat.completions.create({
                model: model,
                messages,
                temperature: 0.7,
                max_tokens: 1200,
            });
            return completion.choices[0].message.content || "";
        }

        try {
            // Priority 1: Groq 70B (Reliable & Intelligent for Strict Instructions)
            response = await tryGroq("llama-3.3-70b-versatile");
            console.log(`Groq 70B success (Primary) in ${Date.now() - attemptStartTime}ms`);
        } catch (groq70Error: any) {
            console.warn("Groq 70B failed, trying Groq 8B...", groq70Error.message);
            try {
                // Priority 2: Groq 8B (Fallback)
                attemptStartTime = Date.now();
                response = await tryGroq("llama-3.1-8b-instant");
                console.log(`Groq 8B success (Fallback) in ${Date.now() - attemptStartTime}ms`);
            } catch (groq8Error: any) {
                console.error("Groq 8B also failed, trying Gemini...", groq8Error.message);
                try {
                    // Priority 3: Gemini 1.5 Flash (Final Fallback)
                    attemptStartTime = Date.now();
                    const localGenAI = new GoogleGenerativeAI(geminiKey || "");
                    const model = localGenAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                    const geminiMessages = messages.map(m => ({
                        role: m.role === "system" ? "user" : (m.role === "user" ? "user" : "model"),
                        parts: [{ text: m.content }]
                    }));

                    const result = await model.generateContent({
                        contents: geminiMessages.slice(1),
                        systemInstruction: messages[0].content,
                    });
                    response = result.response.text();
                    console.log(`Gemini success in ${Date.now() - attemptStartTime}ms`);
                } catch (geminiError: any) {
                    console.error("All AI models failed!");
                    return { success: false, error: "AI service unavailable" };
                }
            }
        }

        // 11. FORCE PROGRESSION (Ignore AI hallucinations, follow the map)
        const stageUpdateMatch = response.match(/\[STAGE:\s*(.*?)\]/i);
        // If AI gives a tag, use it. Otherwise, use nextStage (which we calculated earlier)
        let newStage = stageUpdateMatch ? stageUpdateMatch[1].trim() : nextStage;

        // Ensure we don't accidentally save 'PROMPT_CONTINUE' as a DB state (we keep their old state instead)
        if (newStage === "PROMPT_CONTINUE") {
            newStage = userStageData.current_stage;
        }

        // Handle Budget Branching Manually for Safety
        if (userStageData.current_stage === "BUDGET") {
            const lowerRes = response.toLowerCase();
            if (lowerRes.includes("strat") || lowerRes.includes("blueprint") || lowerRes.includes("exactly the kind")) {
                newStage = "HOT_LEAD";
            } else {
                newStage = "NURTURE_CONTENT";
            }
        }

        const infoMatches = Array.from(response.matchAll(/\[INFO:\s*(.*?)=(.*?)\]/gi));
        let newInfo: Record<string, any> = {};
        for (const match of infoMatches) {
            newInfo[match[1].trim()] = match[2].trim();
        }

        // Clean meta-tags from response STERNLY
        response = response
            .replace(/\[STAGE:\s*.*?\]/gi, "")
            .replace(/\[INFO:\s*.*?=.*?\]/gi, "")
            .trim();

        // Update database stage/info
        await updateUserConversationStage(fromNumber, toNumber, newStage, newInfo, true);

        // 12. SMART SPLITTING (MAX 2 BUBBLES)
        let messageChunks = response
            .split(/\n\n+/)
            .map(chunk => chunk.trim())
            .filter(chunk => chunk.length > 0);

        // Force exactly 2 bubbles if more are generated
        if (messageChunks.length > 2) {
            const first = messageChunks[0];
            const rest = messageChunks.slice(1).join("\n\n");
            messageChunks = [first, rest];
        }

        console.log(`Sending response in ${messageChunks.length} bubble(s) (Capped at 2)`);

        let allSent = true;
        let lastError = "";

        for (let i = 0; i < messageChunks.length; i++) {
            const chunk = messageChunks[i];
            const sendResult = await sendWhatsAppMessage(fromNumber, chunk, auth_token, origin);

            if (sendResult.success) {
                const responseMessageId = `auto_${messageId}_${Date.now()}_${i}`;
                await supabase
                    .from("whatsapp_messages")
                    .insert([
                        {
                            message_id: responseMessageId,
                            channel: "whatsapp",
                            from_number: toNumber,
                            to_number: fromNumber,
                            received_at: new Date().toISOString(),
                            content_type: "text",
                            content_text: chunk,
                            sender_name: "Four Pillars Assistant",
                            event_type: "MtMessage",
                            is_in_24_window: true,
                            is_responded: true,
                            auto_respond_sent: true,
                            raw_payload: {
                                messageId: responseMessageId,
                                isAutoResponse: true,
                                chunkIndex: i
                            },
                        },
                    ]);

                // Small natural delay between bubbles
                if (i < messageChunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                allSent = false;
                lastError = sendResult.error || "Unknown error";
            }
        }

        if (!allSent) {
            return {
                success: false,
                response,
                sent: false,
                error: `Failed to send response: ${lastError}`,
            };
        }

        // 13. Mark original message as responded
        await supabase
            .from("whatsapp_messages")
            .update({
                auto_respond_sent: true,
                is_responded: true,
                response_sent_at: new Date().toISOString(),
            })
            .eq("message_id", messageId);

        console.log(`✅ Auto-response chunks sent successfully to ${fromNumber}`);

        return {
            success: true,
            response,
            sent: true,
        };
    } catch (error) {
        console.error("Auto-response error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Detect language from message and conversation history
 */
function detectLanguage(text: string, history: Array<{ role: string, content: string }>): string {
    const lowerText = text.toLowerCase();

    // Gujarati detection
    const gujaratiChars = /[અ-હ્]/;
    const gujaratiWords = /\b(છે|શું|હું|તું|આ|તે|હતું|હોય|કરવું|જવું|આવવું|ખાવું|પીવું|સૂવું|બેસવું|ઊભું|રહેવું|કેમ|ક્યાં|ક્યારે|કોણ|શું|હા|ના|થોડું|ઘણું|સારું|ખરાબ|મોટું|નાનું|હેલો|નમસ્તે|ધન્યવાદ)\b/;
    if (gujaratiChars.test(text) || gujaratiWords.test(lowerText)) {
        return "gujarati";
    }

    // Hindi detection
    const hindiChars = /[अ-ह्]/;
    const hindiWords = /\b(है|हूँ|हो|कर|जा|આ|था|थी|थे|करना|जाना|आना|खाना|पीना|सोना|बैठना|खड़ा|रहना|क्या|कौन|कब|कहाँ|क्यों|कैसे|हाँ|नहीं|थोड़ा|बहुत|अच्छा|बुरा|बड़ा|छोटा|मैं|तू|वह|हम|तुम|वे|यह|ये|हेलो|नमस्ते|धन्यवाद)\b/;
    if (hindiChars.test(text) || hindiWords.test(lowerText)) {
        return "hindi";
    }

    // English detection
    const englishWords = /\b(the|is|are|was|were|has|have|had|will|would|can|could|should|may|might|must|do|does|did|make|get|take|come|go|see|know|think|say|tell|work|help|need|want|use|find|give)\b/;
    const hasEnglishWords = englishWords.test(lowerText);
    const hasNativeScript = hindiChars.test(text) || gujaratiChars.test(text);

    if (hasEnglishWords && !hasNativeScript) {
        return "english";
    }

    // Mixed language (Hinglish)
    if (hasEnglishWords && hasNativeScript) {
        return "hinglish";
    }

    // Check conversation history for consistency
    if (history.length > 0) {
        const recentMessage = history[history.length - 1].content;
        if (hindiChars.test(recentMessage)) return "hindi";
        if (gujaratiChars.test(recentMessage)) return "gujarati";
    }

    // Default
    return "english";
}

/**
 * Generate a gentle reminder/follow-up message
 */
export async function generateReminderResponse(
    fromNumber: string, // The user's number
    toNumber: string,   // The business number
): Promise<AutoResponseResult> {
    try {
        console.log(`--- Generating Reminder for ${fromNumber} (via ${toNumber}) ---`);

        // 1. Fetch mapping and history
        const [mappingResult, historyResult] = await Promise.all([
            supabase
                .from("phone_document_mapping")
                .select("system_prompt, auth_token, origin, gemini_api_key, groq_api_key, mistral_api_key")
                .eq("phone_number", toNumber)
                .single(),
            supabase
                .from("whatsapp_messages")
                .select("content_text, event_type, from_number, to_number, raw_payload")
                .or(`and(from_number.eq.${fromNumber},to_number.eq.${toNumber}),and(from_number.eq.${toNumber},to_number.eq.${fromNumber})`)
                .gte("received_at", new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString())
                .order("received_at", { ascending: true })
                .limit(40)
        ]);

        const phoneMapping = mappingResult.data;
        if (mappingResult.error || !phoneMapping) return { success: false, error: "Mapping not found" };

        const historyRows = (historyResult.data || []).slice(-10);
        const history = historyRows
            .filter(m => m.content_text && (m.event_type === "MoMessage" || m.event_type === "MtMessage"))
            .map(m => ({
                role: m.event_type === "MoMessage" ? "user" as const : "assistant" as const,
                content: m.content_text
            }));

        if (history.length === 0) return { success: false, error: "No history found" };

        // Check if the very last message was already a reminder
        const latestMsg = historyRows[historyRows.length - 1];
        if (latestMsg?.raw_payload?.isReminder) {
            console.log("Last message was already a reminder. Skipping.");
            return { success: false, error: "Reminder already sent" };
        }

        const lastAiMessage = history.filter(h => h.role === "assistant").pop()?.content || "";
        const detectedLanguage = detectLanguage(lastAiMessage, history);

        // 2. Build reminder prompt
        const systemPrompt =
            `${phoneMapping.system_prompt || "You are a helpful assistant."}\n\n` +
            `=== REMINDER TASK ===\n` +
            `The user hasn't responded for 30 minutes. Your task is to send a VERY SHORT, gentle nudge to re-engage them.\n` +
            `- Be polite, non-pushy, and human-like.\n` +
            `- Reference the last topic briefly.\n` +
            `- Keep it to 1-2 lines MAX.\n` +
            `- Reply in ${detectedLanguage}.\n` +
            `- Don't sound like a bot.\n` +
            `- Do NOT use markdown bold/bullets.\n`;

        const messages = [
            { role: "system" as const, content: systemPrompt },
            ...history.slice(-5),
            { role: "user" as const, content: "[SYSTEM: The user has been silent for 30 mins. Send a short, natural follow-up in their language to check if they have more questions or want to proceed.]" }
        ];

        // 3. Generate with Fallback
        // Use custom keys or default
        const geminiKey = phoneMapping.gemini_api_key || process.env.GEMINI_API_KEY;
        const groqKey = phoneMapping.groq_api_key || process.env.GROQ_API_KEY;

        let response = "";
        try {
            if (!groqKey) throw new Error("No Groq key");
            const localGroq = new Groq({ apiKey: groqKey });
            const completion = await localGroq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages,
                temperature: 0.8,
                max_tokens: 150,
            });
            response = completion.choices[0].message.content || "";
        } catch (e: any) {
            console.error("Groq reminder failed:", e.message);
            if (geminiKey) {
                const localGenAI = new GoogleGenerativeAI(geminiKey);
                const model = localGenAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await model.generateContent({
                    contents: messages.map(m => ({
                        role: m.role === "system" ? "user" : (m.role === "user" ? "user" : "model"),
                        parts: [{ text: m.content }]
                    })).slice(1),
                    systemInstruction: messages[0].content,
                });
                response = result.response.text();
            }
        }

        if (!response) return { success: false, error: "No response generated" };

        // 4. Send to WhatsApp
        const sendResult = await sendWhatsAppMessage(fromNumber, response, phoneMapping.auth_token, phoneMapping.origin);

        if (sendResult.success) {
            const responseMessageId = `reminder_${fromNumber}_${Date.now()}`;
            await supabase.from("whatsapp_messages").insert([{
                message_id: responseMessageId,
                channel: "whatsapp",
                from_number: toNumber,
                to_number: fromNumber,
                received_at: new Date().toISOString(),
                content_type: "text",
                content_text: response,
                sender_name: "AI Assistant",
                event_type: "MtMessage",
                raw_payload: { isReminder: true }
            }]);
            return { success: true, response, sent: true };
        }

        return { success: false, error: sendResult.error };
    } catch (error) {
        console.error("Reminder error:", error);
        return { success: false, error: "Internal error" };
    }
}