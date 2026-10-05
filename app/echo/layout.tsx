import '@/src/components/echo/echo-shell.css';
import '@/src/components/echo/echo-player.css';
import PageNavigation from '@/src/components/pond-shell/navigation/PageNavigation';

export default function EchoLayout({ children }: { children: React.ReactNode }) {
  return <><PageNavigation />{children}</>;
}
