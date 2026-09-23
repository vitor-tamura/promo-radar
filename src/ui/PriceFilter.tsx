import { useRef } from "react";
import { Animated, Pressable, Text, TextInput, View } from "react-native";
import { Deal } from "../types";
import { createThemedStyles, useNative, usePalette } from "./theme";

/** Intervalo aberto dos dois lados: sem minimo, sem maximo, ou so um deles. */
export type PriceRange = {
  min?: number;
  max?: number;
};

export const EMPTY_PRICE_RANGE: PriceRange = {};

export const hasPriceRange = (range: PriceRange) =>
  range.min !== undefined || range.max !== undefined;

/** Faixas prontas, para o caso comum nao exigir digitar dois numeros. */
const PRESETS: { label: string; range: PriceRange }[] = [
  { label: "ate R$ 100", range: { max: 100 } },
  { label: "R$ 100 a 300", range: { min: 100, max: 300 } },
  { label: "R$ 300 a 1 mil", range: { min: 300, max: 1000 } },
  { label: "R$ 1 a 3 mil", range: { min: 1000, max: 3000 } },
  { label: "acima de R$ 3 mil", range: { min: 3000 } }
];

const sameRange = (a: PriceRange, b: PriceRange) => a.min === b.min && a.max === b.max;

/**
 * Oferta sem preco proprio — cupom e cashback, que valem no carrinho — nao esta
 * em intervalo nenhum: pedir "de R$ 100 a R$ 300" e pedir coisas que custam
 * isso. Enquanto nao ha filtro de preco elas seguem no feed normalmente.
 */
export const matchesPriceRange = (deal: Deal, range: PriceRange) => {
  if (!hasPriceRange(range)) {
    return true;
  }

  if (deal.price <= 0) {
    return false;
  }

  return (
    (range.min === undefined || deal.price >= range.min) &&
    (range.max === undefined || deal.price <= range.max)
  );
};

export const filterByPrice = (deals: Deal[], range: PriceRange) =>
  hasPriceRange(range) ? deals.filter((deal) => matchesPriceRange(deal, range)) : deals;

/**
 * Valor sem centavos e sem repetir o simbolo: o botao divide a linha com as
 * categorias, e "R$ 1.000,00 a R$ 3.000,00" nao cabe — o texto sai cortado e o
 * limite superior, que e o que interessa, e justamente o que some.
 */
const compact = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Rotulo curto para o botao, que divide a linha com as categorias. */
export const describeRange = (range: PriceRange) => {
  const { min, max } = range;

  if (min !== undefined && max !== undefined) {
    return `R$ ${compact.format(min)} a ${compact.format(max)}`;
  }

  if (max !== undefined) {
    return `ate R$ ${compact.format(max)}`;
  }

  if (min !== undefined) {
    return `de R$ ${compact.format(min)}`;
  }

  return "Preco";
};

/** Aceita "1.299,90", "1299.90" e "1299" — ninguem digita de um jeito so. */
const parseAmount = (value: string): number | undefined => {
  const digits = value.trim().replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const parsed = Number(digits);

  return digits !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

type Props = {
  value: PriceRange;
  onChange: (range: PriceRange) => void;
  open: boolean;
  onToggle: () => void;
};

/** Botao da barra de filtros: mostra o intervalo em vigor e abre o painel. */
export function PriceFilterButton({ value, open, onToggle }: Props) {
  const styles = useStyles();
  const active = hasPriceRange(value);
  const press = useRef(new Animated.Value(1)).current;

  const animatePress = (toValue: number) => {
    Animated.spring(press, { toValue, useNativeDriver: useNative, speed: 40, bounciness: 0 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        style={[styles.button, (active || open) && styles.buttonActive]}
        onPress={onToggle}
        onPressIn={() => animatePress(0.95)}
        onPressOut={() => animatePress(1)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Filtrar por preco"
      >
        <Text
          style={[styles.buttonText, (active || open) && styles.buttonTextActive]}
          numberOfLines={1}
        >
          {describeRange(value)}
        </Text>
        <Text style={[styles.caret, (active || open) && styles.buttonTextActive]}>
          {open ? "⌃" : "⌄"}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Painel do filtro: faixas prontas em cima, intervalo digitado embaixo. */
export function PriceFilterPanel({ value, onChange }: Pick<Props, "value" | "onChange">) {
  const styles = useStyles();
  const palette = usePalette();

  const edit = (field: keyof PriceRange) => (text: string) =>
    onChange({ ...value, [field]: parseAmount(text) });

  return (
    <View style={styles.panel}>
      <View style={styles.presetRow}>
        {PRESETS.map((preset) => {
          const active = sameRange(preset.range, value);

          return (
            <Pressable
              key={preset.label}
              style={[styles.preset, active && styles.presetActive]}
              // Tocar na faixa ja marcada desmarca: e como se desfaz sem digitar.
              onPress={() => onChange(active ? EMPTY_PRICE_RANGE : preset.range)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              aria-checked={active}
            >
              <Text style={[styles.presetText, active && styles.presetTextActive]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.rangeRow}>
        <TextInput
          value={value.min === undefined ? "" : String(value.min)}
          onChangeText={edit("min")}
          placeholder="minimo"
          placeholderTextColor={palette.muted}
          keyboardType="numeric"
          inputMode="decimal"
          style={styles.input}
          accessibilityLabel="Preco minimo"
        />
        <Text style={styles.rangeSeparator}>ate</Text>
        <TextInput
          value={value.max === undefined ? "" : String(value.max)}
          onChangeText={edit("max")}
          placeholder="maximo"
          placeholderTextColor={palette.muted}
          keyboardType="numeric"
          inputMode="decimal"
          style={styles.input}
          accessibilityLabel="Preco maximo"
        />
        {hasPriceRange(value) ? (
          <Pressable onPress={() => onChange(EMPTY_PRICE_RANGE)} hitSlop={8}>
            <Text style={styles.clear}>Limpar</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.hint}>
        Cupom e cashback ficam de fora enquanto houver filtro de preco: o desconto
        deles so aparece no carrinho, entao nao ha valor para comparar.
      </Text>
    </View>
  );
}

const BUTTON_HEIGHT = 34;

const useStyles = createThemedStyles((palette) => ({
  button: {
    height: BUTTON_HEIGHT,
    maxWidth: 150,
    borderRadius: BUTTON_HEIGHT / 2,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10
  },
  buttonActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft
  },
  buttonText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
    color: palette.inkSoft
  },
  buttonTextActive: {
    color: palette.accentDeep
  },
  caret: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.muted
  },
  panel: {
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    gap: 10
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  preset: {
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.background
  },
  presetActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft
  },
  presetText: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.inkSoft
  },
  presetTextActive: {
    color: palette.accentDeep
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.background,
    paddingHorizontal: 10,
    fontSize: 13,
    color: palette.ink
  },
  rangeSeparator: {
    fontSize: 12,
    color: palette.inkSoft
  },
  clear: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.info
  },
  hint: {
    fontSize: 11,
    lineHeight: 15,
    color: palette.muted
  }
}));
