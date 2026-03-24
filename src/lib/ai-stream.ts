import { VerificationProvider, DebateEngineId } from "./types";
import { MODELS, DEBATE_ENGINES } from "./constants";
import {
  getGeminiClient,
  getClaudeClient,
  getChatGPTClient,
} from "./ai-clients";

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

        controller.close();
      } catch (error) {
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
        controller.close();
      } catch (error) {
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
  const client = getClaudeClient();
  const response = await client.messages.create({
    model: MODELS.debate.modelId,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

// ===== ChatGPT 스트리밍 =====
export async function streamChatGPT(
  systemPrompt: string,
  userMessage: string,
  modelId?: string,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const client = getChatGPTClient();

  const stream = await client.chat.completions.create({
    model: modelId || MODELS.verification.chatgpt.modelId,
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
        controller.close();
      } catch (error) {
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

  const response = await client.models.generateContentStream({
    model: modelId || MODELS.verification.gemini.modelId,
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
        controller.close();
      } catch (error) {
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
