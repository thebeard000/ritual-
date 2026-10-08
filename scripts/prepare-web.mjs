import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");
const www = resolve("www");

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });

const files = [
  "index.html",
  "ritual-v2.js",
  "sw.js",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png"
];

for (const file of files) {
  await cp(resolve(root, file), resolve(www, file));
}

await cp(resolve(root, "brand"), resolve(www, "brand"), { recursive: true });
console.log("Prepared Capacitor web bundle:", www);
