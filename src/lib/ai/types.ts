/** AI layer types: task kinds, provider interface, orchestrator result. */

export type AiTask =
  | "TENDER_UNDERSTANDING"
  | "DOC_CLASSIFY"
  | "DOC_EXTRACT"
  | "CORRIGENDUM_DIFF"
  | "NL_SEARCH"
  | "ASSISTANT_QA"
  | "COPILOT_QA"
  | "RECOMMENDATION";

export interface CompleteOptions {
  task: AiTask;
  system?: string;
  prompt: string;
  /** ask provider for JSON output */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** base64 images for vision tasks (multimodal providers) */
  images?: { mime: string; dataBase64: string }[];
}

export interface CompleteResult {
  text: string;
  tokensUsed: number;
  model: string;
}

export interface AiProvider {
  name: "gemini" | "openai" | "local";
  configured(): boolean;
  complete(opts: CompleteOptions): Promise<CompleteResult>;
}

export interface AiMeta {
  provider: string;
  model: string;
  simulated: boolean;
  tokensUsed?: number;
  durationMs: number;
  runId?: string;
  fallbackReason?: string;
}

export interface AiOutcome<T> {
  data: T;
  meta: AiMeta;
}

export interface PlatformAiSettings {
  provider: "gemini" | "openai" | "local" | "auto";
  model?: string;
  visionModel?: string;
  embeddingModel?: string;
  temperature?: number;
  maxTokens?: number;
  visionEnabled: boolean;
  documentAnalysisEnabled: boolean;
}
