import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute, Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import ExecutiveDashboard from "@/pages/executive-dashboard";
import Projects from "@/pages/projects";
import ProjectNew from "@/pages/project-new";
import ProjectDetail from "@/pages/project-detail";
import Audits from "@/pages/audits";
import AuditDetail from "@/pages/audit-detail";
import Bugs from "@/pages/bugs";
import Reports from "@/pages/reports";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import Schedules from "@/pages/schedules";
import Integrations from "@/pages/integrations";
import Notifications from "@/pages/notifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/executive-dashboard">
        <ProtectedRoute>
          <Layout><ExecutiveDashboard /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/projects/new">
        <ProtectedRoute>
          <Layout><ProjectNew /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/projects/:id">
        <ProtectedRoute>
          <Layout><ProjectDetail /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/projects">
        <ProtectedRoute>
          <Layout><Projects /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/audits/:id">
        <ProtectedRoute>
          <Layout><AuditDetail /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/audits">
        <ProtectedRoute>
          <Layout><Audits /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/bugs">
        <ProtectedRoute>
          <Layout><Bugs /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/reports">
        <ProtectedRoute>
          <Layout><Reports /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/schedules">
        <ProtectedRoute>
          <Layout><Schedules /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/integrations">
        <ProtectedRoute>
          <Layout><Integrations /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/notifications">
        <ProtectedRoute>
          <Layout><Notifications /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/users">
        <ProtectedRoute adminOnly>
          <Layout><Users /></Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <Layout><Settings /></Layout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <TooltipProvider>
            <AppRouter />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
