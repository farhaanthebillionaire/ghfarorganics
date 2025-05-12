import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Leaf } from 'lucide-react'; // Using Leaf as a generic "organic" icon

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
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
       <p className="mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Grameena Home Foods, A.R Organics. All rights reserved.
      </p>
    </div>
  );
}
