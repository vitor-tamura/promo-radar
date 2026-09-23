# Promo Radar

Radar de promocao, cupom e erro de preco nas lojas brasileiras. Varre agregadores
(Buscape, Zoom), busca direto na Amazon e no KaBuM, le a vitrine de ofertas do
Mercado Livre, acompanha a curadoria do Promobit, compara com o historico de
precos do proprio aparelho e avisa quando aparece uma queda fora do padrao.

O mesmo codigo roda em tres lugares: aplicativo Android, extensao do Chrome e
aplicativo web publicado na Vercel. O que muda entre eles fica em `src/platform/`
e nos adaptadores de armazenamento e notificacao; a camada de servicos e a
interface sao as mesmas.

## Como a busca funciona

Cada termo em **Alertas › O que buscar** vira uma consulta em todas as fontes que
sabem buscar por palavra. Nao ha recorte nos primeiros termos: a lista inteira
roda, e o unico teto (24 termos) existe para uma lista colada sem querer nao
virar centenas de requisicoes. Quanto mais termos, mais longa a varredura.

Duas fontes nao aceitam termo de busca e entram por categoria, escolhida a partir
das suas tags: a vitrine de ofertas do Mercado Livre, que bloqueia a leitura da
busca por palavra, e as secoes do Promobit, que trazem a garimpagem da
comunidade. O Promobit tambem atende tag por tag, pela mesma API que a busca do
site usa.

A **lupa**, no topo do radar, faz as duas coisas: enquanto voce digita, recorta o
que ja esta na tela; ao enviar, dispara uma varredura dirigida aquele produto.
Nessa varredura nada entra sem casar com todas as palavras do termo — nem a
curadoria, que no feed normal passa direto — e as faixas de desconto nao se
aplicam: se voce pediu o produto, voce quer ver o que existe dele. O resultado
fica ao lado do feed, e "Voltar ao radar" devolve a lista de antes.

## Tema claro e escuro

Por padrao o app acompanha o aparelho. Em **Alertas › Aparencia** da para fixar
claro ou escuro, e a escolha vale nos tres alvos, guardada junto com as outras
preferencias.

O tema escuro nao e o claro invertido. Sobre fundo escuro o acento precisa
clarear para manter contraste, os tons "soft" deixam de ser pastel e viram fundos
escuros saturados, e o texto nunca chega ao branco puro, que vibra. Por isso
`src/ui/theme.ts` nomeia as cores por papel — `selected` e `onSelected` para a
pilula ativa, `onAccent` para texto sobre o botao verde — em vez de por aparencia.
A pilula ativa e o caso que obriga a isso: no claro ela e um retangulo quase preto
com texto branco, e reaproveitar `ink` ali funcionava enquanto so existia um tema;
no escuro `ink` e a cor do texto, e usa-la como fundo daria pilula branca com
texto branco.

As folhas de estilo sao montadas uma vez por tema, na carga do modulo, via
`createThemedStyles`. O `StyleSheet.create` congela as cores no momento em que
roda, entao uma folha so nunca acompanharia a troca; com as duas prontas, trocar
de tema nao recria estilo nenhum.

Fora do app, cada alvo precisa pintar o que e dele antes do bundle desenhar,
senao a tela pisca branca ao abrir no escuro: o popup da extensao tem
`prefers-color-scheme` no proprio HTML, o app web tem o mesmo no `globals.css` e,
assim que monta, reescreve `data-theme` e a meta `theme-color` com o tema que
estiver valendo — inclusive um fixado contra o sistema.

## Aplicativo web (Vercel)

`web/` e um app Next que serve a mesma interface do aplicativo: nada de
reescrita, o `App.tsx` e o `src/` da raiz sao importados de la e os componentes
do react-native viram DOM pelo react-native-web.

```bash
npm run web         # desenvolvimento em http://localhost:3000
npm run web:build   # build de producao
```

### Por que a build instala a raiz junto

O `web/vercel.json` manda instalar as duas arvores —
`npm install --prefix .. && npm install` — e isso nao e redundancia. Um import sem
caminho dentro de `App.tsx` e procurado subindo a arvore a partir da raiz do
projeto, onde `web/node_modules` nunca aparece: instalar so `web/` deixa a
interface compartilhada sem nada para resolver, e a build para em
`Module not found: Can't resolve 'react-native'`. Na maquina de quem desenvolve o
erro nao aparece, porque a raiz tambem tem um `node_modules` instalado.

O `next.config.mjs` ainda declara `web/node_modules` em `resolve.modules` e usa
caminhos absolutos nos alias, para o empacotamento nao depender de onde esta o
arquivo que importou. Quem realmente precisa da raiz instalada e a checagem de
tipos, que resolve modulos por conta propria e nao enxerga alias de empacotador.

### Manter a versao do Next em dia

A Vercel recusa publicar uma versao do Next com falha de seguranca conhecida, com
a mensagem `Vulnerable version of Next.js detected`. Antes de um deploy, vale
rodar `npm audit` dentro de `web/` e subir a versao se aparecer algo.

O projeto fica na linha **15.5** de proposito. O `latest` do Next ja e 16, mas la
o Turbopack e o empacotador padrao do build, e ele ignora a funcao `webpack()` do
`next.config.mjs` — que e justamente o que resolve react-native para
react-native-web. Migrar exige reescrever aquele bloco em `turbopack.resolveAlias`,
e `resolve.modules` nao tem equivalente direto. Enquanto isso nao for feito,
atualize dentro da 15.5, onde as correcoes de seguranca continuam saindo.

O `overrides` no `package.json` e do mesmo assunto: `postcss` e `sharp` entram
como dependencias do proprio Next, presas a versoes com falha conhecida, e o
override destrava as corrigidas. Nenhum dos dois e usado em tempo de execucao
aqui — o app nao usa `next/image`, e as imagens dos anuncios sao `<img>` comum —
mas deixar vulnerabilidade conhecida no projeto so torna o proximo `npm audit`
inutil, porque ninguem le uma lista que sempre tem ruido.

### O proxy, e por que ele muda tudo

No navegador a politica de origem barra o acesso direto as lojas, e sem servidor
proprio o app cai num leitor publico que cobra dezenas de segundos por pagina,
com Amazon e KaBuM fora do alcance. Publicado na Vercel, a rota `/api/fetch`
repete a busca do lado do servidor, onde essa politica nao existe: o app web
alcanca exatamente as mesmas fontes que a extensao, na mesma velocidade.

A rota so aceita GET para os dominios que o radar consulta. Sem essa lista o seu
deploy viraria um proxy aberto, que qualquer um na internet poderia apontar para
onde quisesse usando o seu dominio como fachada.

### Instalar no celular

O app traz manifesto e service worker: em **Adicionar a tela de inicio** ele
instala como aplicativo, abre em tela cheia sem barra de endereco e, sem sinal,
ainda mostra o feed da ultima varredura. O historico de precos e as preferencias
ficam no armazenamento do navegador, presos aquela origem — trocar de dominio
equivale a comecar do zero.

O aviso de oferta tambem sai pelo service worker, e nao pela Notification API da
pagina: no Android o Chrome proibe `new Notification(...)` — o construtor lanca
"Illegal constructor" — porque um aviso preso a uma aba nao sobrevive a ela. O
mesmo caminho funciona no desktop, entao vale em todo lugar, e o clique e tratado
dentro do worker, que continua vivo com a pagina fechada.

O service worker so e registrado em producao. Ele serve o que esta em
`/_next/static/` direto do cache, o que e seguro porque o build poe um hash no
nome de cada arquivo; em desenvolvimento o Next serve `page.js` sem hash, e a
mesma regra congelaria a primeira versao carregada — nenhuma alteracao apareceria
mais no navegador. Em modo de desenvolvimento o app remove qualquer worker que ja
esteja instalado naquela origem, para quem rodou uma build de producao antes nao
ficar preso.

## Extensao do Chrome

### Instalar sem clonar o projeto

**[Baixar promo-radar-extensao.zip](https://github.com/vitorakio/promo-radar/releases/latest/download/promo-radar-extensao.zip)**
— nao precisa de Node nem de build.

1. Descompacte numa pasta definitiva, por exemplo
   `~/.local/share/promo-radar/extension` (Windows: `%LOCALAPPDATA%\PromoRadar\extension`).
2. Abra `chrome://extensions` e ligue o **modo desenvolvedor**, no canto superior direito.
3. **Carregar sem compactacao** › selecione a pasta onde descompactou.

> **Escolha bem a pasta e nao mova depois.** O Chrome deriva o id da extensao do
> caminho absoluto dela, e o id e a identidade do armazenamento: mudar de lugar
> equivale a instalar outra extensao, com historico de precos, preferencias e
> feed zerados.

Para atualizar, baixe o ZIP novo, substitua o conteudo **da mesma pasta** e
clique em atualizar no card da extensao.

### Instalar a partir do codigo

```bash
npm run extension:install
```

Compila e copia para `~/.local/share/promo-radar/extension`, mesma pasta acima.
Instale de la, e nao de `dist-extension/`, que e recriado do zero a cada build:
apontar o Chrome para ele faz a extensao sumir da lista durante qualquer rebuild.
O diretorio de instalacao so tem o conteudo trocado, entao o id se mantem.

O que a extensao faz alem do app web:

- **Varre com o navegador fechado.** Um service worker acorda por `chrome.alarms`
  no intervalo escolhido em Alertas, varre, avisa e escreve o contador no icone.
- **Alcanca as lojas que o navegador bloqueia.** As permissoes de host do
  manifesto liberam o acesso direto a Amazon e ao KaBuM, que numa pagina comum
  ficariam de fora por politica de origem. O app publicado na Vercel chega no
  mesmo lugar por outro caminho, buscando pelo servidor; quem fica para tras e
  so o app web servido sem servidor proprio, que depende do leitor publico.
- **Popup e aba.** O icone abre um popup de 420x600; o menu tem "Abrir em aba"
  para quando a lista cresce.
- **Botao do meio abre por tras.** Clicar numa oferta com a rodinha do mouse abre
  a loja numa aba de fundo, sem tirar o foco — e o popup, que morre assim que
  perde o foco, continua aberto. Da para marcar varias ofertas em sequencia e ver
  depois, em vez de reabrir o popup a cada uma.

Popup e service worker compartilham o mesmo `chrome.storage.local`, entao o feed
que aparece ao abrir o popup e o da ultima varredura de segundo plano.

A busca tambem fica guardada ali, e nao na memoria da pagina. O popup e destruido
toda vez que perde o foco, e sem isso voltar a ele significaria digitar o termo de
novo e esperar outra varredura dirigida — justamente o trabalho que a busca
acabou de fazer. Guardado, o popup reabre onde estava, e a aba expandida enxerga a
mesma busca, porque as duas superficies leem o mesmo armazenamento. O termo
digitado nao envelhece; o resultado da varredura, sim, e depois de seis horas ele
e descartado por descrever precos que ja mudaram, deixando o termo pronto para ser
disparado de novo.

### Como o ZIP e montado

```bash
npm run extension:zip   # gera promo-radar-extensao.zip
```

O manifesto herda a `version` do `package.json`, e o ZIP nao e versionado no git.

O arquivo e montado por `scripts/zip.mjs`, escrito a mao, sem depender de
ferramenta do sistema. Nenhuma serve nos tres lugares onde o projeto e
empacotado: o `zip` nao vem no Windows, e o `Compress-Archive` do PowerShell 5.1,
que vem, grava os caminhos com barra invertida. A especificacao do ZIP pede barra
normal, e quem descompactasse fora do Windows receberia arquivos chamados
`bundle\static\js\...` em vez de pastas — uma extensao que nao carrega, e so para
quem baixou.

## APK Android

Precisa de JDK 17 e do Android SDK (com `ANDROID_HOME` apontando para ele).

```bash
npm run apk
```

Gera `dist-apk/promo-radar-<versao>.apk`, assinado e pronto para instalar:

```bash
adb install -r dist-apk/promo-radar-0.1.0.apk
```

### Chave de assinatura

O APK e assinado com a chave descrita no `.env` da raiz do projeto. O `.env` e o
`.keystore` ficam fora do controle de versao.

> **Guarde os dois.** O Android recusa atualizar um app instalado se a assinatura
> mudar: sem essa chave, a unica saida e desinstalar e reinstalar, perdendo o
> historico de precos e as preferencias. Guarde tambem uma copia das senhas fora
> do projeto, num gerenciador de senhas.

Para criar uma chave nova (em outra maquina, por exemplo):

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore promo-radar-release.keystore \
  -alias promo-radar -keyalg RSA -keysize 2048 -validity 10000
```

E entao copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

```properties
PROMO_KEYSTORE_FILE=promo-radar-release.keystore
PROMO_KEYSTORE_PASSWORD=...
PROMO_KEY_ALIAS=promo-radar
PROMO_KEY_PASSWORD=...
```

Sem essas variaveis o `npm run apk` para antes de compilar, em vez de entregar um
APK assinado com a chave de depuracao — que instala, mas nao atualiza o app de
ninguem.

Numa esteira de publicacao, defina as mesmas variaveis como segredos do ambiente
e nao escreva `.env` nenhum: o Gradle le a variavel de ambiente primeiro e so cai
no arquivo quando ela nao existe. Uma copia a menos no disco e uma copia a menos
para vazar.

> Ate a versao 0.1.0 essas credenciais ficavam em `keystore.properties`. Se voce
> tem esse arquivo de antes, mova os quatro valores para o `.env` com os nomes
> acima; o formato antigo nao e mais lido.

### Sobre o diretorio `android/`

E gerado por `npx expo prebuild` e nao versionado: a configuracao de verdade esta
em `app.json` e em `plugins/`. O plugin `withReleaseSigning` reinjeta a assinatura
de release a cada prebuild, porque o template do React Native assina o release com
a chave publica de depuracao.

## Segredos

O projeto tem **um** segredo: a chave que assina o APK. As fontes que o radar
consulta sao paginas e APIs publicas, sem autenticacao — nao ha chave de API a
guardar, e nenhuma credencial nunca entrou no historico do git.

Tudo que for sensivel vai para o `.env` da raiz, que o `.gitignore` bloqueia junto
com qualquer `.env.*`. O unico que sobe e o `.env.example`, que lista os nomes das
variaveis sem valor nenhum e serve de modelo:

```bash
cp .env.example .env
```

> **Cuidado com os prefixos publicos.** O Expo injeta no pacote do aplicativo toda
> variavel do `.env` que comece com `EXPO_PUBLIC_`, e o Next faz o mesmo com
> `NEXT_PUBLIC_`. Uma vez embutida, ela esta no aparelho de quem instalou e no
> JavaScript que o navegador baixa: e configuracao publica, nunca segredo. Um
> segredo de verdade so pode ser lido onde o codigo nao e entregue ao usuario —
> no build, como a chave de assinatura, ou numa funcao de servidor.

## Desenvolvimento

```bash
npm start              # Metro, para o aplicativo
npm run expo:web       # preview web pelo Expo, que e o que a extensao empacota
npm run typecheck      # tsc --noEmit (raiz)
npm run web:typecheck  # tsc --noEmit (app Next; precisa de npm install em web/)
npm run icons          # regera os icones a partir de scripts/generate-icons.py
```

O app Next tem o proprio `package.json` e o proprio `node_modules`, com copias de
react e react-dom. O Metro ignora `web/node_modules` pela blockList em
`metro.config.js`: sem isso ele trataria as copias como pacotes duplicados e as
builds do aplicativo e da extensao parariam de resolver.

## Estrutura

```
App.tsx                    interface principal
src/services/              varredura, classificacao, notificacao, impostos
src/services/providers/    um modulo por fonte (Buscape, Zoom, Amazon, KaBuM,
                           Mercado Livre, Promobit)
src/storage/               preferencias, historico de precos e cache do feed
src/platform/extension.ts  ponte com as APIs do Chrome (inerte fora da extensao)
extension/                 manifesto, service worker e adaptadores da extensao
web/                       app Next publicado na Vercel: casca, proxy e PWA
plugins/                   config plugins do Expo aplicados no prebuild
scripts/                   builds da extensao e do APK, geracao de icones
```
