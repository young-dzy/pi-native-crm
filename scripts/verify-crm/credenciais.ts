/**
 * Nomes de segredo do harness de verificação. O valor mora no ambiente ou
 * num secret do repositório. Este módulo não lê arquivo e não imprime valor.
 */
export const NOMES_DE_SEGREDO = [
  "OPENCODE_API_KEY",
  "OPENCODE_BASE_URL",
  "OPENCODE_MODEL",
] as const;

export type Ambiente = Record<string, string | undefined>;

export function segredosEmFalta(env: Ambiente): string[] {
  return NOMES_DE_SEGREDO.filter((nome) => (env[nome] ?? "").trim() === "");
}

/** A chave do drive. `OPENCODE_API_KEY` vazio cai para o nome antigo do harness. */
export function chaveDoModelo(env: Ambiente): string {
  const chave = (env.OPENCODE_API_KEY || env.VERIFY_CRM_MODEL_API_KEY || "").trim();
  if (chave.length < 8) throw new Error("OPENCODE_API_KEY is unset");
  return chave;
}

export function valorEhChaveDeModelo(valor: string, env: Ambiente): boolean {
  return [env.OPENCODE_API_KEY, env.VERIFY_CRM_MODEL_API_KEY].some(
    (chave) => typeof chave === "string" && chave.length > 0 && valor === chave,
  );
}
