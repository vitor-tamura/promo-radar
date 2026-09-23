/**
 * Recorte do expo-notifications para o app web.
 *
 * O notificationService desvia para a Notification API do proprio navegador
 * quando Platform.OS e "web", entao nada aqui chega a ser chamado. O modulo
 * existe porque o import e estatico e o pacote de verdade depende do runtime
 * nativo do Expo, ausente no navegador.
 *
 * As assinaturas acompanham as chamadas do app, e nao o pacote inteiro: e o que
 * faz a checagem de tipos do app web valer alguma coisa. Se uma chamada mudar de
 * forma e este recorte nao acompanhar, o typecheck avisa em vez de a troca
 * quebrar calada no bundle.
 */

type NotificationHandler = {
  handleNotification: () => Promise<unknown>;
};

export const setNotificationHandler = (_handler: NotificationHandler) => undefined;

export const setNotificationChannelAsync = async (
  _channelId: string,
  _channel: Record<string, unknown>
) => undefined;

export const getPermissionsAsync = async () => ({ status: "granted" as const });

export const requestPermissionsAsync = async () => ({ status: "granted" as const });

export const AndroidImportance = { MAX: 5 } as const;

export const AndroidNotificationPriority = { MAX: "max" } as const;

export const scheduleNotificationAsync = async (_request: Record<string, unknown>) => "";
