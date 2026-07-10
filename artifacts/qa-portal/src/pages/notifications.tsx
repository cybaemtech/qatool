import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, CheckCheck, AlertTriangle, CheckCircle2, XCircle, FolderPlus, Bug } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  audit_completed: { icon: CheckCircle2, color: "text-green-600", label: "Audit Completed" },
  audit_failed: { icon: XCircle, color: "text-red-600", label: "Audit Failed" },
  critical_issue: { icon: AlertTriangle, color: "text-orange-600", label: "Critical Issue" },
  project_added: { icon: FolderPlus, color: "text-blue-600", label: "Project Added" },
  bug_assigned: { icon: Bug, color: "text-purple-600", label: "Bug Assigned" },
};

export default function Notifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: notifications = [], isLoading } = useListNotifications();
  const markOneMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter(n => !n.read).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });

  const handleMarkOne = (id: number) => {
    markOneMutation.mutate({ id }, { onSuccess: invalidate });
  };

  const handleMarkAll = () => {
    markAllMutation.mutate(undefined, {
      onSuccess: () => { invalidate(); toast({ title: "All notifications marked as read" }); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">Stay informed about audits, bugs, and project activity</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAll} disabled={markAllMutation.isPending}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading notifications…</div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <BellOff className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground font-medium">No notifications yet</p>
              <p className="text-sm text-muted-foreground mt-1">You'll see alerts here when audits complete or bugs are assigned</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? { icon: Bell, color: "text-muted-foreground", label: n.type };
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-4 p-4 transition-colors cursor-pointer hover:bg-muted/50",
                      !n.read && "bg-primary/5"
                    )}
                    onClick={() => !n.read && handleMarkOne(n.id)}
                  >
                    <div className={cn("mt-0.5 flex-shrink-0", cfg.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-medium", !n.read ? "text-foreground" : "text-muted-foreground")}>
                          {n.title}
                        </p>
                        {!n.read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs flex-shrink-0">{cfg.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
