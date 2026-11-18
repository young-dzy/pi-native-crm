/**
 * Lê os pulls do run de ci e escreve a decisão em GITHUB_OUTPUT.
 * Não imprime segredo. Não faz checkout.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { segredosEmFalta } from "./credenciais";
import { decidirAlvo, lerPulls } from "./decidir-alvo";

/** Sem número de PR o job não tem onde comentar. Exit 0 escondia esse furo. */
export function codigoQuandoNaoHaPr(pr: number | null): 0 | 1 {
  return pr == null ? 1 : 0;
}

function escreverOutput(decisao: ReturnType<typeof decidirAlvo>): void {
  const destino = process.env.GITHUB_OUTPUT;
  const linhas = [
    `drive=${decisao.drive ? "true" : "false"}`,
    `pr=${decisao.pr ?? ""}`,
    `head_sha=${decisao.headSha}`,
    `parent_sha=${decisao.parentSha}`,
    `ci_verde=${decisao.ciVerde ? "1" : "0"}`,
    `mesmo=${decisao.mesmoRepositorio ? "1" : "0"}`,
    `segredos=${decisao.segredosPresentes ? "1" : "0"}`,
    `motivo=${decisao.motivo.replaceAll("\n", " ")}`,
  ];
  process.stdout.write(`${linhas.join("\n")}\n`);
  if (destino) fs.appendFileSync(destino, `${linhas.join("\n")}\n`);
}

function main(): void {
  const repositorio = process.env.GITHUB_REPOSITORY ?? "";
  const runId = process.env.VERIFY_RUN_ID ?? "";
  if (!repositorio || !runId) {
    process.stderr.write("FAIL: GITHUB_REPOSITORY or VERIFY_RUN_ID is unset\n");
    process.exit(1);
  }
  const segredosPresentes = segredosEmFalta(process.env).length === 0;
  const envGh = { ...process.env };
  delete envGh.OPENCODE_API_KEY;
  delete envGh.VERIFY_CRM_MODEL_API_KEY;
  const bruto = execFileSync(
    "gh",
    ["api", `repos/${repositorio}/actions/runs/${runId}`, "--jq", ".pull_requests"],
    {
      encoding: "utf8",
      env: envGh,
    },
  );
  const decisao = decidirAlvo({
    repositorio,
    headRepository: process.env.VERIFY_HEAD_REPOSITORY ?? "",
    headShaDoRun: process.env.VERIFY_HEAD_SHA_DO_RUN ?? "",
    conclusion: process.env.VERIFY_CONCLUSION ?? "",
    segredosPresentes,
    pulls: lerPulls(JSON.parse(bruto) as unknown),
  });
  escreverOutput(decisao);
  const codigo = codigoQuandoNaoHaPr(decisao.pr);
  if (codigo !== 0) process.stderr.write(`${decisao.motivo}\n`);
  process.exit(codigo);
}

if (process.argv[1]?.includes("resolver-alvo.ts")) main();
