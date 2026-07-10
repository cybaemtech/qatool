import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateUser, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User as UserIcon, Shield } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState(user?.name || "");
  const [password, setPassword] = useState("");

  const updateMutation = useUpdateUser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const data: any = { name };
    if (password) data.password = password;

    updateMutation.mutate(
      { id: user.id, data },
      {
        onSuccess: () => {
          toast({ title: "Profile updated successfully" });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setPassword("");
        },
        onError: (err: any) => {
          toast({ title: "Update failed", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account and profile preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="shadow-sm border-slate-200 bg-slate-50/50">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4 bg-indigo-100 text-indigo-700 text-2xl font-bold">
                <AvatarFallback>{user?.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold text-slate-900">{user?.name}</h2>
              <p className="text-sm text-slate-500 mb-4">{user?.email}</p>
              
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold capitalize">
                {user?.role === 'admin' ? <Shield className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
                {user?.role} Access
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle>Profile Details</CardTitle>
              <CardDescription>Update your personal information and credentials.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ""} disabled className="bg-slate-50 text-slate-500" />
                  <p className="text-xs text-slate-400">Email cannot be changed.</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Leave blank to keep current password"
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                  />
                </div>

                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
