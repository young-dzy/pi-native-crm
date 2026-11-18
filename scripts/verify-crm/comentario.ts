import { FRASE_CI_NAO_E_VEREDITO, type Veredito } from "./veredito";

export const MARCADOR_VEREDITO = "<!-- verify-crm-verdict -->";

export function corpoDoComentario(input: {
  veredito: Veredito;
  motivos: string[];
  notas: string[];
  parentSha: string;
  headSha: string;
  evidencia: string;
  resumoDiff: string;
}): string {
  const motivos = input.motivos.map((linha) => `- ${linha}`).join("\n");
  const notas =
    input.notas.length > 0 ? input.notas.map((linha) => `- ${linha}`).join("\n") : "- none";
  const diff = input.resumoDiff.trim() || "(no diff stat)";
  return `${MARCADOR_VEREDITO}
${input.veredito}

${FRASE_CI_NAO_E_VEREDITO} This comment is the user drive of head \`${input.headSha}\` against parent \`${input.parentSha}\`.

Motivos:
${motivos}

Notas:
${notas}

Evidence: ${input.evidencia || "(no evidence path)"}

\`\`\`
${diff}
\`\`\`
`;
}
