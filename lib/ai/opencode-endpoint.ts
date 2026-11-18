/**
 * Endereço e sessão do OpenCode, lidos da instalação.
 *
 * O endereço canônico continua `https://opencode.ai/zen/v1`. `OPENCODE_BASE_URL`
 * vazia — o estado de quem copia o `.env.example` — fica nesse canônico. A
 * barra final é removida antes da junção, senão `.../v1/` vira `.../v1//models`.
 *
 * O endpoint Go (`https://opencode.ai/zen/go/v1`) recusa a geração sem o header
 * `x-opencode-session` (400 MissingSessionID, medido). Com o header e a sessão
 * `crm`, o mesmo catálogo e um `chat/completions` de `cat-jam-free` respondem
 * 200, inclusive com o user-agent padrão do Node. O catálogo Zen também
 * continua 200 com esse header. Por isso a sessão vai em toda chamada, e o
 * valor vazio cai em `crm` com `||` — `??` deixaria a string vazia do exemplo
 * passar e o Go responderia 400.
 */
export const OPENCODE_ZEN_ENDPOINT = "https://opencode.ai/zen/v1";

export const SESSAO_OPENCODE_PADRAO = "crm";

/** Base explícita da instalação, ou `undefined` quando ela não apontou uma. */
export function baseOpenCodeConfigurada(valor: string | null | undefined): string | undefined {
  const limpa = (valor ?? "").trim().replace(/\/+$/, "");
  return limpa || undefined;
}

/** Base da instalação, ou o canônico Zen quando a variável está ausente ou vazia. */
export function endpointOpenCode(valor: string | null | undefined): string {
  return baseOpenCodeConfigurada(valor) ?? OPENCODE_ZEN_ENDPOINT;
}

export function sessaoOpenCode(valor: string | null | undefined): string {
  const limpa = (valor ?? "").trim();
  return limpa || SESSAO_OPENCODE_PADRAO;
}

export function cabecalhosOpenCode(valor: string | null | undefined): Record<string, string> {
  return { "x-opencode-session": sessaoOpenCode(valor) };
}
