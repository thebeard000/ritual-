import { readFile } from "node:fs/promises";

const checks = [
  ["index.html", /id="app"/],
  ["manifest.webmanifest", /"short_name"\s*:\s*"Ritual"/],
  ["ritual-v2.js", /ritual\.profile\.v2/],
  ["sw.js", /ritual-v3/],
  ["capacitor.config.json", /com\.ritual\.habittracker/]
];

let ok = true;

for (const [file, pattern] of checks) {
  const source = await readFile(file, "utf8");
  const pass = pattern.test(source);
  console.log(pass ? "PASS" : "FAIL", file);
  ok = ok && pass;
}

if (!ok) process.exit(1);
