import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  classificarLogHerdado,
  classificarSegredosGithub,
  LINHA_PARAR,
  LINHA_SEGUIR,
  migrationsCombinam,
  portaOcupada,
  portaPorDevTcp,
  relatorioFrio,
} from "@/scripts/verify-crm/cold-start";
import { corpoDoComentario, MARCADOR_VEREDITO } from "@/scripts/verify-crm/comentario";
import {
  chaveDoModelo,
  segredosEmFalta,
  valorEhChaveDeModelo,
} from "@/scripts/verify-crm/credenciais";
import { decidirAlvo, lerPulls } from "@/scripts/verify-crm/decidir-alvo";
import { JORNADAS } from "@/scripts/verify-crm/jornadas";
import {
  doctorDepoisDaTimeline,
  fechar,
  higiene,
  montarAoVivo,
  NOTA_DOCTOR_DEPOIS_DA_TELA,
  type PassoAoVivo,
} from "@/scripts/verify-crm/manter";
import {
  precondicaoObservada,
  TELAS_PARA_ABRIR,
  type ObservacaoGravada,
} from "@/scripts/verify-crm/observar";
import { codigoQuandoNaoHaPr } from "@/scripts/verify-crm/resolver-alvo";
import { FRASE_CI_NAO_E_VEREDITO, veredito } from "@/scripts/verify-crm/veredito";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

const telaBoa = { started: true, blocked: false };

function observacoesReais(): ObservacaoGravada[] {
  const dir = mkdtempSync(path.join(tmpdir(), "verify-crm-obs-"));
  return TELAS_PARA_ABRIR.map((tela) => {
    const screenshot = path.join(dir, `${tela.id}.png`);
    writeFileSync(screenshot, "png");
    const url = `http://127.0.0.1:3011${tela.caminho}`;
    return {
      id: tela.id,
      url,
      screenshot,
      precondicaoObservada: precondicaoObservada(url, `page body for ${tela.id}`),
    };
  });
}

function aoVivoBom(driveExit = 0): PassoAoVivo[] {
  return montarAoVivo({
    driveExit,
    result: telaBoa,
    observacoes: observacoesReais(),
  });
}

describe("credenciais do verify-crm", () => {
  it("não trata string vazia como chave presente", () => {
    expect(
      segredosEmFalta({
        OPENCODE_API_KEY: "",
        OPENCODE_BASE_URL: "https://opencode.ai/zen/go/v1",
      }),
    ).toEqual(["OPENCODE_API_KEY", "OPENCODE_MODEL"]);
    expect(
      chaveDoModelo({
        OPENCODE_API_KEY: "",
        VERIFY_CRM_MODEL_API_KEY: "chave-longa",
      }),
    ).toBe("chave-longa");
    expect(chaveDoModelo({ OPENCODE_API_KEY: "chave-do-go" })).toBe("chave-do-go");
  });

  it("recusa os dois nomes no fill", () => {
    const env = {
      OPENCODE_API_KEY: "chave-do-go",
      VERIFY_CRM_MODEL_API_KEY: "chave-antiga",
    };
    expect(valorEhChaveDeModelo("chave-do-go", env)).toBe(true);
    expect(valorEhChaveDeModelo("chave-antiga", env)).toBe(true);
    expect(valorEhChaveDeModelo("texto da tarefa", env)).toBe(false);
  });
});

describe("fechar o passe de manutenção", () => {
  it("o índice real está íntegro", () => {
    expect(higiene(process.cwd())).toEqual([]);
  });

  it("sem passe ao vivo não é clean", () => {
    const saida = fechar({
      problemasHigiene: [],
      caminhosAlterados: [],
      aoVivo: null,
    });
    expect(saida.desfecho).toBe("blocked");
    expect(saida.classe).toBe("live_pass_missing");
  });

  it("diff de produto não vira changed", () => {
    const saida = fechar({
      problemasHigiene: [],
      caminhosAlterados: ["lib/ai/opencode-endpoint.ts"],
      aoVivo: aoVivoBom(),
    });
    expect(saida.desfecho).toBe("blocked");
    expect(saida.classe).toBe("product_gap");
  });

  it("workflow do verificador também fica fora do harness", () => {
    const saida = fechar({
      problemasHigiene: [],
      caminhosAlterados: [".github/workflows/verify-crm-verifier.yml"],
      aoVivo: aoVivoBom(),
    });
    expect(saida).toMatchObject({ desfecho: "blocked", classe: "product_gap" });
  });

  it("passe ao vivo com índice limpo e diff vazio é clean", () => {
    expect(
      fechar({
        problemasHigiene: [],
        caminhosAlterados: [],
        aoVivo: aoVivoBom(),
      }).desfecho,
    ).toBe("clean");
  });

  it("sem result.json o fechar não é clean", () => {
    const saida = fechar({
      problemasHigiene: [],
      caminhosAlterados: [],
      aoVivo: montarAoVivo({ driveExit: 1, result: null }),
    });
    expect(saida).toMatchObject({ desfecho: "blocked", classe: "harness_gap" });
    expect(saida.motivos).toContain("workbench-run: live fail (result.json missing)");
    expect(saida.motivos).toContain("proposal-approve-revoke: screen was not opened");
  });

  it("higiene quebrada sem diff não é clean", () => {
    const saida = fechar({
      problemasHigiene: ["index: feature H2s drifted"],
      caminhosAlterados: [],
      aoVivo: aoVivoBom(),
    });
    expect(saida.desfecho).toBe("blocked");
    expect(saida.classe).toBe("doc_drift");
  });

  it("correção só no mapa, depois do passe ao vivo, é changed", () => {
    const saida = fechar({
      problemasHigiene: [],
      caminhosAlterados: [".cursor/skills/verify-crm/features/workbench-run.md"],
      aoVivo: aoVivoBom(),
    });
    expect(saida).toMatchObject({ desfecho: "changed", classe: "doc_drift" });
  });

  it("tela bloqueada é product gap, mesmo com diff vazio", () => {
    const saida = fechar({
      problemasHigiene: [],
      caminhosAlterados: [],
      aoVivo: montarAoVivo({
        driveExit: 1,
        result: { started: false, blocked: true },
      }),
    });
    expect(saida).toMatchObject({ desfecho: "blocked", classe: "product_gap" });
  });

  it("exit 2 com a timeline visível é a mesma nota no fechar e no veredito", () => {
    const mesmo = { driveExit: 2 as number | null, result: telaBoa };
    expect(doctorDepoisDaTimeline(mesmo.driveExit, mesmo.result)).toBe(true);
    const aoVivo = montarAoVivo({ ...mesmo, observacoes: observacoesReais() });
    const fechado = fechar({
      problemasHigiene: [],
      caminhosAlterados: [],
      aoVivo,
    });
    const julgado = veredito({
      ciVerde: true,
      mesmoRepositorio: true,
      segredosPresentes: true,
      parentSha: SHA_A,
      headSha: SHA_B,
      driveExit: mesmo.driveExit,
      result: mesmo.result,
    });
    expect(aoVivo.find((passo) => passo.id === "workbench-run")).toMatchObject({
      estado: "passou",
      detalhe: NOTA_DOCTOR_DEPOIS_DA_TELA,
    });
    expect(fechado.desfecho).toBe("clean");
    expect(julgado.veredito).toBe("PASS+NOTES");
    expect(julgado.notas).toContain(NOTA_DOCTOR_DEPOIS_DA_TELA);
    expect(readFileSync("scripts/verify-crm/veredito.ts", "utf8")).toContain(
      "NOTA_DOCTOR_DEPOIS_DA_TELA",
    );
  });

  it("copiar a tabela de jornadas não é observação", () => {
    const copia = aoVivoBom().map((passo) => {
      const jornada = JORNADAS[passo.id];
      if (!jornada || jornada.tipo !== "inalcancavel") return passo;
      return { ...passo, precondicao: jornada.precondicao, rota: jornada.rota };
    });
    const saida = fechar({
      problemasHigiene: [],
      caminhosAlterados: [],
      aoVivo: copia,
    });
    expect(saida.classe).toBe("harness_gap");
    expect(saida.motivos.some((motivo) => motivo.includes("verbatim copy"))).toBe(true);
  });

  it("marcar proposal como passou enfraquece a jornada", () => {
    const passos = aoVivoBom().map((passo) =>
      passo.id === "proposal-approve-revoke" ? { id: passo.id, estado: "passou" as const } : passo,
    );
    expect(fechar({ problemasHigiene: [], caminhosAlterados: [], aoVivo: passos }).classe).toBe(
      "harness_gap",
    );
  });
});

describe("veredito do PR", () => {
  const base = {
    ciVerde: true,
    mesmoRepositorio: true,
    segredosPresentes: true,
    parentSha: SHA_A,
    headSha: SHA_B,
    driveExit: 0 as number | null,
    result: telaBoa,
  };

  it("o mapa de hoje não entrega PASS: quatro features seguem inalcançáveis", () => {
    const saida = veredito(base);
    expect(saida.veredito).toBe("PASS+NOTES");
    expect(saida.notas.some((nota) => nota.startsWith("proposal-approve-revoke:"))).toBe(true);
    expect(saida.motivos).toContain(FRASE_CI_NAO_E_VEREDITO);
  });

  it("ci verde com a tela boa ainda não é PASS quando o ci está vermelho", () => {
    expect(veredito({ ...base, ciVerde: false }).veredito).toBe("FAIL");
  });

  it("fork não é PASS", () => {
    expect(veredito({ ...base, mesmoRepositorio: false }).veredito).toBe("FAIL");
  });

  it("secret ausente não é PASS", () => {
    expect(veredito({ ...base, segredosPresentes: false }).veredito).toBe("FAIL");
  });

  it("timeline bloqueada não vira PASS+NOTES", () => {
    expect(veredito({ ...base, result: { started: true, blocked: true } }).veredito).toBe("FAIL");
  });

  it("PASS só quando não há nota e o drive saiu 0", () => {
    const soWorkbench = { "workbench-run": JORNADAS["workbench-run"]! };
    expect(veredito({ ...base, jornadas: soWorkbench }).veredito).toBe("PASS");
    expect(veredito({ ...base, jornadas: soWorkbench, driveExit: 2 }).veredito).toBe("PASS+NOTES");
  });

  it("o comentário carrega o marcador, o veredito e a frase, e não a chave", () => {
    const saida = veredito(base);
    const corpo = corpoDoComentario({
      veredito: saida.veredito,
      motivos: saida.motivos,
      notas: saida.notas,
      parentSha: SHA_A,
      headSha: SHA_B,
      evidencia: "/tmp/verify-crm-evidence/run",
      resumoDiff: "features/workbench-run.md | 2 +-",
    });
    expect(corpo.startsWith(`${MARCADOR_VEREDITO}\nPASS+NOTES\n`)).toBe(true);
    expect(corpo).toContain(FRASE_CI_NAO_E_VEREDITO);
    expect(corpo).toContain(SHA_A);
    expect(corpo).toContain(SHA_B);
    expect(corpo).not.toMatch(/oc_sk_|sk-/);
  });
});

describe("decidir se o drive roda", () => {
  const pull = {
    number: 12,
    headSha: SHA_B,
    baseSha: SHA_A,
    headRepo: "helsome/AiNativeCrm",
  };

  it("lê o payload de pulls", () => {
    expect(
      lerPulls([
        {
          number: 12,
          head: { sha: SHA_B, repo: { full_name: "helsome/AiNativeCrm" } },
          base: { sha: SHA_A },
        },
      ]),
    ).toEqual([pull]);
  });

  it("dirige só head do mesmo repositório com ci verde e secrets", () => {
    const sim = decidirAlvo({
      repositorio: "helsome/AiNativeCrm",
      headRepository: "helsome/AiNativeCrm",
      headShaDoRun: SHA_B,
      conclusion: "success",
      segredosPresentes: true,
      pulls: [pull],
    });
    expect(sim.drive).toBe(true);
    expect(sim.parentSha).toBe(SHA_A);

    const fork = decidirAlvo({
      repositorio: "helsome/AiNativeCrm",
      headRepository: "outra/AiNativeCrm",
      headShaDoRun: SHA_B,
      conclusion: "success",
      segredosPresentes: true,
      pulls: [{ ...pull, headRepo: "outra/AiNativeCrm" }],
    });
    expect(fork.drive).toBe(false);
    expect(fork.pr).toBe(12);

    const vermelho = decidirAlvo({
      repositorio: "helsome/AiNativeCrm",
      headRepository: "helsome/AiNativeCrm",
      headShaDoRun: SHA_B,
      conclusion: "failure",
      segredosPresentes: true,
      pulls: [pull],
    });
    expect(vermelho.drive).toBe(false);
    expect(vermelho.ciVerde).toBe(false);
  });

  it("resolve o PR pelo payload do run sem expor a chave ao gh", () => {
    const bin = mkdtempSync(path.join(tmpdir(), "verify-crm-gh-"));
    const gh = path.join(bin, "gh");
    writeFileSync(
      gh,
      [
        "#!/usr/bin/env node",
        "const args = process.argv.slice(2);",
        'const expected = ["api", "repos/helsome/AiNativeCrm/actions/runs/123", "--jq", ".pull_requests"];',
        "if (JSON.stringify(args) !== JSON.stringify(expected)) process.exit(3);",
        "if (process.env.OPENCODE_API_KEY || process.env.VERIFY_CRM_MODEL_API_KEY) process.exit(4);",
        'process.stdout.write(JSON.stringify([{number: 12, head: {sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", repo: {name: "AiNativeCrm"}}, base: {sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}]));',
      ].join("\n"),
    );
    chmodSync(gh, 0o755);
    const saida = spawnSync(
      process.execPath,
      [path.resolve("node_modules/tsx/dist/cli.mjs"), "scripts/verify-crm/resolver-alvo.ts"],
      {
        encoding: "utf8",
        env: {
          NODE_ENV: "test",
          PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
          GITHUB_REPOSITORY: "helsome/AiNativeCrm",
          VERIFY_RUN_ID: "123",
          VERIFY_HEAD_REPOSITORY: "helsome/AiNativeCrm",
          VERIFY_HEAD_SHA_DO_RUN: SHA_B,
          VERIFY_CONCLUSION: "success",
          OPENCODE_API_KEY: "synthetic-test-key",
          VERIFY_CRM_MODEL_API_KEY: "synthetic-test-key",
          OPENCODE_BASE_URL: "https://example.invalid/v1",
          OPENCODE_MODEL: "synthetic-model",
        },
      },
    );
    expect(saida.stderr).toBe("");
    expect(saida.status).toBe(0);
    expect(saida.stdout).toContain("pr=12");
    expect(saida.stdout).toContain("drive=true");
    expect(saida.stdout).toContain(`head_sha=${SHA_B}`);
    expect(saida.stdout).toContain(`parent_sha=${SHA_A}`);
    expect(saida.stdout).not.toContain("synthetic-test-key");
  });

  it("sem número de PR o resolver sai diferente de zero", () => {
    const semPr = decidirAlvo({
      repositorio: "helsome/AiNativeCrm",
      headRepository: "helsome/AiNativeCrm",
      headShaDoRun: SHA_B,
      conclusion: "success",
      segredosPresentes: true,
      pulls: [],
    });
    expect(semPr.pr).toBeNull();
    expect(codigoQuandoNaoHaPr(semPr.pr)).toBe(1);
    expect(codigoQuandoNaoHaPr(12)).toBe(0);
    const fonte = readFileSync("scripts/verify-crm/resolver-alvo.ts", "utf8");
    expect(fonte).toContain("codigoQuandoNaoHaPr(decisao.pr)");
    expect(fonte).toContain("process.exit(codigo)");
  });
});

/** Chave de job. Comentário YAML não conta. */
function declaraEnvironment(texto: string): boolean {
  return texto.split("\n").some((linha) => {
    if (/^\s*#/.test(linha)) return false;
    return /^\s+environment:/.test(linha);
  });
}

const SETUP_SEGREDOS = "Settings > Secrets and variables > Actions > New repository secret";

describe("workflows do verify-crm", () => {
  const manter = readFileSync(".github/workflows/verify-crm-maintain.yml", "utf8");
  const verificador = readFileSync(".github/workflows/verify-crm-verifier.yml", "utf8");
  const prova = readFileSync(".github/workflows/verify-crm-pr.yml", "utf8");
  const exemplo = readFileSync(".env.example", "utf8");
  const drive = readFileSync(".cursor/skills/verify-crm/scripts/drive-workbench-run.ts", "utf8");
  const controle = readFileSync(".cursor/skills/verify-crm/scripts/control-crm", "utf8");

  it("o diário é schedule no repositório canônico e não escreve no PR", () => {
    expect(manter).toContain('cron: "17 6 * * *"');
    expect(manter).toContain("github.repository == 'helsome/AiNativeCrm'");
    expect(manter).toContain("version: 2.117.0");
    expect(manter).toContain("./.github/actions/preparar-node");
    expect(manter).toContain("actions/checkout@v7");
    expect(manter).not.toMatch(/pull-requests:\s*write/);
    expect(manter).not.toContain("pnpm/action-setup");
    expect(manter).toContain("observe-unreachable");
    expect(manter).toContain("contents: read");
    expect(manter).toContain("não faz a source wave");
    expect(declaraEnvironment(manter)).toBe(false);
  });

  it("o verificador corre depois do workflow ci e não trata o verde como veredito", () => {
    expect(verificador).toContain("workflow_run:");
    expect(verificador).toContain("if: always() && steps.alvo.outputs.pr != ''");
    expect(verificador).toContain('workflows: ["ci"]');
    expect(verificador).toContain("pull-requests: write");
    expect(verificador).toContain("Green ci.yml is not the verdict.");
    expect(verificador).toContain("version: 2.117.0");
    expect(verificador).toContain(
      'ln -s "$GITHUB_WORKSPACE/node_modules" /tmp/verify-crm-trusted/node_modules',
    );
    expect(verificador).toContain("actions/checkout@v7");
    expect(verificador).not.toContain("pull_request_target");
    expect(verificador).toContain(
      "/tmp/verify-crm-trusted/.cursor/skills/verify-crm/scripts/control-crm drive workbench-run",
    );
    expect(verificador).toContain("VERIFY_CRM_ROOT: ${{ github.workspace }}");
    expect(verificador).not.toMatch(
      /run:\s*\.cursor\/skills\/verify-crm\/scripts\/control-crm drive/,
    );
    expect(declaraEnvironment(verificador)).toBe(false);
  });

  it("a prova do PR sobe o stack no ubuntu-latest e não passa sem segredo", () => {
    expect(prova).toContain("name: verify-crm-pr");
    expect(prova).toContain("pull_request:");
    expect(prova).toContain("workflow_dispatch:");
    expect(prova).toContain('".cursor/skills/verify-crm/**"');
    expect(prova).toContain('"scripts/verify-crm/**"');
    expect(prova).toContain('".github/workflows/verify-crm-*.yml"');
    expect(prova).toContain('".github/actions/preparar-node/**"');
    expect(prova).toContain('".cursor/skills/maintain-verify-crm/**"');
    expect(prova).toContain(
      "run: bash /tmp/verify-crm-trusted/scripts/verify-crm/carregar-opencode-env.sh",
    );
    expect(prova).not.toContain("run: bash scripts/verify-crm/carregar-opencode-env.sh");
    expect(prova).toContain("runs-on: ubuntu-latest");
    expect(prova).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(prova).toContain("github.repository == 'helsome/AiNativeCrm'");
    expect(prova).toContain(
      "pnpm exec tsx /tmp/verify-crm-trusted/scripts/verify-crm/cold-start.ts",
    );
    expect(prova).toContain(
      "blocked: default branch has no control-crm; refusing to run this pull request's copy with OPENCODE_API_KEY",
    );
    expect(prova).toContain("VERIFY_CRM_ROOT: ${{ github.workspace }}");
    expect(prova).toContain(
      "/tmp/verify-crm-trusted/.cursor/skills/verify-crm/scripts/control-crm drive workbench-run",
    );
    expect(prova).not.toMatch(/run:\s*\.cursor\/skills\/verify-crm\/scripts\/control-crm drive/);
    expect(prova).toContain('echo "blocked: cold-start exited $code"');
    expect(prova).toContain("control-crm launch");
    expect(prova).toContain("control-crm doctor");
    expect(prova).toContain("control-crm drive workbench-run");
    expect(prova).toContain('echo "blocked: drive exited $code"');
    expect(prova).toContain("control-crm cleanup");
    expect(prova).toContain("actions/upload-artifact@v7");
    expect(prova).toContain("version: 2.117.0");
    expect(prova).toContain(
      'ln -s "$GITHUB_WORKSPACE/node_modules" /tmp/verify-crm-trusted/node_modules',
    );
    expect(prova).toContain("actions/checkout@v7");
    expect(prova).toContain("timeout-minutes: 5");
    expect(prova).not.toContain("pull_request_target");
    expect(prova).not.toContain("pi-native-proprio");
    expect(prova).not.toContain("cold-start.ts || true");
    expect(prova).not.toMatch(/pull-requests:\s*write/);
    expect(declaraEnvironment(prova)).toBe(false);
    const handoff = readFileSync(".cursor/skills/verify-crm/HANDOFF.md", "utf8");
    expect(handoff).toContain(".github/workflows/verify-crm-pr.yml");
    expect(handoff).toContain("workflow_dispatch");
    expect(handoff).toContain(SETUP_SEGREDOS);
    expect(handoff).toContain("blocked: default branch has no control-crm");
    expect(handoff).not.toContain("environment: verify-crm");
    const contrato = readFileSync(".cursor/skills/verify-crm/OVERNIGHT_CONTRACT.md", "utf8");
    expect(contrato).toContain(SETUP_SEGREDOS);
    expect(contrato).not.toContain("environment: verify-crm");
  });

  it("os nomes dos secrets estão no exemplo, vazios", () => {
    const valor = (nome: string) => {
      const match = exemplo.match(new RegExp(`^${nome}=([^\\n]*)$`, "m"));
      return (match?.[1] ?? "ausente").replace(/\s+#.*$/, "").trim();
    };
    expect(valor("OPENCODE_API_KEY")).toBe("");
    expect(valor("OPENCODE_MODEL")).toBe("");
    expect(valor("OPENCODE_BASE_URL")).toBe("");
    expect(exemplo).not.toMatch(/oc_sk_/);
    for (const texto of [manter, verificador, prova]) {
      expect(texto).toContain("OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}");
      expect(texto).toContain("VERIFY_CRM_MODEL_API_KEY: ${{ secrets.OPENCODE_API_KEY }}");
      expect(texto).toContain("OPENCODE_BASE_URL: ${{ secrets.OPENCODE_BASE_URL }}");
      expect(texto).toContain("OPENCODE_MODEL: ${{ secrets.OPENCODE_MODEL }}");
      expect(texto).toContain("OPENCODE_E2E_MODEL_ID: ${{ secrets.OPENCODE_MODEL }}");
      expect(texto).toMatch(
        /bash (?:\/tmp\/verify-crm-trusted\/)?scripts\/verify-crm\/carregar-opencode-env\.sh/,
      );
      expect(texto).not.toContain("secrets.VERIFY_CRM_MODEL_API_KEY");
      expect(texto).not.toContain("secrets.OPENCODE_E2E_MODEL_ID");
    }
    const handoff = readFileSync(".cursor/skills/verify-crm/HANDOFF.md", "utf8");
    const pipeline = readFileSync(".cursor/skills/verify-crm/PIPELINE_PROMPT.md", "utf8");
    for (const texto of [handoff, pipeline]) {
      expect(texto).toContain("git history permanently");
      expect(texto).toContain("Deleting the file is not enough");
      expect(texto).toContain("revoke the key at OpenCode");
    }
    const fallback = readFileSync(".cursor/skills/verify-crm/opencode.env", "utf8")
      .split("\n")
      .filter((linha) => linha.length > 0);
    expect(fallback).toHaveLength(3);
    expect(fallback[1]).toBe("OPENCODE_BASE_URL=https://opencode.ai/zen/go/v1");
    expect(fallback[2]).toBe("OPENCODE_MODEL=cat-jam-free");
    expect(fallback[0]?.startsWith("OPENCODE_API_KEY=")).toBe(true);
    expect(fallback[0]?.includes('"')).toBe(false);
    expect(fallback[0]?.includes("'")).toBe(false);
    expect(drive).toContain("chaveDoModelo");
    expect(controle).toContain('OPENCODE_E2E_MODEL_ID="$OPENCODE_MODEL"');
    expect(controle).toContain("--dry-run");
    expect(controle).toContain("dry-run would kill app pid");
    expect(controle).toContain('ROOT="$(cd "$VERIFY_CRM_ROOT" && pwd)"');
    const clique = drive.indexOf("运行详情");
    const espera = drive.indexOf('getByText("执行时间线")');
    const leitura = drive.indexOf("innerText");
    expect(clique).toBeGreaterThan(0);
    expect(espera).toBeGreaterThan(clique);
    expect(leitura).toBeGreaterThan(espera);
    expect(drive).toContain("waitFor({ timeout: 30_000 })");
    expect(drive).toContain("fileURLToPath(import.meta.url)");
    expect(drive).not.toContain('path.join(root, ".cursor/skills/verify-crm/scripts/doctor.ts")');
  });

  it("o drive espera a região Agent 对话 que o workbench expõe", () => {
    const workbench = readFileSync(
      "app/app/ai/workbench/_components/AgentCrmWorkbench.tsx",
      "utf8",
    );
    expect(workbench).toContain('role="region"');
    expect(workbench).toContain('aria-label="Agent 对话"');
    expect(drive).toContain('getByRole("region", { name: "Agent 对话" })');
    expect(drive).not.toContain("Agent–CRM 工作台");
    expect(drive).not.toContain("Agent-CRM 工作台");
  });
});

describe("cold-start do verify-crm", () => {
  const handoff = readFileSync(".cursor/skills/verify-crm/HANDOFF.md", "utf8");
  const fonte = readFileSync("scripts/verify-crm/cold-start.ts", "utf8");

  const limpo = {
    segredosFaltando: [] as string[],
    porta: "livre" as const,
    migrationsOk: true,
    sqlDisco: 12,
    sqlGit: 12,
    workflows: "absent" as const,
    fetch: "ok" as const,
    log: "ausente" as const,
    github: { estado: "sem_permissao" as const, faltam: [] as string[] },
    branch: "cursor/verify-crm-skill-41b3",
    sonda: "ss" as const,
  };

  it("para nesta máquina quando o log herdado tem LegacyDbSetupError", () => {
    const saida = relatorioFrio({ ...limpo, log: "bloqueio" });
    expect(saida.codigo).toBe(2);
    expect(saida.linhas).toContain(LINHA_PARAR);
    expect(saida.linhas.join("\n")).not.toContain(LINHA_SEGUIR);
    expect(saida.linhas.join("\n")).not.toContain("one launch is allowed");
    expect(saida.linhas.join("\n")).toContain("LegacyDbSetupError");
    expect(saida.linhas.join("\n")).not.toMatch(/oc_sk_|sk-/);
  });

  it("permite um launch quando o log herdado não está no disco", () => {
    const saida = relatorioFrio(limpo);
    expect(saida.codigo).toBe(0);
    expect(saida.linhas).toContain(LINHA_SEGUIR);
    expect(saida.linhas).toContain("one launch is allowed");
    expect(saida.linhas).toContain(
      "github secrets: permission denied — a human adds OPENCODE_API_KEY, OPENCODE_BASE_URL, and OPENCODE_MODEL on helsome/AiNativeCrm",
    );
    expect(saida.linhas).toContain("workflows on origin/main: absent");
  });

  it("não trata string vazia de segredo como presente e não imprime valor", () => {
    const saida = relatorioFrio({
      ...limpo,
      segredosFaltando: ["OPENCODE_API_KEY", "OPENCODE_MODEL"],
    });
    expect(saida.codigo).toBe(2);
    expect(saida.linhas).toContain("secrets: blocked: missing OPENCODE_API_KEY, OPENCODE_MODEL");
    expect(saida.linhas.join("\n")).not.toContain("valor-da-chave");
    expect(saida.linhas.join("\n")).not.toContain("one launch is allowed");
  });

  it("ss ausente usa o mesmo /dev/tcp e não libera o launch sozinho", () => {
    expect(portaPorDevTcp(1)).toBe("livre");
    const viaTcp = relatorioFrio({ ...limpo, sonda: "devtcp" });
    expect(viaTcp.linhas.join("\n")).toContain("port 3011: free (ss missing; /dev/tcp)");
    expect(viaTcp.linhas).toContain("one launch is allowed");
  });

  it("recusa a porta ocupada e migrations que não batem com o git", () => {
    expect(portaOcupada("LISTEN 0 128 127.0.0.1:3011\n", 3011)).toBe("ocupada");
    expect(portaOcupada("LISTEN 0 128 127.0.0.1:3000\n", 3011)).toBe("livre");
    expect(portaOcupada(null, 3011)).toBe("desconhecida");
    expect(
      migrationsCombinam({
        porcelain: "",
        sqlDisco: 3,
        sqlGit: 3,
        aninhado: false,
      }),
    ).toBe(true);
    expect(
      migrationsCombinam({
        porcelain: " M supabase/config.toml",
        sqlDisco: 3,
        sqlGit: 3,
        aninhado: false,
      }),
    ).toBe(false);
    const saida = relatorioFrio({
      ...limpo,
      porta: "ocupada",
      migrationsOk: false,
      sqlDisco: 0,
    });
    expect(saida.codigo).toBe(2);
    expect(saida.linhas.join("\n")).toContain("do not GET http://127.0.0.1:3011/login");
    expect(saida.linhas.join("\n")).toContain("migrations: dirty (disk=0 git=12)");
  });

  it("classifica o log e a lista de secrets sem confundir 403 com ausência", () => {
    expect(classificarLogHerdado(null)).toBe("ausente");
    expect(classificarLogHerdado('{"code":"LegacyDbSetupError"}')).toBe("bloqueio");
    expect(classificarLogHerdado("Error: timeout expired")).toBe("bloqueio");
    expect(classificarLogHerdado("outro texto")).toBe("outro");
    expect(
      classificarSegredosGithub(1, "HTTP 403: Resource not accessible by integration").estado,
    ).toBe("sem_permissao");
    expect(
      classificarSegredosGithub(
        0,
        "OPENCODE_API_KEY\t2026-01-01\nOPENCODE_BASE_URL\t2026-01-01\nOPENCODE_MODEL\t2026-01-01\n",
      ).estado,
    ).toBe("presentes");
    expect(classificarSegredosGithub(0, "OUTRO\t2026-01-01\n").faltam).toEqual([
      "OPENCODE_API_KEY",
      "OPENCODE_BASE_URL",
      "OPENCODE_MODEL",
    ]);
    expect(classificarSegredosGithub(null, "").estado).toBe("gh_ausente");
  });

  it("o HANDOFF cita o comando, a parada e a seção que só um humano fecha", () => {
    expect(handoff).toContain("pnpm exec tsx scripts/verify-crm/cold-start.ts");
    expect(handoff).toContain("pnpm exec tsx scripts/verify-crm/maintain.ts --exigir-segredos");
    expect(handoff).toContain("stdout `secrets present`");
    expect(handoff).toContain(LINHA_PARAR);
    expect(handoff).toContain(LINHA_SEGUIR);
    expect(handoff).toContain("## Known gaps");
    expect(handoff).toContain("LegacyDbSetupError");
    expect(handoff).toContain("http://127.0.0.1:3011/login");
    expect(fonte).toContain("delete env.OPENCODE_API_KEY");
    expect(fonte).toContain("delete env.VERIFY_CRM_MODEL_API_KEY");
    expect(fonte).toContain("/dev/tcp/127.0.0.1/");
    expect(handoff).toContain("port 3011: free (ss missing; /dev/tcp)");
    expect(handoff).toContain("one launch is allowed");
    expect(handoff).not.toContain("poteto_methodology_d8b4.md");
    expect(readFileSync(".cursor/skills/verify-crm/PIPELINE_PROMPT.md", "utf8")).not.toContain(
      "poteto_methodology_d8b4.md",
    );
    const contrato = readFileSync(".cursor/skills/verify-crm/OVERNIGHT_CONTRACT.md", "utf8");
    expect(contrato).not.toContain("cursor/<descriptive-name>-41b3");
    expect(contrato).toContain("Do not append a fixed suffix");
    expect(contrato).toContain("stay on `cursor/verify-crm-skill-41b3`");
    expect(contrato).toContain("After pull request 12 merges");
    const ids = Object.entries(JORNADAS)
      .filter(([, jornada]) => jornada.tipo === "inalcancavel")
      .map(([id]) => id)
      .sort();
    expect(TELAS_PARA_ABRIR.map((tela) => tela.id).sort()).toEqual(ids);
    for (const jornada of Object.values(JORNADAS)) {
      if (jornada.tipo !== "inalcancavel") continue;
      expect(precondicaoObservada("http://127.0.0.1:3011/app/ai/workbench", "corpo")).not.toBe(
        jornada.precondicao,
      );
    }
  });
});

describe("carregar-opencode-env", () => {
  function gravar(conteudo: string) {
    const dir = mkdtempSync(path.join(tmpdir(), "opencode-env-"));
    const arquivo = path.join(dir, "opencode.env");
    const githubEnv = path.join(dir, "github-env");
    writeFileSync(arquivo, conteudo);
    writeFileSync(githubEnv, "");
    return { arquivo, githubEnv };
  }

  function carregar(env: Record<string, string>, arquivo: string, githubEnv: string) {
    return spawnSync("bash", ["scripts/verify-crm/carregar-opencode-env.sh"], {
      encoding: "utf8",
      env: {
        // Next's ProcessEnv requires NODE_ENV; the loader does not read it.
        NODE_ENV: "test",
        PATH: process.env.PATH ?? "",
        OPENCODE_ENV_FILE: arquivo,
        GITHUB_ENV: githubEnv,
        ...env,
      },
    });
  }

  it("preenche nome vazio pelo arquivo e não cobre secret", () => {
    const { arquivo, githubEnv } = gravar(
      [
        "# comentario",
        "OPENCODE_API_KEY=valor-do-arquivo",
        'OPENCODE_BASE_URL="https://arquivo.example/v1"',
        "OPENCODE_MODEL=modelo-arquivo",
        "OUTRO=ignorado",
        "",
      ].join("\n"),
    );
    const vazio = carregar(
      { OPENCODE_API_KEY: "", OPENCODE_BASE_URL: "   ", OPENCODE_MODEL: "" },
      arquivo,
      githubEnv,
    );
    expect(vazio.status).toBe(0);
    expect(vazio.stdout).toBe("");
    const gravado = readFileSync(githubEnv, "utf8");
    expect(gravado).toContain("OPENCODE_API_KEY<<__OC_ENV__\nvalor-do-arquivo\n");
    expect(gravado).toContain("OPENCODE_BASE_URL<<__OC_ENV__\nhttps://arquivo.example/v1\n");
    expect(gravado).toContain("OPENCODE_MODEL<<__OC_ENV__\nmodelo-arquivo\n");
    expect(gravado).toContain("VERIFY_CRM_MODEL_API_KEY<<__OC_ENV__\nvalor-do-arquivo\n");
    expect(gravado).not.toContain("OUTRO=");

    const { arquivo: arquivo2, githubEnv: githubEnv2 } = gravar(
      "OPENCODE_API_KEY=valor-do-arquivo\nOPENCODE_BASE_URL=https://arquivo.example/v1\nOPENCODE_MODEL=modelo-arquivo\n",
    );
    const cheio = carregar(
      {
        OPENCODE_API_KEY: "valor-do-secret",
        OPENCODE_BASE_URL: "https://secret.example/v1",
        OPENCODE_MODEL: "modelo-secret",
      },
      arquivo2,
      githubEnv2,
    );
    expect(cheio.status).toBe(0);
    expect(cheio.stdout).toBe("");
    const doSecret = readFileSync(githubEnv2, "utf8");
    expect(doSecret).toContain("OPENCODE_API_KEY<<__OC_ENV__\nvalor-do-secret\n");
    expect(doSecret).toContain("OPENCODE_BASE_URL<<__OC_ENV__\nhttps://secret.example/v1\n");
    expect(doSecret).toContain("OPENCODE_MODEL<<__OC_ENV__\nmodelo-secret\n");
    expect(doSecret).not.toContain("valor-do-arquivo");
  });
});
