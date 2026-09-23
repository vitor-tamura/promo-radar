import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, Text, TextInput, View } from "react-native";
import { Deal } from "../types";
import { createThemedStyles, useNative, usePalette } from "./theme";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Mesma regra da varredura dirigida: todas as palavras do termo precisam estar
 * no anuncio, em qualquer ordem. Assim o que voce ve enquanto digita e o mesmo
 * recorte que a busca traria se fosse ate as fontes.
 */
export const matchesQuery = (deal: Deal, query: string) => {
  const words = normalize(query).split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return true;
  }

  const searchable = normalize(`${deal.title} ${deal.store} ${deal.category}`);
  return words.every((word) => searchable.includes(word));
};

export const filterByQuery = (deals: Deal[], query: string) =>
  query.trim() ? deals.filter((deal) => matchesQuery(deal, query)) : deals;

/** Lupa desenhada com Views: um circulo e o cabo, sem dependencia de icones. */
function MagnifierIcon({ tint }: { tint: string }) {
  const styles = useStyles();

  return (
    <View style={styles.icon}>
      <View style={[styles.iconLens, { borderColor: tint }]} />
      <View style={[styles.iconHandle, { backgroundColor: tint }]} />
    </View>
  );
}

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  /** Dispara a varredura dirigida ao produto digitado. */
  onSubmit: () => void;
  onClear: () => void;
  busy: boolean;
};

/**
 * Campo de busca do feed. Enquanto voce digita ele recorta o que ja esta na tela;
 * ao enviar, manda as fontes procurarem aquele produto especifico.
 */
export function SearchBar({ value, onChangeText, onSubmit, onClear, busy }: Props) {
  const styles = useStyles();
  const palette = usePalette();

  const hasText = value.trim().length > 0;
  const press = useRef(new Animated.Value(1)).current;

  const animatePress = (toValue: number) => {
    Animated.spring(press, { toValue, useNativeDriver: useNative, speed: 40, bounciness: 0 }).start();
  };

  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <MagnifierIcon tint={hasText ? palette.ink : palette.muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder="Buscar um produto"
          placeholderTextColor={palette.muted}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Buscar um produto"
          // submit vale no navegador; o onSubmitEditing cobre o teclado do celular.
          enterKeyHint="search"
        />
        {hasText ? (
          <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Limpar busca">
            <Text style={styles.clear}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <Animated.View style={{ transform: [{ scale: press }] }}>
        <Pressable
          style={[styles.action, (!hasText || busy) && styles.actionOff]}
          onPress={onSubmit}
          onPressIn={() => animatePress(0.95)}
          onPressOut={() => animatePress(1)}
          disabled={!hasText || busy}
          accessibilityRole="button"
          accessibilityLabel="Varrer promocoes deste produto"
        >
          {busy ? (
            <ActivityIndicator color={palette.onSelected} size="small" />
          ) : (
            <MagnifierIcon tint={hasText ? palette.onSelected : palette.muted} />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Faixa que avisa que o feed na tela e o resultado de uma busca, nao o radar. */
export function SearchBanner({
  term,
  count,
  onDismiss
}: {
  term: string;
  count: number;
  onDismiss: () => void;
}) {
  const styles = useStyles();

  return (
    <View style={styles.banner}>
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle} numberOfLines={1}>
          {count} {count === 1 ? "oferta" : "ofertas"} para "{term}"
        </Text>
        <Text style={styles.bannerHint} numberOfLines={1}>
          Varredura dirigida, sem filtro de faixa de desconto.
        </Text>
      </View>
      <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button">
        <Text style={styles.bannerAction}>Voltar ao radar</Text>
      </Pressable>
    </View>
  );
}

const FIELD_HEIGHT = 38;

const useStyles = createThemedStyles((palette) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10
  },
  field: {
    flex: 1,
    minWidth: 0,
    height: FIELD_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: FIELD_HEIGHT / 2,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: palette.ink
  },
  clear: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "700",
    color: palette.muted
  },
  action: {
    width: FIELD_HEIGHT,
    height: FIELD_HEIGHT,
    borderRadius: FIELD_HEIGHT / 2,
    backgroundColor: palette.selected,
    alignItems: "center",
    justifyContent: "center"
  },
  actionOff: {
    backgroundColor: palette.track
  },
  icon: {
    width: 15,
    height: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  iconLens: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.6,
    // O cabo sai do canto inferior direito; a lente sobe um fio para caber.
    marginBottom: 3,
    marginRight: 3
  },
  iconHandle: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 6,
    height: 1.8,
    borderRadius: 1,
    transform: [{ rotate: "45deg" }]
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: palette.infoSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  bannerText: {
    flex: 1,
    minWidth: 0
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.ink
  },
  bannerHint: {
    fontSize: 11,
    color: palette.inkSoft
  },
  bannerAction: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.info
  }
}));
