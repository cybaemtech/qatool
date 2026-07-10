import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("admin@qa.dev");
  const [password, setPassword] = useState("password");
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data) => {
          login(data.token, data.user);
          setLocation("/dashboard");
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md shadow-xl border-slate-200/60 dark:border-slate-800/60 backdrop-blur-sm bg-white/90 dark:bg-slate-900/90 relative z-10">
        <CardHeader className="space-y-3 pb-6">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-inner">
              <Activity className="h-7 w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center tracking-tight text-slate-900 dark:text-white">
            QA Automation Portal
          </CardTitle>
          <CardDescription className="text-center text-slate-500 dark:text-slate-400">
            Sign in to access your testing cockpit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11"
              />
            </div>

            {loginMutation.error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-900/30">
                {loginMutation.error.message || "Invalid credentials. Please try again."}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-base shadow-sm transition-all active:scale-[0.98]"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Sign In"
              )}
            </Button>
            
            <div className="mt-4 text-center text-xs text-slate-500">
              Demo: admin@qa.dev / password
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
