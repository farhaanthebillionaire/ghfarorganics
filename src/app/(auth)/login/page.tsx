import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Leaf, Sprout, Apple, Wheat } from 'lucide-react';

export default function LoginPage() {
  const iconBaseClass = "absolute text-primary animate-float pointer-events-none select-none";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4 overflow-hidden">
      {/* Background Icons with varied animations, positions, and opacities */}
      <Leaf 
        className={`${iconBaseClass} h-28 w-28 -left-12 top-1/4 opacity-10`} 
        style={{ animationDuration: '10s', animationDelay: '0s' }} 
        aria-hidden="true"
      />
      <Sprout 
        className={`${iconBaseClass} h-20 w-20 -right-10 top-1/2 opacity-5`} 
        style={{ animationDuration: '12s', animationDelay: '1.5s' }} 
        aria-hidden="true"
      />
      <Apple 
        className={`${iconBaseClass} h-24 w-24 left-1/3 bottom-2 opacity-15`} 
        style={{ animationDuration: '9s', animationDelay: '0.5s' }} 
        aria-hidden="true"
      />
      <Wheat 
        className={`${iconBaseClass} h-32 w-32 right-1/4 -top-8 opacity-10`} 
        style={{ animationDuration: '11s', animationDelay: '2s' }} 
        aria-hidden="true"
      />
      <Leaf 
        className={`${iconBaseClass} h-16 w-16 right-8 bottom-2/5 opacity-20`} 
        style={{ animationDuration: '13s', animationDelay: '1s' }} 
        aria-hidden="true"
      />
       <Sprout 
        className={`${iconBaseClass} h-36 w-36 -left-16 bottom-1/3 opacity-10`}
        style={{ animationDuration: '10.5s', animationDelay: '2.5s' }} 
        aria-hidden="true"
      />
      <Apple 
        className={`${iconBaseClass} h-18 w-18 left-3/4 top-16 opacity-5`} 
        style={{ animationDuration: '14s', animationDelay: '0.2s' }} 
        aria-hidden="true"
      />
       <Wheat 
        className={`${iconBaseClass} h-22 w-22 left-10 top-2/3 opacity-15`} 
        style={{ animationDuration: '8s', animationDelay: '1.8s' }} 
        aria-hidden="true"
      />

      <Card className="z-10 w-full max-w-md shadow-xl bg-card/90 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Leaf size={32} />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">Grameena Home Foods</CardTitle>
          <CardDescription className="text-md text-muted-foreground">A.R Organics - Inventory & Billing</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
       <p className="z-10 mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Grameena Home Foods, A.R Organics. All rights reserved.
      </p>
    </div>
  );
}
