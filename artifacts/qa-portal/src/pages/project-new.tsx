import { useLocation } from "wouter";
import { useCreateProject } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const TEMPLATES = [
  { value: "react", label: "React Application" },
  { value: "vite", label: "Vite Application" },
  { value: "nextjs", label: "Next.js Application" },
  { value: "wordpress", label: "WordPress Website" },
  { value: "shopify", label: "Shopify Store" },
  { value: "laravel", label: "Laravel Application" },
  { value: "nodejs_api", label: "Node.js API" },
  { value: "static", label: "Static Website" },
  { value: "custom", label: "Custom Application" },
];

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  url: z.string().url("Must be a valid URL"),
  environment: z.enum(["development", "staging", "production"]),
  auditTemplate: z.string().default("custom"),
  description: z.string().optional(),
});

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateProject();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", url: "", environment: "development", auditTemplate: "custom", description: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate(
      { data: values as Parameters<typeof createMutation.mutate>[0]["data"] },
      {
        onSuccess: (data) => {
          toast({ title: "Project created successfully" });
          setLocation(`/projects/${data.id}`);
        },
        onError: (err: unknown) => {
          toast({ title: "Error creating project", description: (err as Error).message, variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">New Project</h1>
          <p className="text-muted-foreground mt-1">Add a new target application to monitor.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Main Landing Page" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="url" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target URL</FormLabel>
                  <FormControl><Input placeholder="https://example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="environment" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Environment</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select environment" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="auditTemplate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Audit Template</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {TEMPLATES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">Tailors the audit checks for your stack</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Textarea placeholder="Brief details about this project..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" asChild><Link href="/projects">Cancel</Link></Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Project
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
