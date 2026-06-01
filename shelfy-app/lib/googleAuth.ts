import Constants from 'expo-constants';

// OAuth Client ID di Google. Vanno creati nella Google Cloud Console del
// progetto Firebase (shelfy-632e0) e inseriti in app.json → extra.googleAuth.
// - web:     "Web application" client ID (usato anche da Firebase per il web)
// - ios:     "iOS" client ID (bundle com.shelfy.sheflyapp)
// - android: "Android" client ID (package com.shelfy.sheflyapp + SHA-1)
const extra = (Constants.expoConfig?.extra as any)?.googleAuth ?? {};

export const GOOGLE_CLIENT_IDS = {
  web: (extra.webClientId as string) ?? '',
  ios: (extra.iosClientId as string) ?? '',
  android: (extra.androidClientId as string) ?? '',
};

// Su nativo il login Google è disponibile solo se almeno un client ID è configurato.
export const googleNativeConfigured =
  !!GOOGLE_CLIENT_IDS.ios || !!GOOGLE_CLIENT_IDS.android || !!GOOGLE_CLIENT_IDS.web;
