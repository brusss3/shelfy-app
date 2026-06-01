import React, { useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import GoogleButtonUI from './GoogleButtonUI';

// Web: usa il popup di Firebase (signInWithPopup). Nessuna dipendenza nativa.
export default function GoogleAuthButton() {
  const { signInWithGoogleWeb } = useAuth();
  const [loading, setLoading] = useState(false);

  const onPress = async () => {
    setLoading(true);
    try {
      await signInWithGoogleWeb();
    } catch (e: any) {
      const msg = 'Accesso con Google non riuscito. Riprova.';
      if (Platform.OS === 'web') { if (e?.code !== 'auth/popup-closed-by-user') alert(msg); }
    } finally {
      setLoading(false);
    }
  };

  return <GoogleButtonUI onPress={onPress} loading={loading} />;
}
