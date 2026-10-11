import { useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

// Componente "headless": salva la lingua in uso in users/{uid}.language, così
// le notifiche inviate dal server (promemoria di scadenza sul web) arrivano
// nella lingua dell'utente e non sempre in italiano.
export default function LanguageSync() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const uid = user?.uid;
  const lang = i18n.language;

  useEffect(() => {
    if (!uid || !lang) return;
    setDoc(doc(db, 'users', uid), { language: lang }, { merge: true }).catch(() => {});
  }, [uid, lang]);

  return null;
}
