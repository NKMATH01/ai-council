import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

let geminiClient: GoogleGenAI;
let claudeClient: Anthropic;
let chatgptClient: OpenAI;

export function getGeminiClient() {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return geminiClient;
}

export function getClaudeClient() {
  if (!claudeClient) {
    claudeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return claudeClient;
}

export function getChatGPTClient() {
  if (!chatgptClient) {
    chatgptClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return chatgptClient;
}
