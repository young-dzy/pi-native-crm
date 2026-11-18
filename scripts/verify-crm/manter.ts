import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { H2_NA_ORDEM, JORNADAS, type Jornada } from "./jornadas";
import type { ObservacaoGravada } from "./observar";

export const PREFIXOS_DO_HARNESS = [
  ".cursor/skills/verify-crm/",
  ".cursor/skills/maintain-verify-crm/",
] as const;

export type Desfecho = "clean" | "changed" | "blocked";

export type Classe = "doc_drift" | "harness_gap" | "product_gap" | "live_pass_missing" | null;

export interface PassoAoVivo {
  id: string;
  estado: "passou" | "falhou" | "inalcancavel";
  detalhe?: string;
  precondicao?: string;
  rota?: string;
  screenshot?: string;
}

/** Exit 2 do drive, com a timeline visível, é nota — não falha de harness. */
export const NOTA_DOCTOR_DEPOIS_DA_TELA = "doctor exited 2 after the timeline was visible";

export function doctorDepoisDaTimeline(
  driveExit: number | null,
  result: ResultadoDaTela | null,
): boolean {
  return driveExit === 2 && result?.started === true && result.blocked === false;
}

export interface FecharEntrada {
  problemasHigiene: string[];
  caminhosAlterados: string[];
  /** `null` significa que o passe ao vivo não rodou. Isso nunca é `clean`. */
  aoVivo: PassoAoVivo[] | null;
}

export interface FecharSaida {
  desfecho: Desfecho;
  classe: Classe;
  motivos: string[];
}

export interface ResultadoDaTela {
  started: boolean;
  blocked: boolean;
}

export function foraDoHarness(caminhos: string[]): string[] {
  return caminhos.filter((caminho) => {
    const normal = caminho.replaceAll("\\", "/");
    return !PREFIXOS_DO_HARNESS.some((prefixo) => normal.startsWith(prefixo));
  });
}

export function montarAoVivo(input: {
  driveExit: number | null;
  result: ResultadoDaTela | null;
  jornadas?: Record<string, Jornada>;
  observacoes?: ObservacaoGravada[];
}): PassoAoVivo[] {
  const jornadas = input.jornadas ?? JORNADAS;
  const observacoes = input.observacoes ?? [];
  const passos: PassoAoVivo[] = [];
  for (const [id, jornada] of Object.entries(jornadas)) {
    if (jornada.tipo === "inalcancavel") {
      const obs = observacoes.find((item) => item.id === id);
      if (!obs) {
        passos.push({ id, estado: "falhou", detalhe: "screen was not opened" });
        continue;
      }
      passos.push({
        id,
        estado: "inalcancavel",
        precondicao: obs.precondicaoObservada,
        rota: obs.url,
        screenshot: obs.screenshot,
      });
      continue;
    }
    const nota = doctorDepoisDaTimeline(input.driveExit, input.result);
    const passou =
      nota ||
      (input.driveExit === 0 && input.result?.started === true && input.result.blocked === false);
    if (passou) {
      passos.push({
        id,
        estado: "passou",
        ...(nota ? { detalhe: NOTA_DOCTOR_DEPOIS_DA_TELA } : {}),
      });
      continue;
    }
    const detalhe = input.result?.blocked
      ? "workbench result blocked"
      : input.result === null
        ? "result.json missing"
        : `drive exit ${input.driveExit ?? "missing"}`;
    passos.push({ id, estado: "falhou", detalhe });
  }
  return passos;
}

function classeDoDiff(caminhos: string[]): Classe {
  const mexeNoHarness = caminhos.some((caminho) => {
    const normal = caminho.replaceAll("\\", "/");
    return normal.includes("/scripts/") || normal.endsWith(".ts") || normal.endsWith(".sh");
  });
  return mexeNoHarness ? "harness_gap" : "doc_drift";
}

function pior(atual: Classe, nova: Exclude<Classe, null>): Classe {
  const peso: Record<Exclude<Classe, null>, number> = {
    doc_drift: 1,
    live_pass_missing: 2,
    harness_gap: 3,
    product_gap: 4,
  };
  if (atual === null || peso[nova] > peso[atual]) return nova;
  return atual;
}

export function fechar(
  entrada: FecharEntrada,
  jornadas: Record<string, Jornada> = JORNADAS,
): FecharSaida {
  const fora = foraDoHarness(entrada.caminhosAlterados);
  if (fora.length > 0) {
    return {
      desfecho: "blocked",
      classe: "product_gap",
      motivos: [`diff outside the harness: ${fora.join(", ")}`],
    };
  }

  if (entrada.aoVivo === null) {
    return {
      desfecho: "blocked",
      classe: "live_pass_missing",
      motivos: ["no live pass. A check without a live pass is not clean."],
    };
  }

  const porId = new Map(entrada.aoVivo.map((passo) => [passo.id, passo]));
  const motivos: string[] = [];
  let classe: Classe = null;

  for (const [id, jornada] of Object.entries(jornadas)) {
    const passo = porId.get(id);
    if (!passo) {
      classe = pior(classe, "harness_gap");
      motivos.push(`${id}: missing from the live pass`);
      continue;
    }
    if (jornada.tipo === "drive") {
      if (passo.estado !== "passou") {
        const produto = (passo.detalhe ?? "").includes("blocked");
        classe = pior(classe, produto ? "product_gap" : "harness_gap");
        motivos.push(`${id}: live fail (${passo.detalhe ?? passo.estado})`);
      }
      continue;
    }
    if (passo.estado !== "inalcancavel") {
      classe = pior(classe, "harness_gap");
      motivos.push(`${id}: ${passo.detalhe ?? passo.estado}`);
      continue;
    }
    if (passo.precondicao === jornada.precondicao && passo.rota === jornada.rota) {
      classe = pior(classe, "harness_gap");
      motivos.push(`${id}: verbatim copy of the journey table is not an observation`);
      continue;
    }
    const url = passo.rota ?? "";
    if (
      !passo.precondicao?.trim() ||
      !passo.screenshot ||
      !fs.existsSync(passo.screenshot) ||
      (!url.startsWith("http://") && !url.startsWith("https://"))
    ) {
      classe = pior(classe, "harness_gap");
      motivos.push(`${id}: observation missing screenshot or unmet precondition`);
    }
  }

  for (const passo of entrada.aoVivo) {
    if (passo.id in jornadas) continue;
    classe = pior(classe, "harness_gap");
    motivos.push(`${passo.id}: not in the journey table`);
  }

  if (classe !== null) {
    return { desfecho: "blocked", classe, motivos };
  }

  if (entrada.problemasHigiene.length > 0) {
    if (entrada.caminhosAlterados.length === 0) {
      return { desfecho: "blocked", classe: "doc_drift", motivos: entrada.problemasHigiene };
    }
    return {
      desfecho: "changed",
      classe: classeDoDiff(entrada.caminhosAlterados),
      motivos: entrada.problemasHigiene,
    };
  }

  if (entrada.caminhosAlterados.length === 0) {
    return {
      desfecho: "clean",
      classe: null,
      motivos: ["index clean, live pass recorded, no diff"],
    };
  }

  return {
    desfecho: "changed",
    classe: classeDoDiff(entrada.caminhosAlterados),
    motivos: ["harness-only diff after a live pass"],
  };
}

function h2DoArquivo(texto: string): string[] {
  return texto
    .split("\n")
    .filter((linha) => linha.startsWith("## "))
    .map((linha) => linha.slice(3).trim());
}

function citados(texto: string): string[] {
  const achados: string[] = [];
  for (const match of texto.matchAll(/`([^`\n]+\.(?:ts|tsx|sql|md))`/g)) {
    const caminho = match[1]?.trim() ?? "";
    if (!caminho || caminho.includes(" ") || caminho.includes("://")) continue;
    achados.push(caminho);
  }
  return achados;
}

function basenamesDoGit(root: string): Set<string> {
  const saida = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
  const nomes = new Set<string>();
  for (const linha of saida.split("\n")) {
    if (!linha) continue;
    nomes.add(path.basename(linha));
  }
  return nomes;
}

export function higiene(root: string, jornadas: Record<string, Jornada> = JORNADAS): string[] {
  const dir = path.join(root, ".cursor/skills/verify-crm/features");
  const problemas: string[] = [];
  if (!fs.existsSync(dir)) {
    return ["index: features directory is missing"];
  }

  const arquivos = fs
    .readdirSync(dir)
    .filter((nome) => nome.endsWith(".md") && nome !== "README.md")
    .sort();
  const readme = fs.readFileSync(path.join(dir, "README.md"), "utf8");
  const links = [...readme.matchAll(/\]\(\.\/([a-z0-9-]+\.md)\)/g)].map((match) => match[1] ?? "");
  const esperados = new Set(Object.keys(jornadas));

  for (const arquivo of arquivos) {
    const id = arquivo.replace(/\.md$/, "");
    if (!links.includes(arquivo)) problemas.push(`index: ${arquivo} is not linked from README.md`);
    if (!esperados.has(id)) problemas.push(`index: ${id} has no journey-table entry`);
    const texto = fs.readFileSync(path.join(dir, arquivo), "utf8");
    const h2 = h2DoArquivo(texto);
    if (h2.length !== H2_NA_ORDEM.length || H2_NA_ORDEM.some((titulo, i) => h2[i] !== titulo)) {
      problemas.push(`index: ${arquivo} H2s are ${h2.join(" | ")}`);
    }
    const jornada = jornadas[id];
    if (jornada && !texto.includes(jornada.sentinela)) {
      problemas.push(`index: ${arquivo} no longer contains its prerequisite sentinel`);
    }
  }

  for (const link of links) {
    if (!arquivos.includes(link))
      problemas.push(`index: README links ${link}, which is not a feature file`);
  }
  for (const id of esperados) {
    if (!arquivos.includes(`${id}.md`)) problemas.push(`index: journey ${id} has no feature file`);
  }

  const nomes = basenamesDoGit(root);
  const textos = [
    readme,
    ...arquivos.map((arquivo) => fs.readFileSync(path.join(dir, arquivo), "utf8")),
  ];
  for (const citado of textos.flatMap(citados)) {
    if (citado.includes("/")) {
      if (!fs.existsSync(path.join(root, citado)))
        problemas.push(`index: cited path missing ${citado}`);
      continue;
    }
    if (!nomes.has(citado)) problemas.push(`index: cited file missing ${citado}`);
  }

  return problemas;
}

export function diretorioDasObservacoes(resultado: string | null): string | null {
  if (!resultado) return null;
  return path.join(path.dirname(path.dirname(resultado)), "unreachable");
}

export function lerObservacoes(dir: string | null): ObservacaoGravada[] {
  if (!dir || !fs.existsSync(dir)) return [];
  const saida: ObservacaoGravada[] = [];
  for (const nome of fs.readdirSync(dir)) {
    if (!nome.endsWith(".json")) continue;
    const valor: unknown = JSON.parse(fs.readFileSync(path.join(dir, nome), "utf8"));
    if (!valor || typeof valor !== "object") continue;
    const rec = valor as Record<string, unknown>;
    if (
      typeof rec.id !== "string" ||
      typeof rec.url !== "string" ||
      typeof rec.screenshot !== "string" ||
      typeof rec.precondicaoObservada !== "string"
    ) {
      continue;
    }
    saida.push({
      id: rec.id,
      url: rec.url,
      screenshot: rec.screenshot,
      precondicaoObservada: rec.precondicaoObservada,
    });
  }
  return saida;
}

export function lerResultado(arquivo: string | null): ResultadoDaTela | null {
  if (!arquivo || !fs.existsSync(arquivo)) return null;
  const valor: unknown = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  if (!valor || typeof valor !== "object") return null;
  const rec = valor as Record<string, unknown>;
  if (typeof rec.started !== "boolean" || typeof rec.blocked !== "boolean") return null;
  return { started: rec.started, blocked: rec.blocked };
}

export function caminhosDoGit(root: string): string[] {
  const saida = execFileSync("git", ["status", "--porcelain", "-uall"], {
    cwd: root,
    encoding: "utf8",
  });
  const caminhos: string[] = [];
  for (const linha of saida.split("\n")) {
    if (linha.length < 4) continue;
    const resto = linha.slice(3);
    const partes = resto.split(" -> ");
    const caminho = (partes[partes.length - 1] ?? "").trim();
    if (caminho) caminhos.push(caminho);
  }
  return caminhos;
}

export function acharResultado(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicito = env.VERIFY_RESULT_JSON;
  if (explicito && fs.existsSync(explicito)) return explicito;
  const evidencia = env.VERIFY_CRM_EVIDENCE_ROOT ?? "/tmp/verify-crm-evidence";
  const estado = env.VERIFY_CRM_STATE_ROOT ?? "/tmp/verify-crm";
  if (!fs.existsSync(estado)) return null;
  const runs = fs
    .readdirSync(estado)
    .filter((nome) => fs.existsSync(path.join(estado, nome, "instance.json")))
    .sort();
  const runId = runs[runs.length - 1];
  if (!runId) return null;
  const candidato = path.join(evidencia, runId, "workbench-run", "result.json");
  return fs.existsSync(candidato) ? candidato : null;
}
