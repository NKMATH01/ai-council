import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY } from "./env";

let geminiClient: GoogleGenAI;
let claudeClient: Anthropic;
let chatgptClient: OpenAI;

export function getGeminiClient() {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return geminiClient;
}

export function getClaudeClient() {
  if (!claudeClient) {
    claudeClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return claudeClient;
}

export function getChatGPTClient() {
  if (!chatgptClient) {
    chatgptClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return chatgptClient;
}
