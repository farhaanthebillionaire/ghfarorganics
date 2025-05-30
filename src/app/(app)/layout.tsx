'use client';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
// import { FloatingIconsBackground } from '@/components/layout/FloatingIconsBackground'; // Removed

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
        {/* <FloatingIconsBackground /> */} {/* Removed */}
        <div className="flex min-h-screen w-full flex-col bg-background relative z-0"> {/* Added relative and z-0 if background were present */}
          <AppHeader />
          <div className="flex flex-1 overflow-hidden"> 
            <AppSidebar />
            <main className="flex-1 flex flex-col overflow-y-auto w-full"> 
              <div className="flex-grow w-full p-4 md:p-6"> {/* Added default padding */}
                {children}
              </div>
            </main>
          </div>
        </div>
    </SidebarProvider>
  );
}
