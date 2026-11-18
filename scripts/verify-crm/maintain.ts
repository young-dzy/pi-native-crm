/**
 * Fecha um passe de manutenção. Não edita produto e não abre PR.
 *
 *   pnpm exec tsx scripts/verify-crm/maintain.ts --exigir-segredos
 *   pnpm exec tsx scripts/verify-crm/maintain.ts --fechar --drive-exit 0
 *
 * Exit 0 é `clean` ou `changed`. Exit diferente de zero é `blocked`.
 * O valor de um segredo nunca entra na saída.
 */
import { segredosEmFalta } from "./credenciais";
import {
  acharResultado,
  caminhosDoGit,
  diretorioDasObservacoes,
  fechar,
  higiene,
  lerObservacoes,
  lerResultado,
  montarAoVivo,
} from "./manter";

function driveExitDoArgv(args: string[]): number | null {
  const indice = args.indexOf("--drive-exit");
  const bruto = indice >= 0 ? args[indice + 1] : "";
  if (bruto === undefined || bruto === "") return null;
  if (!/^-?\d+$/.test(bruto)) {
    process.stderr.write("blocked: drive exit is not an integer\n");
    process.exit(1);
  }
  return Number(bruto);
}

function exigirSegredos(): void {
  const faltam = segredosEmFalta(process.env);
  if (faltam.length > 0) {
    process.stderr.write(`blocked: missing ${faltam.join(", ")}\n`);
    process.exit(2);
  }
  process.stdout.write("secrets present\n");
}

function fecharPasse(args: string[]): void {
  const root = process.cwd();
  const resultado = acharResultado();
  const saida = fechar({
    problemasHigiene: higiene(root),
    caminhosAlterados: caminhosDoGit(root),
    aoVivo: montarAoVivo({
      driveExit: driveExitDoArgv(args),
      result: lerResultado(resultado),
      observacoes: lerObservacoes(diretorioDasObservacoes(resultado)),
    }),
  });
  process.stdout.write(`${JSON.stringify(saida)}\n`);
  if (saida.desfecho === "blocked") process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--exigir-segredos")) {
    exigirSegredos();
    return;
  }
  if (args.includes("--fechar")) {
    fecharPasse(args);
    return;
  }
  process.stderr.write("usage: maintain.ts --exigir-segredos | --fechar --drive-exit N\n");
  process.exit(2);
}

if (process.argv[1]?.includes("maintain.ts")) main();
