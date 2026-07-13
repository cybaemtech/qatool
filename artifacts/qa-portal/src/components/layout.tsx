import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Loader2, Activity, LayoutDashboard, Folder, Bug, FileText, Users, Settings, LogOut, CalendarClock, Bell, Briefcase, Plug, FileBarChart2, Rocket, Zap, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      setLocation("/login");
    }
  }, [isLoading, token, setLocation]);

  if (isLoading || !token) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (adminOnly && user?.role !== 'admin') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You don't have permission to view this page.</p>
        <Link href="/" className="mt-4 text-primary hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  return <>{children}</>;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { data: notifications = [] } = useListNotifications({ unreadOnly: true }, {
    query: { queryKey: [...getListNotificationsQueryKey({ unreadOnly: true }), "unread"], refetchInterval: 30000 }
  });
  const unreadCount = notifications.filter(n => !n.read).length;

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Executive Dashboard', href: '/executive-dashboard', icon: Briefcase },
    { name: 'Projects', href: '/projects', icon: Folder },
    { name: 'Audits', href: '/audits', icon: Activity },
    { name: 'Bugs', href: '/bugs', icon: Bug },
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Report Center', href: '/reports/executive', icon: FileBarChart2 },
    { name: 'Release Readiness', href: '/release-readiness', icon: Rocket },
    { name: 'CI/CD Pipeline', href: '/cicd-pipeline', icon: Zap },
    { name: 'Security & Compliance', href: '/security-compliance', icon: ShieldCheck },
    { name: 'Schedules', href: '/schedules', icon: CalendarClock },
    { name: 'Integrations', href: '/integrations', icon: Plug },
  ];

  if (user?.role === 'admin') {
    navigation.push({ name: 'Users', href: '/users', icon: Users });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
            <Activity className="h-5 w-5" />
            QA Portal
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navigation.map((item, i) => {
            const isActive = location.startsWith(item.href);
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03, ease: "easeOut" }}
                whileHover={{ x: 2 }}
              >
                <Link href={item.href}>
                  <span className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-9 w-9 bg-primary/10 text-primary">
              <AvatarFallback>{user?.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/settings" className="flex-1">
              <span className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </span>
            </Link>
            <Link href="/notifications">
              <span className="relative flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors" title="Notifications">
                <Bell className="h-3.5 w-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
            </Link>
            <button 
              onClick={logout}
              className="flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Log out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-background">
          <div className="max-w-7xl mx-auto p-6 md:p-8">
            {/* Each route mounts its own <Layout>, so this plain motion.div replays its
                entrance animation on every navigation. AnimatePresence is intentionally
                not used here: it needs a persistent parent to orchestrate exit/enter
                transitions, which this per-route Layout instantiation doesn't provide. */}
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
