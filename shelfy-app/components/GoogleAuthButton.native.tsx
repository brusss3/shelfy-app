import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { GOOGLE_CLIENT_IDS, googleNativeConfigured } from '@/lib/googleAuth';
import GoogleButtonUI from './GoogleButtonUI';

// Flusso nativo Google (niente browser/redirect/custom scheme).
// require per non rompere il build prima di installare il pacchetto.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin');

GoogleSignin.configure({
  // webClientId: necessario per ottenere l'idToken da passare a Firebase.
  webClientId: GOOGLE_CLIENT_IDS.web || undefined,
  iosClientId: GOOGLE_CLIENT_IDS.ios || undefined,
  offlineAccess: false,
});

export default function GoogleAuthButton() {
  const { signInWithGoogleCredential } = useAuth();
  const [loading, setLoading] = useState(false);

  const onPress = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res = await GoogleSignin.signIn();

      // L'idToken cambia posizione tra le versioni del pacchetto.
      let idToken: string | undefined = res?.idToken ?? res?.data?.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken;
      }
      if (!idToken) throw new Error('idToken mancante');

      await signInWithGoogleCredential(idToken);
    } catch (e: any) {
      const code = e?.code;
      if (code !== statusCodes?.SIGN_IN_CANCELLED && code !== statusCodes?.IN_PROGRESS) {
        Alert.alert('Errore', 'Accesso con Google non riuscito. Riprova.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!googleNativeConfigured) return null;

  return <GoogleButtonUI onPress={onPress} loading={loading} />;
}
