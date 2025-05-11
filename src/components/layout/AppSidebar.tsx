
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Archive,
  ShoppingCart,
  PackageSearch,
  BarChart3,
  LogOut,
  AlertTriangle,
  Warehouse, 
  Receipt, 
  History, 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator
} from "@/components/ui/sidebar";
import { SHOP_NAME } from '@/lib/constants';
import Image from 'next/image';


const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Archive },
  { href: '/dashboard/godown', label: 'Godown Stock', icon: Warehouse }, 
  { href: '/dashboard/billing', label: 'Billing', icon: ShoppingCart },
  { href: '/dashboard/franchise-invoice', label: 'Franchise Invoice', icon: Receipt },
  { href: '/dashboard/franchise-invoice-history', label: 'Franchise Inv. History', icon: History },
  { href: '/dashboard/orders', label: 'Order History', icon: PackageSearch },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/low-stock', label: 'Inventory Low Stock', icon: AlertTriangle },
  { href: '/dashboard/godown-low-stock', label: 'Godown Low Stock', icon: AlertTriangle }, // New Item
];

export function AppSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r shadow-md bg-card hidden md:flex flex-col">
        <SidebarHeader className="flex items-center justify-start p-4 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden min-w-0">
             <Image src="https://picsum.photos/seed/grameenalogo/40/40" alt="Shop Logo" width={28} height={28} className="rounded-md shrink-0" data-ai-hint="organic food store" />
            <span className="font-semibold text-lg whitespace-nowrap overflow-hidden text-ellipsis">{SHOP_NAME.split(',')[0]}</span>
          </div>
           <div className="flex items-center justify-center group-data-[collapsible=icon]:block hidden">
             <Image src="https://picsum.photos/seed/grameenalogo/40/40" alt="Shop Logo" width={28} height={28} className="rounded-md" data-ai-hint="organic food store" />
           </div>
        </SidebarHeader>
      <SidebarContent className="flex-1 p-2 overflow-y-auto">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                  tooltip={{children: item.label, className: "bg-primary text-primary-foreground"}}
                >
                  <span className="flex items-center gap-2"> {/* Ensure icon and label are wrapped */}
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
       <SidebarSeparator />
      <SidebarFooter className="p-2 mt-auto"> {/* mt-auto to push footer to bottom */}
         <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={logout} tooltip={{children: "Logout", className: "bg-destructive text-destructive-foreground"}}>
                   <span className="flex items-center gap-2 text-destructive"> {/* Ensure icon and label are wrapped and colored */}
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                  </span>
                </SidebarMenuButton>
            </SidebarMenuItem>
         </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
