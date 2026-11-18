/**
 * O que uma tela inalcançável observada devolve. A frase sai do texto da
 * página. Não é a precondição copiada de jornadas.ts.
 */
export const TELAS_PARA_ABRIR = [
  { id: "proposal-approve-revoke", caminho: "/app/ai/workbench" },
  { id: "mission-send-and-direction", caminho: "/app/kanban" },
  { id: "expert-collaboration", caminho: "/app/ai/workbench" },
  { id: "eval-judge", caminho: "/app/kanban" },
] as const;

export interface ObservacaoGravada {
  id: string;
  url: string;
  screenshot: string;
  precondicaoObservada: string;
}

export function precondicaoObservada(url: string, texto: string): string {
  const trecho = texto.replace(/\s+/g, " ").trim().slice(0, 160);
  return `seen at ${url}: ${trecho || "empty body"}`;
}
