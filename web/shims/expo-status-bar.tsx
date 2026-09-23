/**
 * Recorte do expo-status-bar para o app web.
 *
 * A barra de status pertence ao sistema operacional; no navegador quem define a
 * cor da barra e a meta theme-color, declarada no layout. O componente existe
 * porque o App.tsx e o mesmo dos tres alvos e o import e estatico.
 */
export function StatusBar(_props: { style?: "light" | "dark" | "auto" }) {
  return null;
}

export default StatusBar;
