const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/**
 * O app web (Next) instala as proprias dependencias em web/node_modules, com
 * copias de react e react-dom. O Metro varre o projeto inteiro e trataria essas
 * copias como pacotes duplicados, quebrando a resolucao das builds do aplicativo
 * e da extensao. Nada ali interessa ao Metro: o Next tem o seu proprio empacotador.
 */
/** O caminho vem com "\" no Windows e "/" no resto; a regex aceita os dois. */
const SEPARATOR = "[\\\\/]";
const escapePath = (value) => value.replace(/[\\/]/g, SEPARATOR).replace(/\./g, "\\.");

const webBuildArtifacts = new RegExp(
  `^${escapePath(path.resolve(__dirname, "web"))}${SEPARATOR}(node_modules|\\.next)${SEPARATOR}`
);

const currentBlockList = config.resolver.blockList;

config.resolver.blockList = [
  ...(Array.isArray(currentBlockList) ? currentBlockList : [currentBlockList].filter(Boolean)),
  webBuildArtifacts
];

/**
 * A interface da extensao e o service worker precisam ler e escrever o mesmo
 * estado. O AsyncStorage web guarda tudo no localStorage, que nao existe dentro
 * de um service worker, entao a build da extensao troca o modulo pelo adaptador
 * de chrome.storage. As demais plataformas seguem com o pacote original.
 */
if (process.env.PROMO_TARGET === "extension") {
  const storageShim = path.resolve(__dirname, "extension/shims/asyncStorage.ts");

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "@react-native-async-storage/async-storage") {
      return { type: "sourceFile", filePath: storageShim };
    }

    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
