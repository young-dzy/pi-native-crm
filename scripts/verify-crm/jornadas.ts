/**
 * O que o passe ao vivo pode afirmar sobre cada feature file.
 * `workbench-run` é o único `control-crm drive`. Os outros quatro, num banco
 * fresco, ficam inalcançáveis com a precondição que o próprio arquivo já
 * escreve. Marcar esses quatro como passados enfraquece a jornada.
 */
export const H2_NA_ORDEM = [
  "Sub-features",
  "How to get to it (user POV)",
  "Driving it with control-crm",
  "Gotchas",
] as const;

export type Jornada =
  | { tipo: "drive"; comando: "workbench-run"; sentinela: string }
  | { tipo: "inalcancavel"; precondicao: string; rota: string; sentinela: string };

export const JORNADAS: Record<string, Jornada> = {
  "workbench-run": {
    tipo: "drive",
    comando: "workbench-run",
    sentinela: "control-crm drive workbench-run",
  },
  "proposal-approve-revoke": {
    tipo: "inalcancavel",
    precondicao: "fresh baseline has no lead; do not insert one through SQL",
    rota: "/app/ai/workbench lead scope",
    sentinela: "Do not insert one through SQL",
  },
  "mission-send-and-direction": {
    tipo: "inalcancavel",
    precondicao: "fresh install has no mission; stop with mission_missing",
    rota: "/app/ai/workbench and /app/kanban",
    sentinela: "mission_missing",
  },
  "expert-collaboration": {
    tipo: "inalcancavel",
    precondicao: "pass requires at least one specialist row; the model may not delegate",
    rota: "/app/ai/workbench CRM 主管 Agent",
    sentinela: "at least one specialist row",
  },
  "eval-judge": {
    tipo: "inalcancavel",
    precondicao: "Judge is an explicit click and spends quota; a failed Judge is not a pass",
    rota: "/app/ai/workbench 运行详情 and kanban 查看业务评测",
    sentinela: "运行语义 Judge（消耗模型额度）",
  },
};

export function notasDasJornadas(jornadas: Record<string, Jornada> = JORNADAS): string[] {
  const notas: string[] = [];
  for (const [id, jornada] of Object.entries(jornadas)) {
    if (jornada.tipo !== "inalcancavel") continue;
    notas.push(`${id}: verified-unreachable; ${jornada.precondicao}; route ${jornada.rota}`);
  }
  return notas;
}
