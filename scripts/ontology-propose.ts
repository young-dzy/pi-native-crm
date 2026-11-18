/** Prepare a proposed ontology revision for human review; never publishes it. */
import { readFileSync, writeFileSync } from "node:fs";
import { proposeMetricChange } from "@/lib/ontology/eval/proposals";

const [input, output] = process.argv.slice(2);
if (!input || !output || input === output)
  throw new Error("usage: ontology-propose <input.json> <new-output.json>");
const proposal = proposeMetricChange(JSON.parse(readFileSync(input, "utf8")));
writeFileSync(output, `${JSON.stringify(proposal, null, 2)}\n`, { flag: "wx", mode: 0o600 });
