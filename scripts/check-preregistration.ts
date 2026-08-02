import { validatePreregistration } from "../lib/preregistration.ts";

const path = "experiments/m1-chrome-sum-u32-v1/preregistration.json";
const value = JSON.parse(await Deno.readTextFile(path));
const result = await validatePreregistration(value);
if (!result.ok) throw new Error(`preregistration denied: ${result.errors.join("; ")}`);
console.log(
  "preregistration-check: 2 strata; 20-pair floor; 60-pair cap; 5 Bonferroni-protected looks; 120-launch permit envelope; authorization not instantiated",
);
