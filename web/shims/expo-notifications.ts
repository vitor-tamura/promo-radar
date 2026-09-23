/**
 * Recorte do expo-notifications para o app web.
 *
 * O notificationService desvia para a Notification API do proprio navegador
 * quando Platform.OS e "web", entao nada aqui chega a ser chamado em producao.
 * O modulo existe porque o import e estatico e o pacote de verdade depende do
 * runtime nativo do Expo, ausente no navegador.
 */

export const setNotificationHandler = () => undefined;

export const setNotificationChannelAsync = async () => undefined;

export const getPermissionsAsync = async () => ({ status: "granted" as const });

export const requestPermissionsAsync = async () => ({ status: "granted" as const });

export const AndroidImportance = { MAX: 5 } as const;

export const AndroidNotificationPriority = { MAX: "max" } as const;

export const scheduleNotificationAsync = async () => "";
