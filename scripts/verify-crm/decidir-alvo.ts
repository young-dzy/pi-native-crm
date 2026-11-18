export interface PullResumo {
  number: number;
  headSha: string;
  baseSha: string;
  headRepo: string;
}

export interface DecisaoAlvo {
  drive: boolean;
  pr: number | null;
  parentSha: string;
  headSha: string;
  mesmoRepositorio: boolean;
  ciVerde: boolean;
  segredosPresentes: boolean;
  motivo: string;
}

const SHA = /^[0-9a-f]{40}$/;

export function lerPulls(valor: unknown): PullResumo[] {
  if (!Array.isArray(valor)) return [];
  const saida: PullResumo[] = [];
  for (const item of valor) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const head = rec.head;
    const base = rec.base;
    if (
      typeof rec.number !== "number" ||
      !head ||
      typeof head !== "object" ||
      !base ||
      typeof base !== "object"
    ) {
      continue;
    }
    const headRec = head as Record<string, unknown>;
    const baseRec = base as Record<string, unknown>;
    const repo = headRec.repo;
    const headRepo =
      repo &&
      typeof repo === "object" &&
      typeof (repo as Record<string, unknown>).full_name === "string"
        ? ((repo as Record<string, unknown>).full_name as string)
        : "";
    if (typeof headRec.sha !== "string" || typeof baseRec.sha !== "string") continue;
    saida.push({ number: rec.number, headSha: headRec.sha, baseSha: baseRec.sha, headRepo });
  }
  return saida;
}

export function decidirAlvo(input: {
  repositorio: string;
  headRepository: string;
  headShaDoRun: string;
  conclusion: string;
  segredosPresentes: boolean;
  pulls: PullResumo[];
}): DecisaoAlvo {
  const ciVerde = input.conclusion === "success";
  const escolhido =
    input.pulls.find((pull) => pull.headSha === input.headShaDoRun) ?? input.pulls[0] ?? null;
  const headSha = escolhido?.headSha || input.headShaDoRun;
  const parentSha = escolhido?.baseSha ?? "";
  const headRepo = escolhido?.headRepo || input.headRepository;
  const mesmoRepositorio =
    input.headRepository === input.repositorio &&
    headRepo === input.repositorio &&
    input.repositorio !== "";
  const shasValidos = SHA.test(headSha) && SHA.test(parentSha);
  const base: DecisaoAlvo = {
    drive: false,
    pr: escolhido?.number ?? null,
    parentSha: SHA.test(parentSha) ? parentSha : "",
    headSha: SHA.test(headSha) ? headSha : "",
    mesmoRepositorio,
    ciVerde,
    segredosPresentes: input.segredosPresentes,
    motivo: "",
  };

  if (!escolhido) {
    base.motivo = "ci run has no pull request attached";
    return base;
  }
  if (!mesmoRepositorio) {
    base.motivo = "head repository is not this repository; its code is not executed with secrets";
    return base;
  }
  if (!ciVerde) {
    base.motivo = "ci.yml did not succeed; the user drive does not run";
    return base;
  }
  if (!input.segredosPresentes) {
    base.motivo = "OPENCODE_API_KEY, OPENCODE_BASE_URL, or OPENCODE_MODEL is missing";
    return base;
  }
  if (!shasValidos) {
    base.motivo = "parent or head sha is not a full git sha";
    return base;
  }
  base.drive = true;
  base.motivo = "drive head against parent";
  return base;
}
