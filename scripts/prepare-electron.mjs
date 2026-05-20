// const fs = require("fs");
// const path = require("path");

// const rootDir = process.cwd();
// const standaloneDir = path.join(rootDir, ".next", "standalone");

// function copyDir(src, dest) {
//   if (!fs.existsSync(src)) {
//     return;
//   }

//   fs.mkdirSync(dest, { recursive: true });

//   for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
//     const srcPath = path.join(src, entry.name);
//     const destPath = path.join(dest, entry.name);

//     if (entry.isDirectory()) {
//       copyDir(srcPath, destPath);
//     } else if (entry.isFile()) {
//       fs.copyFileSync(srcPath, destPath);
//     }
//   }
// }

// if (!fs.existsSync(standaloneDir)) {
//   console.warn("Standalone output not found. Run next build first.");
//   process.exit(0);
// }

// copyDir(path.join(rootDir, ".next", "static"), path.join(standaloneDir, ".next", "static"));
// copyDir(path.join(rootDir, "public"), path.join(standaloneDir, "public"));

 /**
 * Copies .next/static and public/ into .next/standalone so the packaged
 * Electron app can serve them without needing the full node_modules tree.
 *
 * Run after `next build`: node scripts/prepare-electron.mjs
 */

import { cpSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error(
    "ERROR: .next/standalone does not exist.\n" +
      'Make sure next.config.ts has  output: "standalone"  and run `npm run build` first.'
  );
  process.exit(1);
}

// .next/static -> .next/standalone/.next/static
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), {
  recursive: true,
});
console.log("Copied .next/static -> .next/standalone/.next/static");

// public/ -> .next/standalone/public
cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
console.log("Copied public -> .next/standalone/public");

console.log("Electron assets prepared successfully.");