// Anchor per TypeScript. A runtime Metro preferisce GoogleAuthButton.web.tsx
// (web) e GoogleAuthButton.native.tsx (iOS/Android); questo file non viene mai
// caricato sui dispositivi ma dà a tsc un modulo da risolvere.
export { default } from './GoogleAuthButton.web';
