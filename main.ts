// Vice Panel Studio — make.fun entry program for gta6-cover-art-01 (Node 22, standard library only).
//
// The app itself is the static site under app/: index.html plus ES modules in app/src/, served offline by any
// static file server. This program hands the entry in: it copies app/ and screenshots/ from beside this file
// into the output directory and writes dossier.json there with the vendored make.fun library
// (vendor/makefun-app.ts, kept byte-identical to the kit's copy), which is the summary the judge reads.
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR standing in for /output outside the container:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Try the app itself with `node serve.ts`, then open the local page it prints.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copies one repository folder into the output, creating the destination first. */
function copyIntoOutput(folderName) {
  const from = join(repoRoot, folderName);
  const to = join(outputDir, folderName);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyIntoOutput('app');
copyIntoOutput('screenshots');

// The caps mirror the sealed scorer's gate: at most 4 screenshots of 256 KiB, at most 993 entries and 48 MiB
// under app/, paths under app/ at most 1000 bytes, and the dossier text capped at 160 KiB.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`Vice Panel Studio handed in: app/ and screenshots/ copied to ${outputDir}, dossier.json written (${dossier.length} bytes).`);
