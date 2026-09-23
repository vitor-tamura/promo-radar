/**
 * Gera o APK de release assinado.
 *
 * O prebuild recria o diretorio android/ a partir do app.json e dos plugins, o
 * que mantem o projeto nativo descartavel: a fonte da verdade continua sendo a
 * configuracao do Expo. Depois o Gradle compila e assina com a chave descrita no
 * .env da raiz, ou nas variaveis de ambiente equivalentes.
 *
 * Saida: dist-apk/promo-radar-<versao>.apk
 */

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "dist-apk");

/**
 * No Windows os executaveis do npm sao arquivos .cmd, que so rodam pelo
 * interpretador de comandos: desde o Node 22 o execFile se recusa a abri-los
 * direto. Por isso a chamada vai montada como linha de comando, com cada
 * argumento entre aspas para sobreviver a um caminho com espaco. O comando em si
 * fica sem aspas, que e como o cmd.exe acha o .cmd. Argumentos todos literais.
 */
const quote = (value) => `"${String(value).replace(/"/g, String.raw`\"`)}"`;

const run = (command, args, cwd = root) =>
  execSync([command, ...args.map(quote)].join(" "), { cwd, stdio: "inherit" });

const step = (message) => console.log(`\n[36m▸ ${message}[0m`);

const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

/**
 * A chave que assina o release vem do ambiente ou do .env da raiz, na mesma ordem
 * que o Gradle usa. Conferir antes evita descobrir a falta depois de alguns
 * minutos de compilacao, com um APK assinado pela chave de depuracao na mao.
 */
const signingKeyConfigured = () => {
  if (process.env.PROMO_KEYSTORE_FILE) {
    return true;
  }

  const envFile = resolve(root, ".env");

  return (
    existsSync(envFile) && /^\s*PROMO_KEYSTORE_FILE\s*=\s*\S/m.test(readFileSync(envFile, "utf8"))
  );
};

if (!signingKeyConfigured()) {
  console.warn(
    "[33m⚠ Chave de assinatura nao configurada: o APK sairia assinado com a chave de\n" +
      "  depuracao, que nao serve para distribuir nem para atualizar um app ja instalado.\n" +
      "  Copie .env.example para .env e preencha, ou defina PROMO_KEYSTORE_FILE e as\n" +
      "  senhas como variaveis de ambiente. Veja README.md.[0m"
  );
  process.exit(1);
}

step("Sincronizando o projeto nativo (expo prebuild)");
run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"]);

step("Compilando o APK de release");
run("./gradlew", ["assembleRelease"], resolve(root, "android"));

step("Publicando o artefato");
mkdirSync(outDir, { recursive: true });
const apkName = `promo-radar-${version}.apk`;
copyFileSync(
  resolve(root, "android/app/build/outputs/apk/release/app-release.apk"),
  resolve(outDir, apkName)
);

console.log(`\n[32m✓ APK pronto em dist-apk/${apkName}[0m`);
console.log("  Instale com: adb install -r dist-apk/" + apkName);
