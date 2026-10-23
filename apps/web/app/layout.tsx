import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = { title: 'DAZA Atendimento', description: 'Central de agentes de atendimento' };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
