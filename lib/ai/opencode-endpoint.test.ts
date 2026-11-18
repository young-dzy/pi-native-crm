import { afterEach, describe, expect, it } from "vitest";

import {
  OPENCODE_ZEN_ENDPOINT,
  SESSAO_OPENCODE_PADRAO,
  baseOpenCodeConfigurada,
  cabecalhosOpenCode,
  endpointOpenCode,
  sessaoOpenCode,
} from "@/lib/ai/opencode-endpoint";

describe("endpoint OpenCode", () => {
  afterEach(() => {
    delete process.env.OPENCODE_BASE_URL;
    delete process.env.OPENCODE_SESSION;
  });

  it("vazio e ausente continuam no Zen", () => {
    expect(endpointOpenCode(undefined)).toBe(OPENCODE_ZEN_ENDPOINT);
    expect(endpointOpenCode("")).toBe(OPENCODE_ZEN_ENDPOINT);
    expect(endpointOpenCode("   ")).toBe(OPENCODE_ZEN_ENDPOINT);
    expect(baseOpenCodeConfigurada("")).toBeUndefined();
  });

  it("aponta para o Go e tira a barra final", () => {
    expect(endpointOpenCode("https://opencode.ai/zen/go/v1/")).toBe(
      "https://opencode.ai/zen/go/v1",
    );
  });

  it("manda x-opencode-session, e sessão vazia cai no padrão", () => {
    expect(sessaoOpenCode(undefined)).toBe(SESSAO_OPENCODE_PADRAO);
    expect(sessaoOpenCode("")).toBe(SESSAO_OPENCODE_PADRAO);
    expect(cabecalhosOpenCode("verify-crm")).toEqual({ "x-opencode-session": "verify-crm" });
    expect(cabecalhosOpenCode("")).toEqual({ "x-opencode-session": "crm" });
  });
});
