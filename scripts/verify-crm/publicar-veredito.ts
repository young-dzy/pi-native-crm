/**
 * Publica o veredito no PR. O token é GH_TOKEN ou GITHUB_TOKEN.
 * OPENCODE_API_KEY não é lido aqui.
 */
import fs from "node:fs";

import { corpoDoComentario, MARCADOR_VEREDITO } from "./comentario";
import { lerResultado } from "./manter";
import { veredito } from "./veredito";

interface Comentario {
  id: number;
  body: string;
}

function flag(nome: string): boolean {
  return process.env[nome] === "1";
}

function obrigatorio(nome: string): string {
  const valor = process.env[nome] ?? "";
  if (!valor) {
    process.stderr.write(`FAIL: ${nome} is unset\n`);
    process.exit(1);
  }
  return valor;
}

async function comentarios(repo: string, pr: string, token: string): Promise<Comentario[]> {
  const resposta = await fetch(
    `https://api.github.com/repos/${repo}/issues/${pr}/comments?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "verify-crm-verifier",
      },
    },
  );
  if (!resposta.ok) {
    process.stderr.write(`FAIL: listing comments returned ${resposta.status}\n`);
    process.exit(1);
  }
  const corpo: unknown = await resposta.json();
  if (!Array.isArray(corpo)) return [];
  const saida: Comentario[] = [];
  for (const item of corpo) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id === "number" && typeof rec.body === "string")
      saida.push({ id: rec.id, body: rec.body });
  }
  return saida;
}

async function publicar(
  repo: string,
  pr: string,
  token: string,
  body: string,
  existente: number | null,
): Promise<void> {
  const url = existente
    ? `https://api.github.com/repos/${repo}/issues/comments/${existente}`
    : `https://api.github.com/repos/${repo}/issues/${pr}/comments`;
  const resposta = await fetch(url, {
    method: existente ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "verify-crm-verifier",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });
  if (!resposta.ok) {
    process.stderr.write(`FAIL: posting the verdict returned ${resposta.status}\n`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const repo = obrigatorio("GITHUB_REPOSITORY");
  const pr = obrigatorio("VERIFY_PR");
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  if (!token) {
    process.stderr.write("FAIL: GH_TOKEN is unset\n");
    process.exit(1);
  }
  const driveBruto = process.env.VERIFY_DRIVE_EXIT ?? "";
  const driveExit = driveBruto === "" ? null : Number(driveBruto);
  const saida = veredito({
    ciVerde: flag("VERIFY_CI_VERDE"),
    mesmoRepositorio: flag("VERIFY_MESMO_REPOSITORIO"),
    segredosPresentes: flag("VERIFY_SEGREDOS"),
    parentSha: process.env.VERIFY_PARENT_SHA ?? "",
    headSha: process.env.VERIFY_HEAD_SHA ?? "",
    driveExit: driveExit !== null && Number.isInteger(driveExit) ? driveExit : null,
    result: lerResultado(process.env.VERIFY_RESULT_JSON ?? null),
  });
  const resumo = process.env.VERIFY_DIFF_STAT
    ? fs.readFileSync(process.env.VERIFY_DIFF_STAT, "utf8").slice(0, 2000)
    : "";
  const body = corpoDoComentario({
    veredito: saida.veredito,
    motivos: saida.motivos,
    notas: saida.notas,
    parentSha: process.env.VERIFY_PARENT_SHA ?? "",
    headSha: process.env.VERIFY_HEAD_SHA ?? "",
    evidencia: process.env.VERIFY_EVIDENCE ?? "",
    resumoDiff: resumo,
  });
  if (process.env.VERIFY_CORPO_APENAS === "1") {
    process.stdout.write(body);
    return;
  }
  const existentes = await comentarios(repo, pr, token);
  const anterior =
    existentes.find((comentario) => comentario.body.includes(MARCADOR_VEREDITO)) ?? null;
  await publicar(repo, pr, token, body, anterior?.id ?? null);
  process.stdout.write(`${saida.veredito}\n`);
}

if (process.argv[1]?.includes("publicar-veredito.ts")) {
  void main();
}
