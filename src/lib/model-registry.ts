import type { AiProvider, HarnessModelConfig } from "./types";

export interface ModelMetadata {
  provider: AiProvider;
  label: string;
  description: string;
  supportsStreaming: boolean;
  supportsStructured: boolean;
  isPreview?: boolean;
  highEnd?: boolean;
  notes?: string;
}

export const MODEL_REGISTRY = {
  "claude-sonnet-4-6": {
    provider: "anthropic",
    label: "Claude Sonnet 4.6",
    description: "최신 Sonnet 균형 모델",
    supportsStreaming: true,
    supportsStructured: true,
  },
  "claude-opus-4-8": {
    provider: "anthropic",
    label: "Claude Opus 4.8",
    description: "Anthropic 최신 하이엔드 Opus 모델",
    supportsStreaming: true,
    supportsStructured: true,
    highEnd: true,
  },
  "gpt-5.5": {
    provider: "openai",
    label: "GPT-5.5",
    description: "OpenAI 최신 frontier 모델",
    supportsStreaming: true,
    supportsStructured: true,
    highEnd: true,
  },
  "gpt-5.5-pro": {
    provider: "openai",
    label: "GPT-5.5 Pro",
    description: "OpenAI 고품질 pro 모델",
    supportsStreaming: false,
    supportsStructured: true,
    highEnd: true,
    notes: "Responses API 비스트리밍/백그라운드 용도",
  },
  "gemini-3-pro-preview": {
    provider: "google",
    label: "Gemini 3 Pro Preview",
    description: "Google 최신 Gemini Pro preview 모델",
    supportsStreaming: true,
    supportsStructured: true,
    highEnd: true,
    isPreview: true,
  },
} as const satisfies Record<string, ModelMetadata>;

export type RegisteredModelId = keyof typeof MODEL_REGISTRY;

export const DEFAULT_DEBATE_MODEL: HarnessModelConfig = {
  provider: MODEL_REGISTRY["claude-sonnet-4-6"].provider,
  model: "claude-sonnet-4-6",
};

export const DEFAULT_PRD_MODEL: HarnessModelConfig = {
  provider: MODEL_REGISTRY["claude-opus-4-8"].provider,
  model: "claude-opus-4-8",
};

export const DEFAULT_HARNESS_GENERATION: HarnessModelConfig = DEFAULT_DEBATE_MODEL;
export const DEFAULT_HARNESS_EVALUATION: HarnessModelConfig = DEFAULT_PRD_MODEL;

export const DEFAULT_OPENAI_MODEL: HarnessModelConfig = {
  provider: MODEL_REGISTRY["gpt-5.5"].provider,
  model: "gpt-5.5",
};

export const DEFAULT_GEMINI_MODEL: HarnessModelConfig = {
  provider: MODEL_REGISTRY["gemini-3-pro-preview"].provider,
  model: "gemini-3-pro-preview",
};

export function getModelMetadata(modelId: string): ModelMetadata | undefined {
  return MODEL_REGISTRY[modelId as RegisteredModelId];
}

export function getModelLabel(modelId: string): string {
  return getModelMetadata(modelId)?.label || modelId;
}

export function validateModelConfig(config: HarnessModelConfig): string | null {
  const metadata = getModelMetadata(config.model);
  if (!metadata) {
    return `지원하지 않는 모델입니다: ${config.model}`;
  }
  if (metadata.provider !== config.provider) {
    return `${config.model}은 ${metadata.provider} provider 모델입니다. 요청 provider: ${config.provider}`;
  }
  if (!metadata.supportsStructured) {
    return `${config.model}은 structured JSON 호출을 지원하지 않습니다.`;
  }
  return null;
}
