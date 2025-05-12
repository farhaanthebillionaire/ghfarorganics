'use client';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { FloatingIconsBackground } from '@/components/layout/FloatingIconsBackground';
import Link from 'next/link';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

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
        <div className="flex min-h-screen w-full flex-col bg-background relative">
          <FloatingIconsBackground />
          <AppHeader />
          <div className="flex flex-1 overflow-hidden">
            <AppSidebar />
            <main className="flex-1 flex flex-col overflow-y-auto w-full"> 
              <div className="flex-grow w-full relative z-10"> {/* Ensure content is above background */}
                {children}
              </div>
              <footer className="p-4 text-center text-sm text-muted-foreground border-t border-border relative z-10 bg-background">
                Website created by{' '}
                <Link
                  href="https://www.instagram.com/farhaanthebillionaire/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Shaik Mohammed Farhaan
                </Link>
              </footer>
            </main>
          </div>
        </div>
    </SidebarProvider>
  );
}
