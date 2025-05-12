import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Leaf } from 'lucide-react';
import { FloatingIconsBackground } from '@/components/layout/FloatingIconsBackground';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 relative">
      <FloatingIconsBackground />

      <Card className="w-full max-w-md shadow-xl bg-card/90 backdrop-blur-sm relative z-10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Leaf size={32} />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">Grameena Home Foods</CardTitle>
          <CardDescription className="text-md text-muted-foreground">
            A.R Organics - Inventory & Billing
          </CardDescription>
        </CardHeader>

        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>

      <footer className="mt-8 text-center text-sm text-muted-foreground relative z-10">
        <p className="mb-1">
          &copy; {new Date().getFullYear()} Grameena Home Foods, A.R Organics. All rights reserved.
        </p>
        <p>
          Website created by{' '}
          <Link
            href="https://www.instagram.com/farhaanthebillionaire/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Shaik Mohammed Farhaan
          </Link>
        </p>
      </footer>
    </div>
  );
}
