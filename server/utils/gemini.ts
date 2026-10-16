import { GoogleGenAI } from "@google/genai";
import type { Settings } from "#shared/settings";

export const LIVE_SECONDS = 900;

export function gemini() {
  const apiKey = useRuntimeConfig().geminiApiKey;
  if (!apiKey) throw createError({ statusCode: 503, statusMessage: "The AI service is not configured." });
  return new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1beta" } });
}

/** Turns a provider failure into a short, readable error. */
export function providerError(e: any, what: string) {
  if (e?.statusCode) return e;
  console.error(what, e);
  const reason = String(e?.message ?? "unknown error").replace(/\s+/g, " ").slice(0, 160);
  return createError({ statusCode: 502, statusMessage: `${what}: ${reason}` });
}

const endSensitivity = { default: undefined, low: "END_SENSITIVITY_LOW", high: "END_SENSITIVITY_HIGH" } as const;

/** Live session config: voice, turn-taking, the coach's instructions and tools. */
export function liveConfig(s: Settings, systemInstruction: string, tools: unknown) {
  const automaticActivityDetection =
    s.turn.kind === "app"
      ? { disabled: true }
      : {
          silenceDurationMs: s.turn.silenceMs,
          prefixPaddingMs: 100,
          ...(endSensitivity[s.turn.endSensitivity] ? { endOfSpeechSensitivity: endSensitivity[s.turn.endSensitivity] } : {}),
        };
  return {
    responseModalities: ["AUDIO"],
    maxOutputTokens: 1024,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    contextWindowCompression: { slidingWindow: {} },
    realtimeInputConfig: {
      automaticActivityDetection,
      activityHandling: s.bargeIn ? "START_OF_ACTIVITY_INTERRUPTS" : "NO_INTERRUPTION",
    },
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } } },
    systemInstruction,
    tools,
  };
}
