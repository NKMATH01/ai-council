import { VerificationProvider, DebateEngineId, HarnessModelConfig } from "./types";
import { MODELS, DEBATE_ENGINES } from "./constants";
import { validateModelConfig } from "./model-registry";
import {
  getGeminiClient,
  getClaudeClient,
  getChatGPTClient,
} from "./ai-clients";
import {
  createRequestId,
  logAiStart,
  logAiComplete,
  logAiError,
} from "./ai-logger";

// ===== Claude 스트리밍 =====
export async function streamClaude(
  systemPrompt: string,
  userMessage: string,
  useOpus: boolean = false,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const client = getClaudeClient();
  const modelId = useOpus ? MODELS.prd.modelId : MODELS.debate.modelId;
  const maxTokens = useOpus ? 16000 : 4096;

  const reqId = createRequestId();
  const startedAt = Date.now();
  logAiStart({ requestId: reqId, model: modelId, provider: "anthropic", action: "streamClaude" });

  return new ReadableStream({
    async start(controller) {
      try {
        let fullText = "";
        let continueGenerating = true;
        let attempt = 0;
        const maxAttempts = useOpus ? 3 : 1;

        while (continueGenerating && attempt < maxAttempts) {
          attempt++;
          const messages: { role: "user" | "assistant"; content: string }[] = [];

          if (attempt === 1) {
            messages.push({ role: "user", content: userMessage });
          } else {
            messages.push({ role: "user", content: userMessage });
            messages.push({ role: "assistant", content: fullText });
            messages.push({
              role: "user",
              content: "이전 응답이 중간에 끊겼습니다. 끊긴 지점에서 바로 이어서 계속 작성하세요. 이미 작성된 부분을 반복하지 마세요.",
            });
          }

          const stream = client.messages.stream({
            model: modelId,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
          });

          let stopReason: string | null = null;

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullText += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
            if (event.type === "message_delta") {
              stopReason = (event as any).delta?.stop_reason || null;
            }
          }

          if (stopReason === "max_tokens" && useOpus) {
            continueGenerating = true;
          } else {
            continueGenerating = false;
          }
        }

        logAiComplete(reqId, startedAt);
        controller.close();
      } catch (error) {
        logAiError(reqId, startedAt, error instanceof Error ? error.message : String(error));
        controller.error(error);
      }
    },
  });
}

// ===== Claude 특정 모델 스트리밍 =====
export async function streamClaudeModel(
  modelId: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const client = getClaudeClient();

  const reqId = createRequestId();
  const startedAt = Date.now();
  logAiStart({ requestId: reqId, model: modelId, provider: "anthropic", action: "streamClaudeModel" });

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: modelId,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        logAiComplete(reqId, startedAt);
        controller.close();
      } catch (error) {
        logAiError(reqId, startedAt, error instanceof Error ? error.message : String(error));
        controller.error(error);
      }
    },
  });
}

// ===== Claude 비스트리밍 (추천 분석용) =====
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const reqId = createRequestId();
  const startedAt = Date.now();
  logAiStart({ requestId: reqId, model: MODELS.debate.modelId, provider: "anthropic", action: "callClaude" });

  try {
    const client = getClaudeClient();
    const response = await client.messages.create({
      model: MODELS.debate.modelId,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    logAiComplete(reqId, startedAt, {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    });

    const block = response.content[0];
    return block.type === "text" ? block.text : "";
  } catch (error) {
    logAiError(reqId, startedAt, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// ===== Claude 비스트리밍 (구조화된 JSON 출력) =====
// modelId를 명시적으로 받아서 generation/evaluation 모델 분리 가능
export async function callClaudeStructured(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8192,
  signal?: AbortSignal,
  modelId?: string,
): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException("AbortError", "AbortError");
  }

  const resolvedModel = modelId || MODELS.prd.modelId;
  const reqId = createRequestId();
  const startedAt = Date.now();
  logAiStart({ requestId: reqId, model: resolvedModel, provider: "anthropic", action: "callClaudeStructured" });

  try {
    const client = getClaudeClient();
    const response = await client.messages.create({
      model: resolvedModel,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    if (signal?.aborted) {
      throw new DOMException("AbortError", "AbortError");
    }

    logAiComplete(reqId, startedAt, {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    });

    return response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  } catch (error) {
    logAiError(reqId, startedAt, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function callOpenAIStructured(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8192,
  signal?: AbortSignal,
  modelId?: string,
): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException("AbortError", "AbortError");
  }

  const resolvedModel = modelId || MODELS.verification.chatgpt.modelId;
  const reqId = createRequestId();
  const startedAt = Date.now();
  const client = getChatGPTClient();
  const useBackground = resolvedModel === "gpt-5.5-pro";

  logAiStart({ requestId: reqId, model: resolvedModel, provider: "openai", action: "callOpenAIStructured" });

  try {
    let response = await client.responses.create({
      model: resolvedModel,
      instructions: systemPrompt,
      input: userMessage,
      max_output_tokens: maxTokens,
      background: useBackground,
      text: { format: { type: "json_object" } },
    }, signal ? { signal } : undefined);

    if (useBackground) {
      response = await waitForOpenAIBackgroundResponse(client, response.id, signal);
    }

    if (signal?.aborted) {
      throw new DOMException("AbortError", "AbortError");
    }

    if (response.status && response.status !== "completed") {
      throw new Error(`OpenAI response did not complete: ${response.status}`);
    }

    logAiComplete(reqId, startedAt, {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    });

    return response.output_text?.trim() || "";
  } catch (error) {
    logAiError(reqId, startedAt, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function callGeminiStructured(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8192,
  signal?: AbortSignal,
  modelId?: string,
): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException("AbortError", "AbortError");
  }

  const resolvedModel = modelId || MODELS.verification.gemini.modelId;
  const reqId = createRequestId();
  const startedAt = Date.now();
  logAiStart({ requestId: reqId, model: resolvedModel, provider: "google", action: "callGeminiStructured" });

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: resolvedModel,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
      },
    });

    if (signal?.aborted) {
      throw new DOMException("AbortError", "AbortError");
    }

    logAiComplete(reqId, startedAt);
    return response.text?.trim() || "";
  } catch (error) {
    logAiError(reqId, startedAt, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function callStructuredModel(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8192,
  signal?: AbortSignal,
  modelConfig?: HarnessModelConfig,
): Promise<string> {
  const resolvedConfig = modelConfig || { provider: "anthropic", model: MODELS.prd.modelId };
  const validationError = validateModelConfig(resolvedConfig);
  if (validationError) {
    throw new Error(validationError);
  }

  switch (resolvedConfig.provider) {
    case "anthropic":
      return callClaudeStructured(systemPrompt, userMessage, maxTokens, signal, resolvedConfig.model);
    case "openai":
      return callOpenAIStructured(systemPrompt, userMessage, maxTokens, signal, resolvedConfig.model);
    case "google":
      return callGeminiStructured(systemPrompt, userMessage, maxTokens, signal, resolvedConfig.model);
  }
}

async function waitForOpenAIBackgroundResponse(
  client: ReturnType<typeof getChatGPTClient>,
  responseId: string,
  signal?: AbortSignal,
) {
  const maxPolls = 45;
  for (let i = 0; i < maxPolls; i++) {
    if (signal?.aborted) {
      throw new DOMException("AbortError", "AbortError");
    }

    const response = await client.responses.retrieve(responseId, undefined, signal ? { signal } : undefined);
    if (response.status === "completed") {
      return response;
    }
    if (["failed", "cancelled", "incomplete"].includes(response.status || "")) {
      throw new Error(`OpenAI background response ${responseId} ended with status: ${response.status}`);
    }

    await sleep(2000, signal);
  }

  throw new Error(`OpenAI background response ${responseId} did not complete before timeout`);
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("AbortError", "AbortError"));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("AbortError", "AbortError"));
    }, { once: true });
  });
}

// ===== ChatGPT 스트리밍 =====
export async function streamChatGPT(
  systemPrompt: string,
  userMessage: string,
  modelId?: string,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const client = getChatGPTClient();
  const resolvedModel = modelId || MODELS.verification.chatgpt.modelId;

  const reqId = createRequestId();
  const startedAt = Date.now();
  logAiStart({ requestId: reqId, model: resolvedModel, provider: "openai", action: "streamChatGPT" });

  const stream = await client.chat.completions.create({
    model: resolvedModel,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        logAiComplete(reqId, startedAt);
        controller.close();
      } catch (error) {
        logAiError(reqId, startedAt, error instanceof Error ? error.message : String(error));
        controller.error(error);
      }
    },
  });
}

// ===== Gemini 스트리밍 =====
export async function streamGemini(
  systemPrompt: string,
  userMessage: string,
  modelId?: string,
  maxTokens?: number,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const client = getGeminiClient();
  const resolvedModel = modelId || MODELS.verification.gemini.modelId;

  const reqId = createRequestId();
  const startedAt = Date.now();
  logAiStart({ requestId: reqId, model: resolvedModel, provider: "google", action: "streamGemini" });

  const response = await client.models.generateContentStream({
    model: resolvedModel,
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: maxTokens,
    },
  });

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        logAiComplete(reqId, startedAt);
        controller.close();
      } catch (error) {
        logAiError(reqId, startedAt, error instanceof Error ? error.message : String(error));
        controller.error(error);
      }
    },
  });
}

// ===== 검증 AI 스트리밍 (provider에 따라 분기) =====
export async function streamVerification(
  provider: VerificationProvider,
  systemPrompt: string,
  userMessage: string,
): Promise<ReadableStream<Uint8Array>> {
  switch (provider) {
    case "chatgpt":
      return streamChatGPT(systemPrompt, userMessage);
    case "gemini":
      return streamGemini(systemPrompt, userMessage);
  }
}

// ===== 토론 엔진 스트리밍 (선택된 엔진에 따라 분기) =====
export async function streamDebateEngine(
  engineId: DebateEngineId,
  systemPrompt: string,
  userMessage: string,
): Promise<ReadableStream<Uint8Array>> {
  const engine = DEBATE_ENGINES.find((e) => e.id === engineId);
  const modelId = engine?.modelId || MODELS.debate.modelId;

  switch (engineId) {
    case "claude-sonnet":
      return streamClaudeModel(modelId, systemPrompt, userMessage, 4096);
    case "claude-opus":
      return streamClaudeModel(modelId, systemPrompt, userMessage, 8192);
    case "gpt":
      return streamChatGPT(systemPrompt, userMessage, modelId);
    case "gemini":
      return streamGemini(systemPrompt, userMessage, modelId);
    default:
      return streamClaude(systemPrompt, userMessage, false);
  }
}
