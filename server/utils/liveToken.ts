// A one-use Gemini Live token with the session's instructions and tools locked in. Audio goes from
// the browser straight to Gemini, never through this server. Shared by the coach and Talk by voice.
export async function mintLiveToken(config: ReturnType<typeof liveConfig>, what: string) {
  const model = useRuntimeConfig().liveModel;
  const now = Date.now();
  const expiresAt = new Date(now + LIVE_SECONDS * 1000).toISOString();
  let token: { name?: string };
  try {
    token = await gemini().authTokens.create({
      config: {
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        liveConnectConstraints: { model, config: config as never },
        abortSignal: AbortSignal.timeout(15_000),
      },
    });
  } catch (e) {
    throw providerError(e, what);
  }
  if (!token.name?.startsWith("auth_tokens/")) throw createError({ statusCode: 503, statusMessage: `${what}.` });

  // The raw WebSocket setup message nests some fields differently from the SDK's flat config.
  const { responseModalities, maxOutputTokens, speechConfig, systemInstruction, ...rest } = config;
  return {
    token: token.name,
    expiresAt,
    setup: {
      model: `models/${model}`,
      ...rest,
      generationConfig: { responseModalities, maxOutputTokens, speechConfig },
      systemInstruction: { parts: [{ text: systemInstruction }] },
    },
  };
}
