const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Assina a build de release com a chave do projeto.
 *
 * O template do React Native assina o release com a keystore de depuracao, que e
 * publica e igual em toda maquina: o Android recusa atualizar um app instalado se
 * a assinatura mudar, entao um APK de debug nao serve para distribuir.
 *
 * Este plugin roda a cada prebuild, que reescreve o diretorio android/ inteiro.
 * As credenciais vem do ambiente ou do .env na raiz do projeto, os dois fora do
 * que e gerado e fora do controle de versao; sem elas o build continua com a
 * chave de depuracao, para quem so quer compilar e testar nao precisar de uma.
 *
 * A variavel de ambiente vence o arquivo de proposito: numa esteira de publicacao
 * o segredo chega como variavel, e escrever um .env no disco do runner so criaria
 * uma copia a mais para vazar.
 */

const PROPERTIES_LOADER = `
// Credenciais de assinatura: variavel de ambiente primeiro, depois o .env da raiz
// do projeto. Nenhum dos dois entra no controle de versao.
def promoSigning = new Properties()
def promoSigningFile = rootProject.file("../.env")
if (promoSigningFile.exists()) {
    promoSigningFile.withInputStream { promoSigning.load(it) }
}
// Aspas em volta do valor sao convencao comum de .env e nao fazem parte do segredo.
def promoSecret = { String name ->
    def value = System.getenv(name) ?: promoSigning[name]
    value ? value.toString().trim().replaceAll(/^["']|["']\\$/, '') : null
}
`;

const RELEASE_SIGNING_CONFIG = `        release {
            if (promoSecret('PROMO_KEYSTORE_FILE')) {
                storeFile rootProject.file("../" + promoSecret('PROMO_KEYSTORE_FILE'))
                storePassword promoSecret('PROMO_KEYSTORE_PASSWORD')
                keyAlias promoSecret('PROMO_KEY_ALIAS')
                keyPassword promoSecret('PROMO_KEY_PASSWORD')
            }
        }
`;

const DEBUG_SIGNING_CONFIG = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`;

const TEMPLATE_RELEASE_SIGNING = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const PROJECT_RELEASE_SIGNING = `            // Chave do projeto quando o segredo existe; sem ele, a de depuracao.
            signingConfig promoSecret('PROMO_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug`;

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;

    if (contents.includes("promoSigning")) {
      return gradleConfig;
    }

    if (!contents.includes(DEBUG_SIGNING_CONFIG) || !contents.includes(TEMPLATE_RELEASE_SIGNING)) {
      throw new Error(
        "withReleaseSigning: o build.gradle nao tem o formato esperado do template. " +
          "Confira android/app/build.gradle antes de assinar a release."
      );
    }

    contents = contents.replace(
      'apply plugin: "com.facebook.react"',
      `apply plugin: "com.facebook.react"\n${PROPERTIES_LOADER}`
    );
    contents = contents.replace(DEBUG_SIGNING_CONFIG, DEBUG_SIGNING_CONFIG + RELEASE_SIGNING_CONFIG);
    contents = contents.replace(TEMPLATE_RELEASE_SIGNING, PROJECT_RELEASE_SIGNING);

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });

module.exports = withReleaseSigning;
