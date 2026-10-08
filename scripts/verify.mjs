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
  ["ritual-v2.js", /ritual-hero/],
  ["ritual-v2.js", /ritual\.challenge\.v1/],
  ["ritual-v2.js", /shareRecap/],
  ["ritual-v2.js", /RITUAL \\'\+r\.year/],
  ["ritual-v2.js", /youTab && !view\.querySelector\('\.ritual-v2-profile'\)/],
  ["ritual-v2.js", /todayTab && !view\.querySelector\('\.ritual-hero'\)/],
  ["ritual-v2.js", /new MutationObserver/],
  ["sw.js", /ritual-v5/],
  ["capacitor.config.json", /com\.ritual\.habittracker/]
];

let ok = true;
for (const [file, pattern] of checks) {
  const source = await readFile(file, "utf8");
  const pass = pattern.test(source);
  console.log(pass ? "PASS" : "FAIL", file);
  ok = ok && pass;
}

if (ok) {
  const { spawnSync } = await import("node:child_process");
  const syntax = spawnSync(process.execPath, ["--check", "ritual-v2.js"], { encoding: "utf8" });
  const pass = syntax.status === 0;
  console.log(pass ? "PASS" : "FAIL", "ritual-v2.js syntax");
  if (!pass && syntax.stderr) console.error(syntax.stderr);
  ok = ok && pass;
}

if (!ok) process.exit(1);
console.log("Ritual verification passed.");
