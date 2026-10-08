import { readFile } from "node:fs/promises";

const checks = [
  ["index.html", /id="app"/],
  ["index.html", /env\(safe-area-inset-top/],
  ["index.html", /data-app-shell/],
  ["index.html", /Legacy prototype selectors are intentionally inert/],
  ["index.html", /prefers-reduced-motion/],
  ["manifest.webmanifest", /"short_name"\s*:\s*"Ritual"/],
  ["manifest.webmanifest", /"display"\s*:\s*"standalone"/],
  ["ritual-v2.js", /ritual\.profile\.v2/],
  ["sw.js", /ritual-v4/],
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
console.log("Ritual verification passed.");
