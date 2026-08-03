import { useState } from "react";
import {
  useGetAnalyticsTrends,
  useListProjects,
} from "@workspace/api-client-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingDown, TrendingUp, AlertTriangle, Activity } from "lucide-react";

const METRIC_COLORS: Record<string, string> = {
  performance:   "#3b82f6",
  accessibility: "#10b981",
  seo:           "#f59e0b",
  security:      "#8b5cf6",
  health:        "#ef4444",
};

const METRIC_LABELS: Record<string, string> = {
  performance:   "Performance",
  accessibility: "Accessibility",
  seo:           "SEO",
  security:      "Security",
  health:        "Health",
};

const PERIOD_OPTIONS = [
  { value: "14",  label: "Last 14 days" },
  { value: "30",  label: "Last 30 days" },
  { value: "60",  label: "Last 60 days" },
  { value: "90",  label: "Last 90 days" },
];

function ScoreChip({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const color =
    score >= 90 ? "text-green-600" :
    score >= 75 ? "text-yellow-600" :
    score >= 50 ? "text-orange-600" : "text-red-600";
  return <span className={`font-semibold ${color}`}>{score}</span>;
}

export default function Analytics() {
  const [projectId, setProjectId] = useState<string>("all");
  const [days, setDays]           = useState<string>("30");

  const { data: projects = [] } = useListProjects();
  const { data: trendsData, isLoading } = useGetAnalyticsTrends({
    projectId: projectId !== "all" ? Number(projectId) : undefined,
    days: Number(days),
  });

  const points     = trendsData?.points     ?? [];
  const regressions = trendsData?.regressions ?? [];

  const criticalRegressions = regressions.filter(r => r.severity === "critical");
  const warningRegressions  = regressions.filter(r => r.severity === "warning");

  // Latest scores (last data point)
  const latest = points.length ? points[points.length - 1] : null;
  const previous = points.length > 1 ? points[points.length - 2] : null;

  const getChange = (metric: keyof NonNullable<typeof latest>) => {
    if (!latest || !previous) return null;
    const curr = latest[metric] as number | null;
    const prev = previous[metric] as number | null;
    if (curr == null || prev == null) return null;
    return curr - prev;
  };

  const metrics: Array<keyof NonNullable<typeof latest>> = ["performance", "accessibility", "seo", "security", "health"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historical Analytics</h1>
          <p className="text-muted-foreground">Track quality trends and detect regressions over time</p>
        </div>
        <div className="flex gap-3">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Regression alerts */}
      {regressions.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-4 w-4" />
              {criticalRegressions.length > 0
                ? `${criticalRegressions.length} critical regression${criticalRegressions.length > 1 ? "s" : ""} detected`
                : `${warningRegressions.length} regression${warningRegressions.length > 1 ? "s" : ""} detected`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {regressions.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <Badge
                    variant="outline"
                    className={r.severity === "critical"
                      ? "border-red-300 text-red-700 bg-red-50"
                      : "border-orange-300 text-orange-700 bg-orange-50"}
                  >
                    {r.severity}
                  </Badge>
                  <span className="font-medium text-orange-900">
                    {METRIC_LABELS[r.metric] ?? r.metric}
                  </span>
                  <span className="text-orange-700">
                    dropped {r.drop} points on {r.date}
                  </span>
                  <span className="text-orange-600 ml-auto">
                    {r.previousScore} → {r.currentScore}
                  </span>
                </div>
              ))}
              {regressions.length > 5 && (
                <p className="text-xs text-orange-600 mt-1">+{regressions.length - 5} more regressions</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {metrics.map(metric => {
          const score  = latest?.[metric] as number | null ?? null;
          const change = getChange(metric);
          return (
            <Card key={metric}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  {METRIC_LABELS[metric as string]}
                </p>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">
                    <ScoreChip score={score} />
                  </span>
                  {change != null && (
                    <span className={`flex items-center text-xs font-medium mb-1 ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {change >= 0
                        ? <TrendingUp className="h-3 w-3 mr-0.5" />
                        : <TrendingDown className="h-3 w-3 mr-0.5" />}
                      {change >= 0 ? "+" : ""}{change}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trend charts */}
      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Loading trend data…</CardContent></Card>
      ) : points.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          No completed audits in the selected period. Run some audits to see trends.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance & Accessibility */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Performance &amp; Accessibility
              </CardTitle>
              <CardDescription>Core Web Vitals and WCAG compliance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={points} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [value != null ? `${value}` : "—", METRIC_LABELS[name] ?? name]}
                    labelFormatter={l => `Date: ${l}`}
                  />
                  <Legend formatter={name => METRIC_LABELS[name] ?? name} />
                  <Line type="monotone" dataKey="performance" stroke={METRIC_COLORS.performance} dot={false} strokeWidth={2} connectNulls />
                  <Line type="monotone" dataKey="accessibility" stroke={METRIC_COLORS.accessibility} dot={false} strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="h-4 w-4 rounded-full inline-block" style={{ background: METRIC_COLORS.seo }} />
                SEO Trend
              </CardTitle>
              <CardDescription>Search engine optimization score over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={points} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [value != null ? `${value}` : "—", "SEO"]}
                    labelFormatter={l => `Date: ${l}`}
                  />
                  <Line type="monotone" dataKey="seo" stroke={METRIC_COLORS.seo} dot={false} strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="h-4 w-4 rounded-full inline-block" style={{ background: METRIC_COLORS.security }} />
                Security Trend
              </CardTitle>
              <CardDescription>Best practices and security score over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={points} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [value != null ? `${value}` : "—", "Security"]}
                    labelFormatter={l => `Date: ${l}`}
                  />
                  <Line type="monotone" dataKey="security" stroke={METRIC_COLORS.security} dot={false} strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Overall Health */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="h-4 w-4 rounded-full inline-block" style={{ background: METRIC_COLORS.health }} />
                Overall Health
              </CardTitle>
              <CardDescription>Composite health score (avg of all metrics)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={points} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [value != null ? `${value}` : "—", "Health"]}
                    labelFormatter={l => `Date: ${l}`}
                  />
                  <Line type="monotone" dataKey="health" stroke={METRIC_COLORS.health} dot={false} strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* All metrics combined */}
      {points.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Metrics Combined</CardTitle>
            <CardDescription>Side-by-side comparison of all quality metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={points} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [value != null ? `${value}` : "—", METRIC_LABELS[name] ?? name]}
                  labelFormatter={l => `Date: ${l}`}
                />
                <Legend formatter={name => METRIC_LABELS[name] ?? name} />
                {metrics.map(m => (
                  <Line key={m} type="monotone" dataKey={m as string} stroke={METRIC_COLORS[m as string]} dot={false} strokeWidth={1.5} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
