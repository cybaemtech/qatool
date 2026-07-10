import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  useGetDashboardSummary, 
  useGetAuditTrends, 
  useGetBugSeverityDistribution, 
  useGetPerformanceHistory, 
  useGetRecentActivity,
  getGetDashboardSummaryQueryKey,
  getGetAuditTrendsQueryKey,
  getGetBugSeverityDistributionQueryKey,
  getGetPerformanceHistoryQueryKey,
  getGetRecentActivityQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Folder, Bug, AlertTriangle, Zap, CheckCircle2 } from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { SeverityBadge } from "@/components/severity-badge";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: trends } = useGetAuditTrends({ query: { queryKey: getGetAuditTrendsQueryKey() } });
  const { data: bugs } = useGetBugSeverityDistribution({ query: { queryKey: getGetBugSeverityDistributionQueryKey() } });
  const { data: performance } = useGetPerformanceHistory(undefined, { query: { queryKey: getGetPerformanceHistoryQueryKey() } });
  const { data: activity } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });

  const COLORS = {
    critical: '#ef4444', // red-500
    high: '#f97316',     // orange-500
    medium: '#f59e0b',   // amber-500
    low: '#3b82f6',      // blue-500
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of your testing infrastructure.</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Projects</CardTitle>
            <Folder className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.totalProjects ?? '-'}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Audits</CardTitle>
            <Activity className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.totalAudits ?? '-'}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Open Bugs</CardTitle>
            <Bug className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.totalBugs ?? '-'}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Critical Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.criticalIssues ?? '-'}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Avg Performance</CardTitle>
            <Zap className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{summary?.avgPerformanceScore ? Math.round(summary.avgPerformanceScore) : '-'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Audit Trends */}
        <Card className="col-span-1 lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Audit Runs (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div
              className="h-[300px] w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {trends && trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(val) => format(new Date(val), 'MMM d')}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      dx={-10}
                    />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                    />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
              )}
            </motion.div>
          </CardContent>
        </Card>

        {/* Bug Severity */}
        <Card className="col-span-1 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Open Bugs by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div
              className="h-[300px] w-full flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 }}
            >
              {bugs && bugs.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bugs}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="severity"
                    >
                      {bugs.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.severity as keyof typeof COLORS] || '#cbd5e1'} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value, name) => [value, String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value) => <span className="capitalize text-slate-600 text-sm font-medium">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-400">No bugs found</div>
              )}
            </motion.div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Performance History */}
        <Card className="col-span-1 xl:col-span-2 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Performance History</CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div
              className="h-[300px] w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
            >
              {performance && performance.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(val) => format(new Date(val), 'MMM d')}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      dy={10}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      dx={-10}
                    />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    <Line type="monotone" dataKey="performance" name="Performance" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="accessibility" name="Accessibility" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="seo" name="SEO" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="bestPractices" name="Best Practices" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
              )}
            </motion.div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-1 shadow-sm border-slate-200 flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {activity && activity.length > 0 ? (
              <div className="space-y-6">
                {activity.map((item, i) => (
                  <div key={item.id} className="flex gap-4 relative">
                    {/* Connection line */}
                    {i !== activity.length - 1 && (
                      <div className="absolute left-[11px] top-8 bottom-[-24px] w-[2px] bg-slate-100" />
                    )}
                    
                    <div className="flex-shrink-0 mt-1">
                      {item.type === 'bug_found' && <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center"><Bug className="w-3 h-3 text-red-600" /></div>}
                      {item.type === 'bug_resolved' && <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-emerald-600" /></div>}
                      {item.type === 'audit_completed' && <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center"><Activity className="w-3 h-3 text-indigo-600" /></div>}
                      {item.type === 'audit_failed' && <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center"><AlertTriangle className="w-3 h-3 text-orange-600" /></div>}
                      {item.type === 'project_created' && <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center"><Folder className="w-3 h-3 text-blue-600" /></div>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-slate-400">{format(new Date(item.createdAt), 'MMM d, h:mm a')}</span>
                        {item.severity && (
                          <SeverityBadge severity={item.severity} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">No recent activity</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
