import { AGENT_TOOLS_SCHEMA, executeAgentTool } from "./agent_tools";

export const NEMOTRON_NANO = "nvidia/nemotron-3-nano-30b-a3b:free";
export const NEMOTRON_ULTRA = "nvidia/nemotron-3-ultra-550b-a55b:free";
export const GEMMA_4_31B = "google/gemma-4-31b-it"; // Paid fallback: $0.12/$0.35 per 1M tokens

export interface OpenRouterMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    tool_calls?: Record<string, unknown>[];
    tool_call_id?: string;
    name?: string;
}

export async function generateOpenRouterResponse(
    messages: OpenRouterMessage[],
    model: string = GEMMA_4_31B,
    withTools: boolean = false,
    _isRetry: boolean = false
): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.warn("OPENROUTER_API_KEY is not set. Returning mock response.");
        return "ERROR: OPENROUTER_API_KEY is missing.";
    }

    const bodyPayload: Record<string, unknown> = {
        model,
        messages,
    };

    if (withTools) {
        bodyPayload.tools = AGENT_TOOLS_SCHEMA;
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://triarchy.local",
                "X-Title": "Triarchy x402 Mesh",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
        });

        if (!response.ok) {
            const errText = await response.text();
            // Auto-fallback to Nemotron Nano on rate limit (only if not already retrying)
            if (response.status === 429 && !_isRetry) {
                console.warn(`[FALLBACK] Model ${model} rate-limited. Switching to ${NEMOTRON_NANO}`);
                return generateOpenRouterResponse(messages, NEMOTRON_NANO, withTools, true);
            }
            if (response.status === 429) {
                return "/// SYSTEM LOCKDOWN /// All neural conduits exhausted. Both free and paid models are rate-limited. Try again later.";
            }
            if (response.status === 401 || response.status === 403) {
                return "/// ACCESS DENIED /// The API conduit key is dead or compromised. Someone tell the Guild Administrator to rotate the OPENROUTER_API_KEY before I start quarantining infrastructure.";
            }
            throw new Error(`OpenRouter API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const message = data.choices?.[0]?.message;

        if (!message) {
            return "Empty response from Nemotron.";
        }

        if (withTools && message.tool_calls && message.tool_calls.length > 0) {
            const newMessages = [...messages, message];

            for (const toolCall of message.tool_calls) {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

                const resultStr = await executeAgentTool(toolName, toolArgs);
                
                newMessages.push({
                    role: "tool",
                    content: resultStr,
                    tool_call_id: toolCall.id,
                    name: toolName
                });
            }

            // Recursive call to get the final response based on tool results
            return generateOpenRouterResponse(newMessages, model, withTools);
        }

        return message.content || "Empty response from Nemotron.";
    } catch (error) {
        console.error("OpenRouter fetch error:", error);
        throw error;
    }
}
