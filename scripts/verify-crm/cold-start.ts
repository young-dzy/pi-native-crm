/**
 * Primeiro comando de um agente que só tem o repositório e o HANDOFF.
 * Não sobe Supabase, não imprime valor de segredo e não escreve decisions.tsv.
 *
 *   pnpm exec tsx scripts/verify-crm/cold-start.ts
 *
 * Exit 0 imprime `next: … launch` (uma tentativa). Exit 2 imprime
 * `stop: do not launch`.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { NOMES_DE_SEGREDO, segredosEmFalta, type Ambiente } from "./credenciais";

export const PORTA_PADRAO = 3011;
export const CAMINHO_LOG_HERDADO =
  "/opt/cursor/artifacts/verify-crm/blocked-launch/verify-crm-launch.log";
export const LINHA_PARAR = "stop: do not launch";
export const LINHA_SEGUIR = "next: .cursor/skills/verify-crm/scripts/control-crm launch";

const WORKFLOWS = [
  ".github/workflows/verify-crm-maintain.yml",
  ".github/workflows/verify-crm-verifier.yml",
] as const;

export type LogHerdado = "ausente" | "bloqueio" | "outro";
export type SegredosGithub = "presentes" | "faltam" | "sem_permissao" | "gh_ausente" | "falhou";

export function portaOcupada(
  saidaSs: string | null,
  porta: number,
): "livre" | "ocupada" | "desconhecida" {
  if (saidaSs === null) return "desconhecida";
  const ocupada = saidaSs.split("\n").some((linha) => {
    const addr = linha.trim().split(/\s+/)[3] ?? "";
    return new RegExp(`[:.]${porta}$`).test(addr);
  });
  return ocupada ? "ocupada" : "livre";
}

export function classificarLogHerdado(texto: string | null): LogHerdado {
  if (texto === null) return "ausente";
  if (texto.includes("LegacyDbSetupError") || texto.includes("timeout expired")) return "bloqueio";
  return "outro";
}

export function classificarSegredosGithub(
  codigo: number | null,
  saida: string,
): { estado: SegredosGithub; faltam: string[] } {
  if (codigo === null) return { estado: "gh_ausente", faltam: [] };
  if (/403|404|not accessible|authentication required|HTTP 401/i.test(saida)) {
    return { estado: "sem_permissao", faltam: [] };
  }
  if (codigo !== 0) return { estado: "falhou", faltam: [] };
  const nomes = new Set(
    saida
      .split("\n")
      .map((linha) => linha.split(/\s+/)[0] ?? "")
      .filter((nome) => nome.length > 0 && !nome.startsWith("Name")),
  );
  const faltam = NOMES_DE_SEGREDO.filter((nome) => !nomes.has(nome));
  if (faltam.length > 0) return { estado: "faltam", faltam: [...faltam] };
  return { estado: "presentes", faltam: [] };
}

export function migrationsCombinam(entrada: {
  porcelain: string;
  sqlDisco: number;
  sqlGit: number;
  aninhado: boolean;
}): boolean {
  return (
    entrada.porcelain.trim() === "" &&
    entrada.sqlDisco > 0 &&
    entrada.sqlDisco === entrada.sqlGit &&
    !entrada.aninhado
  );
}

export function relatorioFrio(entrada: {
  segredosFaltando: readonly string[];
  porta: "livre" | "ocupada" | "desconhecida";
  migrationsOk: boolean;
  sqlDisco: number;
  sqlGit: number;
  workflows: "present" | "absent";
  fetch: "ok" | "failed";
  log: LogHerdado;
  github: { estado: SegredosGithub; faltam: readonly string[] };
  branch: string;
  sonda: "ss" | "devtcp";
}): { linhas: string[]; codigo: 0 | 2 } {
  const linhas: string[] = [];
  const parar: string[] = [];

  linhas.push(`branch: ${entrada.branch}`);
  linhas.push(
    "handbook: uploads/poteto_methodology.md is not in git. Use the links in .cursor/skills/verify-crm/PIPELINE_PROMPT.md.",
  );

  if (entrada.segredosFaltando.length > 0) {
    linhas.push(`secrets: blocked: missing ${entrada.segredosFaltando.join(", ")}`);
    parar.push("secrets");
  } else {
    linhas.push("secrets: present");
  }
  linhas.push("secrets command: pnpm exec tsx scripts/verify-crm/maintain.ts --exigir-segredos");
  linhas.push(
    'secrets expected: stdout "secrets present" exit 0, or stderr "blocked: missing NAME" exit 2',
  );

  if (entrada.porta === "ocupada") {
    linhas.push(`port ${PORTA_PADRAO}: in use — do not GET http://127.0.0.1:${PORTA_PADRAO}/login`);
    parar.push("port");
  } else if (entrada.porta === "desconhecida") {
    linhas.push(`port ${PORTA_PADRAO}: ss unavailable — do not assume it is free`);
    parar.push("port");
  } else {
    const via = entrada.sonda === "devtcp" ? " (ss missing; /dev/tcp)" : "";
    linhas.push(`port ${PORTA_PADRAO}: free${via}`);
  }

  if (entrada.migrationsOk) {
    linhas.push(`migrations: match git (disk=${entrada.sqlDisco} git=${entrada.sqlGit})`);
  } else {
    linhas.push(
      `migrations: dirty (disk=${entrada.sqlDisco} git=${entrada.sqlGit}) — restore supabase/migrations and leave supabase/config.toml unchanged`,
    );
    parar.push("migrations");
  }

  linhas.push(`git fetch origin main: ${entrada.fetch}`);
  linhas.push(`workflows on origin/main: ${entrada.workflows}`);

  if (entrada.log === "ausente") {
    linhas.push("inherited log: missing — decisions.tsv evidence is unaudited");
  } else if (entrada.log === "bloqueio") {
    linhas.push(`inherited log: LegacyDbSetupError at ${CAMINHO_LOG_HERDADO}`);
    parar.push("log");
  } else {
    linhas.push(
      `inherited log: present without LegacyDbSetupError at ${CAMINHO_LOG_HERDADO} — still this machine`,
    );
    parar.push("log");
  }

  if (entrada.github.estado === "presentes") linhas.push("github secrets: present");
  else if (entrada.github.estado === "faltam") {
    linhas.push(`github secrets: missing ${entrada.github.faltam.join(", ")}`);
  } else if (entrada.github.estado === "gh_ausente")
    linhas.push("github secrets: gh is not on PATH");
  else if (entrada.github.estado === "falhou") linhas.push("github secrets: list failed");
  else {
    linhas.push(
      "github secrets: permission denied — a human adds OPENCODE_API_KEY, OPENCODE_BASE_URL, and OPENCODE_MODEL on helsome/AiNativeCrm",
    );
  }

  linhas.push(
    "host networking: no flag on control-crm or supabase start. Do not pass --network host. Do not edit supabase/config.toml.",
  );
  linhas.push(
    "remote postgres: scripts/gerar-env-e2e.sh exits 1 and prints RECUSADO unless the host is 127.0.0.1, localhost, or [::1]. Do not bypass it.",
  );
  linhas.push(
    'doctor without an instance: .cursor/skills/verify-crm/scripts/control-crm doctor — exit 1, stderr "control-crm: no instance. Run launch first."',
  );

  if (parar.length > 0) {
    linhas.push(LINHA_PARAR);
    linhas.push(
      "after a failed launch elsewhere: if stderr contains LegacyDbSetupError or timeout expired, do not launch a second time.",
    );
  } else {
    linhas.push(LINHA_SEGUIR);
    linhas.push("one launch is allowed");
    linhas.push(
      "one launch only. If it prints LegacyDbSetupError or timeout expired after Initialising schema, stop. Do not retry. Do not drive the port.",
    );
  }

  return { linhas, codigo: parar.length > 0 ? 2 : 0 };
}

function git(
  args: string[],
  opcoes: { ignoraErro?: boolean; env?: NodeJS.ProcessEnv } = {},
): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      cwd: process.cwd(),
      env: opcoes.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (erro) {
    if (opcoes.ignoraErro) return "";
    throw erro;
  }
}

export function portaPorDevTcp(porta: number): "livre" | "ocupada" {
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) return "ocupada";
  try {
    execFileSync("bash", ["-c", `echo >/dev/tcp/127.0.0.1/${porta}`], { stdio: "ignore" });
    return "ocupada";
  } catch {
    return "livre";
  }
}

function lerSs(): string | null {
  try {
    return execFileSync("ss", ["-ltn"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return null;
  }
}

function lerGithub(): { codigo: number | null; saida: string } {
  const env = { ...process.env };
  delete env.OPENCODE_API_KEY;
  delete env.VERIFY_CRM_MODEL_API_KEY;
  try {
    const saida = execFileSync("gh", ["secret", "list", "-R", "helsome/AiNativeCrm"], {
      encoding: "utf8",
      env,
      timeout: 20_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { codigo: 0, saida };
  } catch (erro) {
    const falha = erro as { status?: number; stdout?: string; stderr?: string; code?: string };
    if (falha.code === "ENOENT") return { codigo: null, saida: "" };
    const stdout = typeof falha.stdout === "string" ? falha.stdout : "";
    const stderr = typeof falha.stderr === "string" ? falha.stderr : "";
    return { codigo: falha.status ?? 1, saida: `${stdout}\n${stderr}` };
  }
}

function contarSqlNoDisco(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((nome) => nome.endsWith(".sql")).length;
}

function main(): void {
  const root = process.cwd();
  if (!fs.existsSync(path.join(root, "scripts/verify-crm/cold-start.ts"))) {
    process.stderr.write("stop: run from the repository root\n");
    process.exit(2);
  }

  let fetch: "ok" | "failed" = "ok";
  try {
    execFileSync("git", ["fetch", "origin", "main"], {
      cwd: root,
      timeout: 20_000,
      stdio: "ignore",
    });
  } catch {
    fetch = "failed";
  }

  let statusOk = true;
  let porcelain = "";
  try {
    porcelain = git(["status", "--porcelain", "--", "supabase/migrations", "supabase/config.toml"]);
  } catch {
    statusOk = false;
  }
  const sqlGit = git(["ls-files", "supabase/migrations/*.sql"], { ignoraErro: true })
    .split("\n")
    .filter((linha) => linha.endsWith(".sql")).length;
  const sqlDisco = contarSqlNoDisco(path.join(root, "supabase/migrations"));
  const aninhado = fs.existsSync(path.join(root, "supabase/migrations/migrations-off-repro"));
  const workflows = WORKFLOWS.every((arquivo) => {
    try {
      execFileSync("git", ["cat-file", "-e", `origin/main:${arquivo}`], {
        cwd: root,
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  })
    ? "present"
    : "absent";

  const textoLog = fs.existsSync(CAMINHO_LOG_HERDADO)
    ? fs.readFileSync(CAMINHO_LOG_HERDADO, "utf8")
    : null;
  const branch = git(["branch", "--show-current"], { ignoraErro: true }).trim() || "(detached)";
  const githubBruto = lerGithub();

  const saidaSs = lerSs();
  const { linhas, codigo } = relatorioFrio({
    segredosFaltando: segredosEmFalta(process.env as Ambiente),
    porta: saidaSs === null ? portaPorDevTcp(PORTA_PADRAO) : portaOcupada(saidaSs, PORTA_PADRAO),
    sonda: saidaSs === null ? "devtcp" : "ss",
    migrationsOk: statusOk && migrationsCombinam({ porcelain, sqlDisco, sqlGit, aninhado }),
    sqlDisco,
    sqlGit,
    workflows,
    fetch,
    log: classificarLogHerdado(textoLog),
    github: classificarSegredosGithub(githubBruto.codigo, githubBruto.saida),
    branch,
  });
  process.stdout.write(`${linhas.join("\n")}\n`);
  process.exit(codigo);
}

if (process.argv[1]?.includes("cold-start.ts")) main();
