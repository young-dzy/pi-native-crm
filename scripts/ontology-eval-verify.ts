/** Read-only verification of frozen files and the isolated synthetic database. */
import { verifyFixture } from "@/lib/ontology/eval/verify-fixture";
process.stdout.write(`${JSON.stringify(verifyFixture(process.cwd()), null, 2)}\n`);
