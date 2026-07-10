import { useState } from "react";
import { 
  useListUsers, 
  useCreateUser, 
  useDeleteUser,
  useUpdateUser,
  getListUsersQueryKey,
  UserInputRole,
  UserUpdateRole
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Plus, Trash, Users as UsersIcon, Shield, ShieldAlert, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Users() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: users, isLoading } = useListUsers({ query: { queryKey: getListUsersQueryKey() } });
  
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const updateUser = useUpdateUser();

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: UserInputRole.tester
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast({ title: "User created successfully" });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setIsOpen(false);
          setFormData({ name: "", email: "", password: "", role: UserInputRole.tester });
        },
        onError: (err: any) => {
          toast({ title: "Error creating user", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this user?")) {
      deleteUser.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: "User deleted" });
            queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          }
        }
      );
    }
  };

  const handleRoleChange = (id: number, role: string) => {
    updateUser.mutate(
      { id, data: { role: role as UserUpdateRole } },
      {
        onSuccess: () => {
          toast({ title: "Role updated" });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        }
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-indigo-500" /> User Management
          </h1>
          <p className="text-muted-foreground mt-1">Administer access and roles for the QA portal.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={formData.role} onValueChange={(val: any) => setFormData({...formData, role: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tester">Tester</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createUser.isPending}>
                {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell></TableRow>
              ) : (
                users?.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        {user.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500">{user.email}</TableCell>
                    <TableCell>
                      <Select 
                        value={user.role} 
                        onValueChange={(val) => handleRoleChange(user.id, val)}
                        disabled={updateUser.isPending}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tester">
                            <span className="flex items-center gap-2"><UsersIcon className="h-3 w-3" /> Tester</span>
                          </SelectItem>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-2"><Shield className="h-3 w-3" /> Admin</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {format(new Date(user.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(user.id)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
