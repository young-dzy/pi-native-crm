/**
 * Qual linha `opencode` o seed local de E2E grava em `ai_models`.
 *
 * O default continua `space-bunny-free`: é o modelo que o CI e as provas já
 * gravadas usam. Uma verificação que precisa de outro id (por exemplo
 * `cat-jam-free`) passa `OPENCODE_E2E_MODEL_ID` — o mesmo script, sem um
 * atalho na rota do workbench. A rota segue exigindo `supports_tools` na
 * linha que este seed grava.
 */

const MODELO_PADRAO = "space-bunny-free";
const NOME_PADRAO = "Space Bunny Free (OpenCode Zen)";

/** Token de catálogo: o `model_id` entra num filtro, não numa URL livre. */
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export interface ModeloDoCatalogoE2e {
  modelId: string;
  displayName: string;
}

export function modeloDoCatalogoE2e(
  env: Record<string, string | undefined> = process.env,
): ModeloDoCatalogoE2e {
  const pedido = (env.OPENCODE_E2E_MODEL_ID ?? "").trim();
  const modelId = pedido === "" ? MODELO_PADRAO : pedido;
  if (!TOKEN.test(modelId)) {
    throw new Error(
      "OPENCODE_E2E_MODEL_ID must be a catalog token (letters, digits, ., _, :, -)",
    );
  }
  const nomePedido = (env.OPENCODE_E2E_DISPLAY_NAME ?? "").trim();
  const displayName =
    nomePedido !== "" ? nomePedido : modelId === MODELO_PADRAO ? NOME_PADRAO : modelId;
  if (displayName.length > 200) {
    throw new Error("OPENCODE_E2E_DISPLAY_NAME is longer than 200 characters");
  }
  return { modelId, displayName };
}
