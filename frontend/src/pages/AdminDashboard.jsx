import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { Activity, Brain, RefreshCw, Shield, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminMetricCard from "../components/admin/AdminMetricCard";
import AdminPanel from "../components/admin/AdminPanel";
import AdminTableSection from "../components/admin/AdminTableSection";

const riskColors = ["#ef4444", "#f59e0b", "#10b981"];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await axios.get("/api/admin/dashboard/overview/");
      setData(response.data || null);
    } catch (error) {
      setNotice(error.response?.data?.error || "Failed to load admin dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const riskChart = useMemo(() => {
    const risk = data?.at_risk_overview;
    return [
      { name: "High", value: risk?.high || 0 },
      { name: "Medium", value: risk?.medium || 0 },
      { name: "Low", value: risk?.low || 0 },
    ];
  }, [data]);

  const courseRows = data?.course_performance || [];
  const instructorRows = data?.instructor_performance || [];
  const engagementRows = data?.engagement_trends || [];
  const riskStudents = data?.at_risk_students || [];
  const recentLogs = data?.recent_logs || [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.35),_transparent_40%),linear-gradient(135deg,#020617,#1d4ed8_55%,#0f766e)] px-6 py-8 text-white shadow-2xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Full System Control</p>
            <h1 className="mt-2 text-3xl font-bold">Admin Command Center</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-200">
              System-wide user oversight, course control, AI threshold governance, and audit visibility in one workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadOverview}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <Link to="/admin/courses" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900">
              Manage Courses
            </Link>
            <Link to="/admin/users" className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              Manage Users
            </Link>
          </div>
        </div>
      </header>

      {notice ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{notice}</div> : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">Loading control center...</div>
      ) : !data ? null : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard title="Total Users" value={summary?.users?.total || 0} subtitle={`${summary?.users?.active || 0} active accounts`} accent="blue" />
            <AdminMetricCard title="Active Courses" value={summary?.courses?.active || 0} subtitle={`${summary?.courses?.archived || 0} archived`} accent="emerald" />
            <AdminMetricCard title="Pending Instructors" value={summary?.users?.pending_instructors || 0} subtitle="Awaiting admin approval" accent="amber" />
            <AdminMetricCard title="Passing Grade" value={summary?.ai_settings?.passing_grade || 0} subtitle="AI risk engine threshold" accent="rose" />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
            <AdminPanel
              title="At-Risk Students Overview"
              eyebrow="AI Analytics Control"
              description="Distribution of system-wide learner risk based on current admin thresholds."
              actions={
                <Link to="/admin/settings" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
                  Edit AI Settings
                </Link>
              }
            >
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={riskChart} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92}>
                        {riskChart.map((entry, index) => (
                          <Cell key={entry.name} fill={riskColors[index % riskColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {riskChart.map((item, index) => (
                    <div key={item.name} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.name} Risk</p>
                      <p className="mt-2 text-3xl font-bold" style={{ color: riskColors[index % riskColors.length] }}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </AdminPanel>

            <AdminPanel
              title="Student Engagement Trends"
              eyebrow="Activity Stream"
              description="Submission volume and login activity from the audit trail."
            >
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engagementRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="submissions" stroke="#2563eb" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="logins" stroke="#0f766e" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AdminPanel>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AdminPanel title="Course Performance Comparison" eyebrow="All Courses" description="High-level quality and risk across the LMS.">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={courseRows.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="course_title" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="average_grade" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="high_risk_students" fill="#ef4444" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AdminPanel>

            <AdminPanel title="Instructor Performance Metrics" eyebrow="Teaching Oversight" description="Course load, learner risk, and engagement by instructor.">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={instructorRows.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="students_total" fill="#0f766e" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="high_risk_total" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AdminPanel>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AdminPanel title="Priority At-Risk Students" eyebrow="Intervention Queue" description="Students needing the fastest escalation.">
              <AdminTableSection
                columns={[
                  { key: "student", label: "Student" },
                  { key: "course", label: "Course" },
                  { key: "risk", label: "Risk" },
                  { key: "grade", label: "Avg Grade" },
                  { key: "engagement", label: "Engagement" },
                ]}
                rows={riskStudents}
                renderRow={(row) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.student_name}</td>
                    <td className="px-4 py-3 text-slate-700">{row.course_title}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        row.risk_level === "high"
                          ? "bg-rose-100 text-rose-700"
                          : row.risk_level === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {row.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.average_grade}</td>
                    <td className="px-4 py-3 text-slate-700">{row.engagement_score}</td>
                  </tr>
                )}
              />
            </AdminPanel>

            <AdminPanel title="System Logs Snapshot" eyebrow="Audit Trail" description="Recent privileged and user activity entering the admin log.">
              <AdminTableSection
                columns={[
                  { key: "action", label: "Action" },
                  { key: "performed_by", label: "Performed By" },
                  { key: "target", label: "Target" },
                  { key: "time", label: "Time" },
                ]}
                rows={recentLogs}
                renderRow={(row) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.action}</p>
                      <p className="text-xs text-slate-500">{row.description || "No description"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.performed_by || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.target_user || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{new Date(row.timestamp).toLocaleString()}</td>
                  </tr>
                )}
              />
            </AdminPanel>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Link to="/admin/users" className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <Users className="h-5 w-5 text-blue-600" />
              <h3 className="mt-4 font-semibold text-slate-900">User Control</h3>
              <p className="mt-1 text-sm text-slate-500">Change roles, activate accounts, review activity, reset passwords.</p>
            </Link>
            <Link to="/admin/courses" className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <Shield className="h-5 w-5 text-emerald-600" />
              <h3 className="mt-4 font-semibold text-slate-900">Course Control</h3>
              <p className="mt-1 text-sm text-slate-500">Create, reassign, archive, or delete any course.</p>
            </Link>
            <Link to="/admin/analytics" className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <Brain className="h-5 w-5 text-amber-600" />
              <h3 className="mt-4 font-semibold text-slate-900">AI Monitoring</h3>
              <p className="mt-1 text-sm text-slate-500">Track model metrics and admin AI service progress.</p>
            </Link>
            <Link to="/admin/logs" className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <Activity className="h-5 w-5 text-rose-600" />
              <h3 className="mt-4 font-semibold text-slate-900">Audit Trail</h3>
              <p className="mt-1 text-sm text-slate-500">Inspect login history, course actions, and moderation events.</p>
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
