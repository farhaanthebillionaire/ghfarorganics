'use client';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
       <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
        {/* Outermost container: Min viewport height, allows scrolling if content overflows, establishes flex column for header and body-content */}
        <div className="flex min-h-screen w-full flex-col bg-background">
          <AppHeader />
          {/* Container for sidebar and main content: Takes remaining height, establishes flex row. Added overflow-hidden. */}
          <div className="flex flex-1 overflow-hidden"> 
            <AppSidebar />
            {/* Main content area: Takes available width in flex row. Scrollable if content overflows. */}
            <main className="flex-1 flex flex-col overflow-y-auto w-full"> 
              {/* Inner div to ensure content within main can grow and utilize full width */}
              <div className="flex-grow w-full">
                {children}
              </div>
            </main>
          </div>
        </div>
    </SidebarProvider>
  );
}
