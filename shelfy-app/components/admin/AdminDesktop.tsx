import type { AdminData } from './useAdminData';

// Segnaposto nativo: la dashboard desktop (con i grafici Recharts) esiste solo
// su web, in AdminDesktop.web.tsx. Metro sceglie quel file per il bundle web e
// questo per Android/iOS, così Recharts non entra mai nell'app nativa.
export function AdminDesktop(_props: { data: AdminData }) {
  return null;
}
