// Alert.alert di react-native-web è un no-op: su browser non mostra nulla,
// né i messaggi d'errore né le conferme (es. "Elimina prodotto", "Esci").
// showAlert è un sostituto drop-in che su web usa window.alert/window.confirm.
import { Alert, Platform } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const actionBtn = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
  if (window.confirm(text)) actionBtn.onPress?.();
  else cancelBtn?.onPress?.();
}
