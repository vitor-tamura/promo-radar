import { createContext, useContext } from "react";
import {
  ImageStyle,
  Platform,
  StyleSheet,
  TextStyle,
  useColorScheme,
  ViewStyle
} from "react-native";
import { ThemeName, ThemePreference } from "../types";

export type { ThemeName, ThemePreference };

/** RN Web nao roda animacoes na thread nativa; evita o aviso em tempo de execucao. */
export const useNative = Platform.OS !== "web";

/**
 * Os dois temas sao escritos por papel, nao por cor.
 *
 * Um tema escuro nao e o claro invertido: sobre fundo escuro o acento precisa
 * clarear para manter contraste, os tons "soft" deixam de ser pastel e viram
 * fundos escuros saturados, e o texto nunca chega ao branco puro, que vibra.
 *
 * O caso que obriga a nomear por papel e a pilula selecionada: no tema claro ela
 * e um retangulo quase preto com texto branco, e reaproveitar "ink" ali
 * funcionava enquanto so existia um tema. No escuro, "ink" e a cor do texto —
 * usa-la como fundo daria uma pilula branca com texto branco. Por isso "selected"
 * e "onSelected" existem separados de "ink" e "surface".
 */
export type Palette = {
  background: string;
  surface: string;
  track: string;
  border: string;

  ink: string;
  inkSoft: string;
  /** Texto sobre painel tingido (accentSoft, infoSoft), onde inkSoft some. */
  inkOnSoft: string;
  /** Nota de rodape, o grau mais apagado que ainda se le. */
  inkFaint: string;
  muted: string;

  /** Fundo da pilula ativa (aba, categoria, ordenacao). */
  selected: string;
  onSelected: string;
  /** Contador dentro da pilula ativa, um grau abaixo do texto. */
  onSelectedSoft: string;

  accent: string;
  accentPressed: string;
  /** Acento como texto, nao como fundo. */
  accentDeep: string;
  accentSoft: string;
  accentBorder: string;
  /** Texto e indicadores sobre o acento cheio. */
  onAccent: string;

  info: string;
  infoSoft: string;

  warn: string;
  warnSoft: string;
  warnBorder: string;
  /** Tres graus do bloco de imposto de importacao, todos sobre warnSoft. */
  taxInk: string;
  taxInkDeep: string;
  taxInkFaint: string;

  coupon: string;
  couponSoft: string;

  danger: string;
  dangerStrong: string;
  dangerSoft: string;

  /** Preco atual: o numero que a tela inteira existe para mostrar. */
  price: string;

  switchOn: string;
  switchOff: string;
  /** Botao do interruptor quando desligado: precisa destacar do proprio trilho. */
  switchThumb: string;
};

const light: Palette = {
  background: "#F7FAF9",
  surface: "#FFFFFF",
  track: "#E8EEF2",
  border: "#E1E8F0",

  ink: "#0B1220",
  inkSoft: "#637083",
  inkOnSoft: "#334155",
  inkFaint: "#526071",
  muted: "#94A3B8",

  selected: "#0B1220",
  onSelected: "#FFFFFF",
  onSelectedSoft: "#93C5AF",

  accent: "#12B981",
  accentPressed: "#0E8F65",
  accentDeep: "#065F46",
  accentSoft: "#D1FAE5",
  accentBorder: "#6EE7B7",
  onAccent: "#FFFFFF",

  info: "#1D4ED8",
  infoSoft: "#DBEAFE",

  warn: "#B45309",
  warnSoft: "#FEF3C7",
  warnBorder: "#FCD34D",
  taxInk: "#92400E",
  taxInkDeep: "#78350F",
  taxInkFaint: "#A16207",

  coupon: "#BE185D",
  couponSoft: "#FCE7F3",

  danger: "#9F1239",
  dangerStrong: "#B91C1C",
  dangerSoft: "#FEE2E2",

  price: "#0F766E",

  switchOn: "#A7F3D0",
  switchOff: "#D8DEE7",
  switchThumb: "#FFFFFF"
};

const dark: Palette = {
  // O fundo escuro e o mesmo azul do texto do tema claro: a marca nao muda de
  // familia, so troca de lado.
  background: "#0B1220",
  surface: "#151D2C",
  track: "#1E2838",
  border: "#27344A",

  ink: "#E9EEF6",
  inkSoft: "#A3B0C2",
  inkOnSoft: "#C6D2E2",
  inkFaint: "#8492A6",
  muted: "#6E7D93",

  // No escuro a pilula ativa vira acento cheio: um retangulo branco brigaria com
  // os cartoes e cansaria numa lista longa.
  selected: "#34D399",
  onSelected: "#052E22",
  onSelectedSoft: "#0B5741",

  accent: "#34D399",
  accentPressed: "#2AB784",
  accentDeep: "#6EE7B7",
  accentSoft: "#10291F",
  accentBorder: "#1C5643",
  onAccent: "#052E22",

  info: "#8AB4FF",
  infoSoft: "#16233C",

  warn: "#FBBF24",
  warnSoft: "#2E230C",
  warnBorder: "#6B5314",
  taxInk: "#FCD34D",
  taxInkDeep: "#E9D8A6",
  taxInkFaint: "#C2A34E",

  coupon: "#F9A8D4",
  couponSoft: "#33132A",

  danger: "#FCA5A5",
  dangerStrong: "#F87171",
  dangerSoft: "#3A1518",

  price: "#5EEAD4",

  switchOn: "#115E48",
  switchOff: "#2A3547",
  // No escuro um botao branco brilha demais, e a cor do cartao sumiria no trilho.
  switchThumb: "#7C8CA3"
};

export const palettes: Record<ThemeName, Palette> = { light, dark };

const ThemeContext = createContext<ThemeName>("light");

export const ThemeProvider = ThemeContext.Provider;

export const useTheme = () => useContext(ThemeContext);

export const usePalette = () => palettes[useTheme()];

/** Resolve a preferencia do app contra o que o sistema do aparelho pede. */
export const useResolvedTheme = (preference: ThemePreference): ThemeName => {
  const system = useColorScheme();

  if (preference !== "system") {
    return preference;
  }

  return system === "dark" ? "dark" : "light";
};

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Folha de estilo com um tema de cada lado.
 *
 * O StyleSheet.create congela as cores no momento em que roda, entao uma folha
 * so nunca acompanharia a troca de tema. Aqui a fabrica roda duas vezes na carga
 * do modulo — as duas folhas ficam prontas — e o componente escolhe qual usar no
 * render. Trocar de tema nao recria estilo nenhum.
 */
export const createThemedStyles = <T extends NamedStyles>(factory: (palette: Palette) => T) => {
  const sheets: Record<ThemeName, T> = {
    light: StyleSheet.create(factory(light)),
    dark: StyleSheet.create(factory(dark))
  };

  /** Dentro de um componente, sob o ThemeProvider. */
  const useStyles = (): T => sheets[useTheme()];

  /**
   * Para quem ja tem o tema em maos e esta acima do provider — o caso do App,
   * que resolve o tema e so entao o oferece ao resto da arvore.
   */
  useStyles.of = (theme: ThemeName): T => sheets[theme];

  return useStyles;
};

export type KindTheme = { label: string; tint: string; soft: string };

const kindThemes: Record<ThemeName, Record<"promo" | "coupon" | "bug", KindTheme>> = {
  light: {
    promo: { label: "Promocao", tint: light.info, soft: light.infoSoft },
    coupon: { label: "Cupom", tint: light.coupon, soft: light.couponSoft },
    bug: { label: "Preco suspeito", tint: light.warn, soft: light.warnSoft }
  },
  dark: {
    promo: { label: "Promocao", tint: dark.info, soft: dark.infoSoft },
    coupon: { label: "Cupom", tint: dark.coupon, soft: dark.couponSoft },
    bug: { label: "Preco suspeito", tint: dark.warn, soft: dark.warnSoft }
  }
};

export const useKindTheme = () => kindThemes[useTheme()];

/**
 * Acerta o documento no navegador.
 *
 * O app desenha a propria tela, mas a pagina por baixo continua sendo do
 * navegador: sem isto, puxar a lista alem do fim revela um fundo branco, e o
 * PWA instalado pinta a barra do sistema com a cor errada. Inerte fora da web.
 */
export const applyDocumentTheme = (theme: ThemeName) => {
  if (typeof document === "undefined") {
    return;
  }

  const palette = palettes[theme];

  document.documentElement.dataset.theme = theme;
  // Diz ao navegador como desenhar o que e dele: barra de rolagem, campos nativos.
  document.documentElement.style.colorScheme = theme;
  document.body.style.backgroundColor = palette.background;

  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", palette.background);
};

export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});
