'use client';

import * as React from 'react';
import { signIn } from 'next-auth/react';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { loginSchema } from '@/lib/validators';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginForm() {
  const [email, setEmail] = React.useState('admin@shop.com');
  const [password, setPassword] = React.useState('ChangeMe123!');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const validated = loginSchema.safeParse({ email, password });
    if (!validated.success) {
      toast({ title: 'Invalid credentials', description: validated.error.flatten().fieldErrors.email?.[0] || validated.error.flatten().fieldErrors.password?.[0], variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    try {
      const result = await signIn('credentials', {
        email: validated.data.email,
        password: validated.data.password,
        redirect: false,
      });

      if (result?.error) {
        toast({ title: 'Login failed', description: 'Invalid email or password', variant: 'destructive' });
      } else {
        window.location.href = '/pos';
      }
    } catch {
      toast({ title: 'Login failed', description: 'An error occurred', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Dite POS</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@shop.com" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-semibold">Demo Credentials:</p>
            <p>Admin: admin@shop.com / ChangeMe123!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
