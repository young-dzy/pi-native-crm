import { describe, expect, it } from "vitest";

import { modeloDoCatalogoE2e } from "./modelo-catalogo-e2e";

describe("modeloDoCatalogoE2e", () => {
  it("sem variável continua space-bunny-free, o default do CI", () => {
    expect(modeloDoCatalogoE2e({})).toEqual({
      modelId: "space-bunny-free",
      displayName: "Space Bunny Free (OpenCode Zen)",
    });
  });

  it("OPENCODE_E2E_MODEL_ID troca só esta execução", () => {
    expect(
      modeloDoCatalogoE2e({
        OPENCODE_E2E_MODEL_ID: "cat-jam-free",
        OPENCODE_E2E_DISPLAY_NAME: "Cat Jam Free (OpenCode Go)",
      }),
    ).toEqual({
      modelId: "cat-jam-free",
      displayName: "Cat Jam Free (OpenCode Go)",
    });
  });

  it("sem nome de exibição, o id pedido vira o rótulo", () => {
    expect(modeloDoCatalogoE2e({ OPENCODE_E2E_MODEL_ID: "cat-jam-free" })).toEqual({
      modelId: "cat-jam-free",
      displayName: "cat-jam-free",
    });
  });

  it("recusa id com espaço ou barra", () => {
    expect(() => modeloDoCatalogoE2e({ OPENCODE_E2E_MODEL_ID: "cat jam" })).toThrow(/catalog token/);
    expect(() => modeloDoCatalogoE2e({ OPENCODE_E2E_MODEL_ID: "../x" })).toThrow(/catalog token/);
  });
});
