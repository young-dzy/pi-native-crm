import { afterEach, describe, expect, it, vi } from "vitest";

import { invokePiProvider } from "@/tests/agent-runtime/fixtures/pi-http";

import { resolvePiModel } from "./model-adapter";

describe("Pi model adapter", () => {
  it.each([
    ["anthropic", "anthropic-messages", "https://api.anthropic.com"],
    ["openai", "openai-responses", "https://api.openai.com/v1"],
    ["google", "google-generative-ai", "https://generativelanguage.googleapis.com/v1beta"],
    ["openrouter", "openai-completions", "https://openrouter.ai/api/v1"],
    ["opencode", "openai-completions", "https://opencode.ai/zen/v1"],
    ["deepseek", "openai-completions", "https://api.deepseek.com"],
  ] as const)(
    "binds %s through Pi with its canonical API and endpoint",
    async (provider, api, baseUrl) => {
      delete process.env.OPENCODE_BASE_URL;
      delete process.env.OPENCODE_SESSION;
      const resolved = await resolvePiModel({
        provider,
        model: "crm-test-model",
        apiKey: "test-key",
      });

      expect(resolved.model).toMatchObject({
        id: "crm-test-model",
        provider,
        api,
        baseUrl,
      });
      expect(resolved.streamFn).toEqual(expect.any(Function));
    },
  );

  it("honors tenant-selected endpoint and request controls in the Pi binding", async () => {
    const resolved = await resolvePiModel({
      provider: "openrouter",
      model: "tenant/model",
      apiKey: "tenant-key",
      baseUrl: "https://gateway.example.test/v1",
      headers: { "X-Tenant": "org-a" },
      maxOutputTokens: 321,
      temperature: 0.2,
      topP: 0.8,
    });

    expect(resolved.model).toMatchObject({
      id: "tenant/model",
      baseUrl: "https://gateway.example.test/v1",
    });
    expect(resolved.streamFn).toEqual(expect.any(Function));
  });

  it("rejects unsupported providers before any provider request", async () => {
    await expect(
      resolvePiModel({ provider: "unsupported", model: "m", apiKey: "k" }),
    ).rejects.toThrow("Pi provider not supported by the CRM adapter");
  });

  it("OpenCode segue OPENCODE_BASE_URL e manda x-opencode-session", async () => {
    process.env.OPENCODE_BASE_URL = "https://opencode.ai/zen/go/v1/";
    process.env.OPENCODE_SESSION = "verify-crm";
    const seen: Array<{ url: string; session: string | null }> = [];
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      const headers = new Headers(
        init?.headers ??
          (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined),
      );
      seen.push({ url, session: headers.get("x-opencode-session") });
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    try {
      const resolved = await resolvePiModel({
        provider: "opencode",
        model: "cat-jam-free",
        apiKey: "test-key",
      });
      expect(resolved.model.baseUrl).toBe("https://opencode.ai/zen/go/v1");
      await invokePiProvider({
        provider: "opencode",
        model: "cat-jam-free",
        apiKey: "test-key",
      });
      expect(
        seen.some(
          (call) =>
            call.url.startsWith("https://opencode.ai/zen/go/v1/") && call.session === "verify-crm",
        ),
      ).toBe(true);
    } finally {
      globalThis.fetch = fetchOriginal;
      delete process.env.OPENCODE_BASE_URL;
      delete process.env.OPENCODE_SESSION;
    }
  });

  it("OpenCode sem a variável continua no Zen e ainda manda a sessão padrão", async () => {
    delete process.env.OPENCODE_BASE_URL;
    delete process.env.OPENCODE_SESSION;
    const seen: Array<{ url: string; session: string | null }> = [];
    vi.stubGlobal("fetch", (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      const headers = new Headers(
        init?.headers ??
          (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined),
      );
      seen.push({ url, session: headers.get("x-opencode-session") });
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch);

    try {
      const resolved = await resolvePiModel({
        provider: "opencode",
        model: "crm-test-model",
        apiKey: "test-key",
      });
      expect(resolved.model.baseUrl).toBe("https://opencode.ai/zen/v1");
      await invokePiProvider({
        provider: "opencode",
        model: "crm-test-model",
        apiKey: "test-key",
      });
      expect(
        seen.some(
          (call) => call.url.startsWith("https://opencode.ai/zen/v1/") && call.session === "crm",
        ),
      ).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
