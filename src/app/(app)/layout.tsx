import { BottomNav } from '@/components/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-16">
      <main className="max-w-4xl mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
