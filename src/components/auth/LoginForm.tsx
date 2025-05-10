'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  id: z.string().min(1, { message: 'ID is required' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { login, isLoading: authIsLoading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      id: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    const success = await login(data.id, data.password);
    if (!success) {
      toast({
        title: 'Login Failed',
        description: 'Invalid ID or password. Please try again.',
        variant: 'destructive',
      });
    }
    // On success, AuthProvider handles redirect
    setIsSubmitting(false);
  };

  const currentIsLoading = authIsLoading || isSubmitting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="id" className={cn(form.formState.errors.id && "text-destructive")}>User ID</Label>
        <Input
          id="id"
          type="text"
          placeholder="Enter your ID"
          {...form.register('id')}
          className={cn(form.formState.errors.id && "border-destructive focus-visible:ring-destructive")}
          disabled={currentIsLoading}
        />
        {form.formState.errors.id && (
          <p className="text-sm text-destructive">{form.formState.errors.id.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className={cn(form.formState.errors.password && "text-destructive")}>Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          {...form.register('password')}
          className={cn(form.formState.errors.password && "border-destructive focus-visible:ring-destructive")}
          disabled={currentIsLoading}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={currentIsLoading}>
        {currentIsLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Authenticating...
          </>
        ) : (
          'Login'
        )}
      </Button>
    </form>
  );
}
