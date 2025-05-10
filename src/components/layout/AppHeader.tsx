
'use client';

import { Button } from '@/components/ui/button';
import { LogOut, Menu } from 'lucide-react'; // Removed UserCircle
import { useAuth } from '@/hooks/useAuth';
import { SHOP_NAME } from '@/lib/constants';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import Image from 'next/image';
import ghflogo from '../../img/ghflogo.png'



export function AppHeader() {
  const { logout } = useAuth();
  const { isMobile } = useSidebar();

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-card px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-4">
        {isMobile && (
          <SidebarTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SidebarTrigger>
        )}
        <div className="flex items-center gap-2">
          <Image src={ghflogo} alt="Shop Logo" width={32} height={32} className="rounded-full" data-ai-hint="organic food logo" />
          <h1 className="text-xl font-semibold text-primary whitespace-nowrap overflow-hidden text-ellipsis">{SHOP_NAME}</h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* <UserCircle className="h-7 w-7 text-muted-foreground" /> UserCircle icon removed */}
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Logout">
          <LogOut className="h-5 w-5 text-destructive" />
        </Button>
      </div>
    </header>
  );
}

