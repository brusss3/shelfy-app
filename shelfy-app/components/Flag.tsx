import React from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

// Bandiere disegnate in SVG: l'emoji 🇮🇹 non esiste su Windows (mostra solo
// "IT"), quindi sul web non si può contare sul font.
export type FlagCode = 'it' | 'en' | 'es';

function FlagArt({ code }: { code: FlagCode }) {
  if (code === 'it') {
    return (
      <>
        <Rect width="3" height="2" fill="#ce2b37" />
        <Rect width="2" height="2" fill="#ffffff" />
        <Rect width="1" height="2" fill="#009246" />
      </>
    );
  }
  if (code === 'es') {
    return (
      <>
        <Rect width="3" height="2" fill="#aa151b" />
        <Rect y="0.5" width="3" height="1" fill="#f1bf00" />
      </>
    );
  }
  // Regno Unito (inglese)
  return (
    <>
      <Defs>
        <ClipPath id="gbClip"><Path d="M0,0 v30 h60 v-30 z" /></ClipPath>
        <ClipPath id="gbCross"><Path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></ClipPath>
      </Defs>
    </>
  );
}

export default function Flag({ code, width = 28 }: { code: FlagCode; width?: number }) {
  const height = Math.round(width * (code === 'en' ? 0.5 : 2 / 3));
  return (
    <View style={{ width, height, borderRadius: 4, overflow: 'hidden' }}>
      {code === 'en' ? (
        <Svg width={width} height={height} viewBox="0 0 60 30">
          <FlagArt code="en" />
          <G clipPath="url(#gbClip)">
            <Path d="M0,0 v30 h60 v-30 z" fill="#012169" />
            <Path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
            <Path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#gbCross)" stroke="#c8102e" strokeWidth="4" />
            <Path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10" />
            <Path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
          </G>
        </Svg>
      ) : (
        <Svg width={width} height={height} viewBox="0 0 3 2" preserveAspectRatio="none">
          <FlagArt code={code} />
        </Svg>
      )}
    </View>
  );
}
