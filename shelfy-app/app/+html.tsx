import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Shell HTML statico per il target web (usato solo in build/export web, non
// influisce su iOS/Android). Estende il default di expo-router per
// aggiungere manifest.json e apple-touch-icon: senza questi tag nel <head>
// il browser non li trova mai (anche se i file esistono), quindi "Aggiungi
// a Home" su Android/iOS finiva per usare un'icona generica invece di
// quella di Shelfy.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="it">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#2f4a31" />

        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />

        {/* iOS Safari ignora spesso le icone del manifest: l'apple-touch-icon
            è il modo affidabile per avere l'icona giusta in "Aggiungi a Home". */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Shelfy" />
        <meta name="mobile-web-app-capable" content="yes" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
