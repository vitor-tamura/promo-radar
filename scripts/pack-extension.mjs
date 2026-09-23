/**
 * Empacota dist-extension/ para distribuicao.
 *
 * O ZIP tem o manifest.json na raiz, e nao uma pasta contendo o manifesto: e o
 * formato que o Chrome espera ao descompactar e o mesmo que a Chrome Web Store
 * aceitaria no upload. Por isso os caminhos sao relativos a dist-extension.
 *
 * O nome nao leva a versao para que o link do release mais recente no GitHub
 * (/releases/latest/download/promo-radar-extensao.zip) continue valendo a cada
 * publicacao. A versao fica no manifesto e no nome do release.
 *
 * Saida: promo-radar-extensao.zip
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createZip } from "./zip.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = resolve(root, "dist-extension");

if (!existsSync(resolve(buildDir, "manifest.json"))) {
  console.error("dist-extension/ nao existe ou esta incompleta. Rode: npm run extension");
  process.exit(1);
}

/** Todos os arquivos, em profundidade, com o caminho relativo a raiz da build. */
const collect = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const path = join(directory, item.name);
    return item.isDirectory() ? collect(path) : [path];
  });

const entries = collect(buildDir)
  .map((path) => ({
    // A barra normal e o que a especificacao do ZIP pede; no Windows o separador
    // do caminho e outro, e deixa-lo passar quebra a extensao para quem
    // descompactar fora do Windows.
    name: relative(buildDir, path).split(sep).join("/"),
    data: readFileSync(path),
    mtime: statSync(path).mtime
  }))
  // Ordem estavel: dois empacotamentos da mesma build saem iguais.
  .sort((a, b) => a.name.localeCompare(b.name));

const { version } = JSON.parse(readFileSync(resolve(buildDir, "manifest.json"), "utf8"));
const zipPath = resolve(root, "promo-radar-extensao.zip");
const archive = createZip(entries);

// Sobrescreve por completo: reempacotar por cima deixaria sobras da build anterior.
writeFileSync(zipPath, archive);

const sizeKb = Math.round(archive.length / 1024);

console.log(
  `\n[32m✓ promo-radar-extensao.zip (versao ${version}, ${entries.length} arquivos, ${sizeKb} KB)[0m`
);
console.log("  Anexe ao release do GitHub para virar o download da versao mais recente.");
