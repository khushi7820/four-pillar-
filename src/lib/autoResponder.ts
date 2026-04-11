import { supabase } from "./supabaseClient";
import { embedText } from "./embeddings";
import { retrieveRelevantChunksForPhoneNumber } from "./retrieval";
import { getFilesForPhoneNumber } from "./phoneMapping";
import { sendWhatsAppMessage } from "./whatsappSender";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MASTER_SYSTEM_PROMPT, getUserConversationStage, updateUserConversationStage } from "./persona";

function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, ""); // Remove everything except digits
}

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
    const normFrom = normalizePhone(fromNumber);
    const normTo = normalizePhone(toNumber);
    const capturedStages = ["HOT_LEAD", "WARM_LEAD", "INTENT_CAPTURE"];
    try {
        console.log(`--- Starting Fast Auto-Response for ${normTo} (From: ${normFrom}) ---`);
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
                .or(`and(from_number.eq.${normFrom},to_number.eq.${normTo}),and(from_number.eq.${normTo},to_number.eq.${normFrom})`)
                .gte("received_at", new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString())
                .order("received_at", { ascending: true })
                .limit(40),
            getUserConversationStage(normFrom, normTo)
        ]);

        if (fileIds.length === 0) {
            console.log(`❌ No documents mapped for business number: ${toNumber}`);
            return {
                success: false,
                noDocuments: true,
                error: "No documents mapped to this business number",
            };
        }

        console.log(`📍 User Stage Data:`, userStageData);
        console.log(`INPUT: ${messageText} | FROM: ${fromNumber} | CURRENT_STAGE: ${userStageData.current_stage}`);


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

        // 4.5 CLEAN HISTORY: Find the last 'start fresh' command to ensure a clean slate
        const startFreshRegex = /^(start fresh|fresh one|fresh|new topic|new|restart|start new|start over|start again)$/i;
        let lastFreshIndex = -1;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === "user" && startFreshRegex.test(history[i].content.trim())) {
                lastFreshIndex = i;
                break;
            }
        }
        
        // If the current message IS a start fresh, or we found one in history, slice accordingly
        const cleanHistoryChunks = lastFreshIndex !== -1 ? history.slice(lastFreshIndex + 1) : history;
        const finalHistory = cleanHistoryChunks.slice(-5); // Emergency limit to 5 to avoid 100k shutdown

        console.log(`Pre-processing took ${Date.now() - startTime}ms (Gap: ${timeGapDays.toFixed(1)} days)`);

        // 7. Get any custom prompt from the sheet
        let customContent = "";
        if (customSystemPrompt) {
            customContent = `\n\n=== BUSINESS PROFILE & CUSTOM SCRIPT ===\n${customSystemPrompt}\n`;
        }

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
            "DISCOVERY_SESSIONS": "WARM_LEAD",
            "NURTURE_AUDIT": "INTENT_CAPTURE",
            "PROMPT_CONTINUE": "DISCOVERY" 
        };

        const isGreeting = /^(hey|hi|hello|menu|hy|hyy|hii|hiii|heyy|heyyy|namaste|kem cho|kese ho|kaise ho|hay|hayy|hola|salaam|helow|heloww)$/i.test(messageText.trim());
        const isStartFresh = /^(start|start fresh|fresh one|fresh|new topic|new|restart|start new|start over|start again)$/i.test(messageText.trim());
        const isContinue = /^(continue|same|old|yes|y|ok|okay|okk|kk|okey|okeyy|yup|yeah|han|thik|theek|done|thik h|thik hai|yess|yep|agree|confirm|right)$/i.test(messageText.trim());

        // Link is no longer blacklisted

        let nextStage = STAGE_MAP[userStageData.current_stage] || userStageData.current_stage;

        // Break the loop if already in a captured/terminal stage
        if (capturedStages.includes(userStageData.current_stage) && nextStage === userStageData.current_stage) {
            nextStage = "ASSISTANT_CHAT";
        }

        // Custom Budget Branching Logic (Before any bypasses)
        if (userStageData.current_stage === "BUDGET") {
            const msgLower = messageText.toLowerCase();
            // A. Under 50k, B. 50k - 2L
            if (msgLower === "a" || msgLower === "b" || msgLower.includes("under") || msgLower.includes("50k")) {
                nextStage = "NURTURE_CONTENT";
            } else {
                nextStage = "HOT_LEAD";
            }
        }

        // Branching for Stage 11 (DISCOVERY_SESSIONS)
        if (userStageData.current_stage === "DISCOVERY_SESSIONS") {
            const msgLower = messageText.toLowerCase();
            if (msgLower === "b" || msgLower.includes("not right now") || msgLower.includes("no") || msgLower.includes("later")) {
                nextStage = "NURTURE_AUDIT";
            } else {
                nextStage = "WARM_LEAD";
            }
        }

        // Branching for Stage 13 (NURTURE_AUDIT)
        if (userStageData.current_stage === "NURTURE_AUDIT") {
            const msgLower = messageText.toLowerCase();
            if (msgLower === "a" || msgLower.includes("yes") || msgLower.includes("let")) {
                nextStage = "INTENT_CAPTURE";
            } else {
                // Stay here and let assistant mode take over
                nextStage = "NURTURE_AUDIT";
            }
        }
        if (isGreeting) {
            console.log("👋 Greeting detected");
            if (!userStageData.first_message_sent) {
                nextStage = "DISCOVERY";
            } else {
                nextStage = "PROMPT_CONTINUE";
            }
        } else if (isStartFresh) {
            console.log("🆕 Start fresh detected. WIPING history for this prompt.");
            nextStage = "DISCOVERY";
            // Important: We don't slice the actual DB history, but we slice what we send to the LLM
        } else {
            console.log("🔄 Message received - advancing stage.");
            // nextStage was already calculated by STAGE_MAP lookup on line 179
        }

        console.log(`➡️ Calculated Next Stage: ${nextStage} (Current: ${userStageData.current_stage})`);

        // 9. Build the System Prompt
        const isCaptured = capturedStages.includes(nextStage) || capturedStages.includes(userStageData.current_stage);

        let systemPrompt = `ROLE: You are the Official Assistant for Four Pillars.`;
        
        // ONLY show the script if we are NOT in Assistant Mode
        if (!isCaptured) {
            systemPrompt += MASTER_SYSTEM_PROMPT;
        } else {
            systemPrompt += `\n\n=== ASSISTANT MODE ACTIVE ===\nYour goal is to answer questions using the knowledge base below.\n`;
        }

        systemPrompt += customContent;

        // Add context & FAQ info EARLY so they are "above" the final commands
        systemPrompt += `\n\n=== CONTEXT ===\n`;
        systemPrompt += `- Detected Language: ${detectedLanguage}\n`;
        systemPrompt += `- Current Stage: ${isStartFresh ? "DISCOVERY" : userStageData.current_stage}\n`;
        systemPrompt += `- Target Stage: ${nextStage}\n`;
        systemPrompt += `- User Name: ${userStageData.collected_info?.name || "Unknown"}\n`;
        systemPrompt += `- Already Collected Data: ${JSON.stringify(userStageData.collected_info || {}, null, 2)}\n`;
        systemPrompt += `\n\n=== ADDITIONAL INFO (For specific questions only) ===\n${contextText || "No additional info."}\n`;

        if (nextStage === "PROMPT_CONTINUE") {
            systemPrompt += `\n\n=== SPECIAL TASK (GREETING) ===\n`;
            systemPrompt += `The user said hello, but you already have a history with them.\n`;
            systemPrompt += `You MUST output EXACTLY this text:\n`;
            systemPrompt += `"Welcome back! Would you like to continue our previous conversation, or should we start fresh?"\n`;
            systemPrompt += `[STAGE: ${userStageData.current_stage}]\n`; // Retain the real stage secretly
        }

        if (isCaptured) {
            systemPrompt += `
\n\n=== CRITICAL FINAL COMMAND (ASSISTANT MODE) ===
1. CHAT MODE: The sales script is officially COMPLETE. You are now a helpful Assistant.
2. DO NOT REPEAT SCRIPT: Never output Stage 1-14 script blocks again. 
3. KNOWLEDGE MATCH: Search through the entire Google Sheet data provided above (Persona, Convo, FAQ, and Leads sections). You must analyze all 4 parts to ensure the correct answer.
4. ACKNOWLEDGEMENTS: If the user just says "ok", "okk", "kk", or similar, just reply with a quick emoji or "Great! Let me know if you need anything else."
5. ULTRA-CONCISE: Max 3 to 4 short bullet points only. 
6. NO MARKDOWN: NEVER use hashes (#) or stars (*). Use emojis 📌✨.
7. SPLIT BUBBLES: If the answer is longer than 5 or 6 lines, use a double line break (\\n\\n) to split it into 2 bubbles. No more than 2 bubbles.
8. NO CHATBOT FLUFF: Start immediately with the answer.
`;
        } else {
             systemPrompt += `
\n\n=== CRITICAL FINAL COMMAND (MANDATORY) ===
1. ACT AS A DUMB COPY-PASTE MACHINE. You are NOT an assistant.
2. YOUR ONLY JOB is to output the EXACT text for the Target Stage (${nextStage}) from the "SCRIPT" section above. 
3. DO NOT CHAT. DO NOT process the user's input. DO NOT explain their choice. DO NOT say "You chose..." or "Let's break it down."
4. Start your message IMMEDIATELY with the script text. NOTHING ELSE.
5. STAGE TAG: You MUST end your message with this exact tag: [STAGE: ${nextStage}]
`;           
        }

        if (isStartFresh) {
            systemPrompt += `\n\n=== FRESH START OVERRIDE ===\n`;
            systemPrompt += `1. User wants to START FRESH. Output ONLY the DISCOVERY script.\n`;
            systemPrompt += `2. IGNORE all previous data.\n`;
        }

        const messages = [
            {
                role: "system" as const,
                content: `${systemPrompt}`,
            },
            ...(isStartFresh ? [] : finalHistory), // Use cleaned history
            {
                role: "user" as const,
                content: messageText
            }
        ];

        console.log(`Sending to LLM with ${messages.length} total messages. Target Stage: ${nextStage}`);

        // --- HARDCODED SCRIPT BYPASS (SAVE TOKENS & KILL HALLUCINATIONS) ---
        let response = "";
        let bypassedLLM = false;

        if (nextStage === "PROMPT_CONTINUE") {
            response = `"Welcome back! Would you like to continue our previous conversation, or should we start fresh?"\n[STAGE: ${userStageData.current_stage}]`;
            bypassedLLM = true;
            console.log("⚡ Bypassing LLM for PROMPT_CONTINUE greeting");
        } else if (!isCaptured || (capturedStages.includes(nextStage) && userStageData.current_stage !== nextStage)) {
            // Bypass the LLM for ALL standard script stages, including terminal destinations (first entry only)!
            const lines = MASTER_SYSTEM_PROMPT.split('\n');
            let isCapturingBlock = false;
            let capturedLines = [];
            
            for (const line of lines) {
                if (line.trim().startsWith(`${nextStage} (Stage`)) {
                    isCapturingBlock = true;
                    continue; // Skip the header line
                }
                if (isCapturingBlock) {
                    capturedLines.push(line);
                    if (line.includes(`[STAGE: ${nextStage}]`)) {
                        response = capturedLines.join('\n').trim();
                        bypassedLLM = true;
                        console.log(`⚡ Bypassing LLM! Extracted exact text for stage: ${nextStage}`);
                        break;
                    }
                }
            }
        }

        // 10. Generate response with Priority Order (Groq 70B -> Groq 8B -> Gemini)
        let attemptStartTime = Date.now();

        if (!bypassedLLM) {

        // Use custom keys or default env vars
        const geminiKey = phoneMapping.gemini_api_key || process.env.GEMINI_API_KEY;
        const groqKey = phoneMapping.groq_api_key || process.env.GROQ_API_KEY;

        if (groqKey) {
            const keySource = phoneMapping.groq_api_key ? "DATABASE" : "ENV_VAR";
            console.log(`🔑 Groq Key Source: ${keySource} | ID: ...${groqKey.slice(-4)}`);
        } else {
            console.warn("⚠️ No Groq API key found!");
        }

        async function tryGroq(model: "llama-3.3-70b-versatile" | "llama-3.1-8b-instant") {
            if (!groqKey) throw new Error("Groq API key not configured");
            console.log(`Attempting Groq ${model}...`);
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
        } // Close if (!bypassedLLM)

        // 11. FORCE PROGRESSION (Absolute Lockdown)
        // We no longer trust the AI's regex tags. The calculated nextStage is ABSOLUTE.
        let newStage = nextStage;

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

        console.log(`💾 Updating DB: fromNumber=${normFrom}, newStage=${newStage}`);
        // Update database stage/info
        await updateUserConversationStage(normFrom, normTo, newStage, newInfo, true);
        console.log(`✅ DB Update attempted`);

        // 12. SMART SPLITTING (MAX 2 BUBBLES)
        let messageChunks = response
            .split(/\n\s*\n+/)
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

        // 13. Mark original message as responded AND background extract lead data
        // 13. Mark original message as responded AND background extract lead data
        const extractionKey = phoneMapping.gemini_api_key || process.env.GEMINI_API_KEY;
        const [extractedData] = await Promise.all([
            extractLeadData(messageText, extractionKey || ""),
            supabase
                .from("whatsapp_messages")
                .update({
                    auto_respond_sent: true,
                    is_responded: true,
                    response_sent_at: new Date().toISOString(),
                })
                .eq("message_id", messageId)
        ]);

        console.log("Extracted Lead Info:", extractedData);

        // 14. Save state with extracted data
        await updateUserConversationStage(fromNumber, toNumber, newStage, extractedData);
        console.log(`✅ DB Update attempted`);

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
 * Background extraction of lead data (name, business, etc.)
 */
async function extractLeadData(message: string, geminiKey: string): Promise<any> {
    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use stable version name

        const prompt = `
        TASK: Extract user data from the following WhatsApp message.
        MESSAGE: "${message}"

        Return ONLY a JSON object with any of these fields if found:
        - "name": Person's name
        - "business_type": What they sell (A, B, C, D choice or text)
        - "customer_type": Who they sell to (A, B, C, D choice or text)
        - "budget": Budget level (A, B, C, D)
        - "time": Best time to call
        
        If nothing found, return {}.
        JSON ONLY. No explanation.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (e) {
        console.error("Extraction failed:", e);
        return {};
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