import { JORNADAS, notasDasJornadas, type Jornada } from "./jornadas";
import { doctorDepoisDaTimeline, NOTA_DOCTOR_DEPOIS_DA_TELA, type ResultadoDaTela } from "./manter";

export const FRASE_CI_NAO_E_VEREDITO = "Green ci.yml is not the verdict.";

export type Veredito = "PASS" | "PASS+NOTES" | "FAIL";

export interface EntradaVeredito {
  ciVerde: boolean;
  mesmoRepositorio: boolean;
  segredosPresentes: boolean;
  parentSha: string;
  headSha: string;
  driveExit: number | null;
  result: ResultadoDaTela | null;
  jornadas?: Record<string, Jornada>;
}

export interface SaidaVeredito {
  veredito: Veredito;
  motivos: string[];
  notas: string[];
}

function falha(motivos: string[], notas: string[]): SaidaVeredito {
  return { veredito: "FAIL", motivos, notas };
}

/**
 * O verde de `.github/workflows/ci.yml` autoriza começar o drive. Não é o
 * veredito. `ciVerde: false` devolve FAIL mesmo com a tela boa.
 */
export function veredito(entrada: EntradaVeredito): SaidaVeredito {
  const jornadas = entrada.jornadas ?? JORNADAS;
  const notas = notasDasJornadas(jornadas);

  if (!entrada.mesmoRepositorio) {
    return falha(
      ["fork or other repository head is not driven with these secrets", FRASE_CI_NAO_E_VEREDITO],
      notas,
    );
  }
  if (!entrada.ciVerde) {
    return falha(
      [
        "ci.yml did not succeed, so the user drive did not run. A green ci.yml would still not be the verdict.",
        FRASE_CI_NAO_E_VEREDITO,
      ],
      notas,
    );
  }
  if (!entrada.segredosPresentes) {
    return falha(
      [
        "OPENCODE_API_KEY, OPENCODE_BASE_URL, or OPENCODE_MODEL is missing",
        FRASE_CI_NAO_E_VEREDITO,
      ],
      notas,
    );
  }
  if (!entrada.parentSha || !entrada.headSha) {
    return falha(["parent or head sha is missing", FRASE_CI_NAO_E_VEREDITO], notas);
  }
  if (entrada.driveExit === null || entrada.result === null) {
    return falha(["user drive did not produce result.json", FRASE_CI_NAO_E_VEREDITO], notas);
  }
  if (!entrada.result.started || entrada.result.blocked) {
    return falha(
      ["the workbench timeline did not show a successful run", FRASE_CI_NAO_E_VEREDITO],
      notas,
    );
  }
  if (entrada.driveExit !== 0 && entrada.driveExit !== 2) {
    return falha([`drive exit ${entrada.driveExit}`, FRASE_CI_NAO_E_VEREDITO], notas);
  }
  if (doctorDepoisDaTimeline(entrada.driveExit, entrada.result)) {
    notas.push(NOTA_DOCTOR_DEPOIS_DA_TELA);
  }
  if (notas.length === 0 && entrada.driveExit === 0) {
    return { veredito: "PASS", motivos: [FRASE_CI_NAO_E_VEREDITO], notas };
  }
  return { veredito: "PASS+NOTES", motivos: [FRASE_CI_NAO_E_VEREDITO], notas };
}
