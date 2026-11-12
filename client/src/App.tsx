import { useCallback, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, Clock3, Database, RefreshCw,
  ShieldCheck, Zap, LayoutDashboard, AlertCircle,
  ArrowUpRight, Send, LoaderCircle
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip
} from "recharts";

type ApiLog = {
  endpoint?: string;
  method?: string;
  statusCode?: number;
  latencyMs?: number;
  message?: string;
  timestamp?: string;
};

type Metrics = {
  totalRequests: number;
  failedRequests: number;
  serverErrors: number;
  errorRate: number;
  averageLatencyMs: number;
};

const emptyMetrics: Metrics = {
  totalRequests: 0,
  failedRequests: 0,
  serverErrors: 0,
  errorRate: 0,
  averageLatencyMs: 0
};

function getLogs(payload: any): ApiLog[] {
  const candidate =
    payload?.logs ??
    payload?.data?.logs ??
    payload?.data ??
    payload?.results ??
    payload;

  return Array.isArray(candidate) ? candidate : [];
}

function getMetrics(payload: any): Metrics {
  return {
    ...emptyMetrics,
    ...(payload?.metrics ?? payload?.data?.metrics ?? payload?.data ?? payload)
  };
}

function App() {
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [question, setQuestion] = useState(
    "Investigate recent server errors. Find recurring errors and suggest debugging steps."
  );
  const [report, setReport] = useState("");
  const [investigating, setInvestigating] = useState(false);
  const [activePage, setActivePage] = useState("Overview");

  const refresh = useCallback(async () => {
    setApiError("");
    try {
      const [metricsResponse, logsResponse] = await Promise.all([
        fetch("/api/metrics"),
        fetch("/api/logs?limit=20")
      ]);

      if (!metricsResponse.ok || !logsResponse.ok) {
        throw new Error("Backend request failed. Check that DevPilot API is running.");
      }

      const metricsData = await metricsResponse.json();
      const logsData = await logsResponse.json();

      setMetrics(getMetrics(metricsData));
      setLogs(getLogs(logsData));
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Could not load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function investigate() {
    if (question.trim().length < 5) return;

    setInvestigating(true);
    setReport("");

    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Investigation failed.");
      }

      setReport(
        typeof data.report === "string"
          ? data.report
          : JSON.stringify(data.report, null, 2)
      );
    } catch (error) {
      setReport(error instanceof Error ? error.message : "Investigation failed.");
    } finally {
      setInvestigating(false);
    }
  }

  const chartData = [...logs]
    .slice(0, 20)
    .reverse()
    .map((log, index) => ({
      request: String(index + 1),
      latency: log.latencyMs ?? 0
    }));

  const cards = [
    {
      title: "Total requests",
      value: metrics.totalRequests.toLocaleString(),
      note: "Recorded API requests",
      icon: Activity
    },
    {
      title: "Error rate",
      value: `${Number(metrics.errorRate).toFixed(2)}%`,
      note: `${metrics.failedRequests} failed requests`,
      icon: AlertTriangle
    },
    {
      title: "Server errors",
      value: metrics.serverErrors.toLocaleString(),
      note: "HTTP 5xx responses",
      icon: ShieldCheck
    },
    {
      title: "Average latency",
      value: `${Math.round(metrics.averageLatencyMs)} ms`,
      note: "Average response time",
      icon: Clock3
    }
  ];

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[250px] border-r border-[#253044] bg-[#0b1424] p-6 md:flex md:flex-col">
        <div className="mb-12 flex items-center gap-3">
          <div className="rounded-xl bg-cyan-400/10 p-2.5 text-cyan-400">
            <Zap size={23} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">DevPilot</h1>
            <p className="text-xs text-slate-500">Engineering intelligence</p>
          </div>
        </div>

        <p className="mb-3 text-[11px] font-bold tracking-[0.16em] text-slate-500">
          WORKSPACE
        </p>

        <nav className="space-y-2">
          {[
            { name: "Overview", icon: Activity },
            { name: "Incidents", icon: AlertTriangle },
            { name: "API Logs", icon: Database }
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => setActivePage(name)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                activePage === name
                  ? "border border-cyan-500/30 bg-cyan-400/10 text-cyan-300"
                  : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-xl border border-[#2a3548] bg-[#111b2c] p-4">
          <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-500">
            AI ENGINE
          </p>
          <p className="text-sm font-semibold text-emerald-400">Ollama · Local</p>
          <p className="mt-1 text-xs text-slate-500">Qwen 2.5 · 3B</p>
        </div>
      </aside>

      <main className="px-5 py-8 md:ml-[250px] md:px-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-3 text-sm text-slate-500">Workspace / {activePage}</p>
            <h2 className="text-3xl font-bold tracking-tight">
              {activePage === "Overview" ? "System overview" : activePage}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Monitor your services and investigate incidents.
            </p>
          </div>

          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#111827] px-4 py-3 text-sm hover:border-cyan-500/50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <div className="mb-7 flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-medium text-emerald-400">DevPilot monitoring</span>
          <span className="text-slate-600">· Auto-refresh every 30 seconds</span>
        </div>

        {apiError && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            <AlertCircle size={17} />
            {apiError}
          </div>
        )}

        {activePage === "Overview" && (
<section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ title, value, note, icon: Icon }) => (
            <div key={title} className="panel p-5">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm text-slate-400">{title}</p>
                <Icon size={19} className="text-cyan-400" />
              </div>
              <p className="text-3xl font-bold tracking-tight">
                {loading ? "—" : value}
              </p>
              <p className="mt-2 text-xs text-slate-500">{note}</p>
            </div>
          ))}
        </section>

        
        )}
        {activePage === "Overview" && (
<section className="mb-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
          <div className="panel min-w-0 p-5">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="font-semibold">Request latency</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Recent logged requests · milliseconds
                </p>
              </div>
              <ArrowUpRight size={18} className="text-slate-500" />
            </div>

            <div className="h-[270px] w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#263449" strokeDasharray="3 3" />
                    <XAxis dataKey="request" stroke="#71839e" tickLine={false} />
                    <YAxis stroke="#71839e" tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "#111c2e",
                        border: "1px solid #334155",
                        borderRadius: 10
                      }}
                      labelStyle={{ color: "#cbd5e1" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="latency"
                      name="Latency"
                      stroke="#08d4ee"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  {loading ? "Loading request data..." : "No request data available yet."}
                </div>
              )}
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="font-semibold">AI investigation</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              DevPilot uses your local Qwen model and MCP tools to investigate real service incidents.
            </p>

            <div className="my-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <Zap size={16} />
                Local AI engine
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Qwen 2.5 · 3B connected through Ollama
              </p>
            </div>

            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              className="mb-3 w-full resize-y rounded-xl border border-slate-700 bg-[#0b1424] p-3 text-sm text-slate-200 outline-none focus:border-cyan-500"
              placeholder="Ask DevPilot to investigate an incident..."
            />

            <button
              onClick={investigate}
              disabled={investigating || question.trim().length < 5}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {investigating ? (
                <><LoaderCircle size={17} className="animate-spin" /> Investigating...</>
              ) : (
                <><Send size={16} /> Investigate an incident</>
              )}
            </button>

            {report && (
              <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-slate-700 bg-[#0b1424] p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  Investigation report
                </p>
                <pre className="whitespace-pre-wrap text-xs leading-6 text-slate-300">
                  {report}
                </pre>
              </div>
            )}
          </div>
        </section>

        
        )}
        

        {activePage === "Incidents" && (
          <section className="panel overflow-hidden">
            <div className="border-b border-slate-700/70 p-5">
              <h3 className="font-semibold">Detected incidents</h3>
              <p className="mt-1 text-xs text-slate-500">
                Requests with HTTP 4xx and 5xx responses
              </p>
            </div>

            <div className="divide-y divide-slate-700/50">
              {logs
                .filter((log) => (log.statusCode ?? 0) >= 400)
                .map((log, index) => (
                  <div key={`${log.timestamp}-${index}`} className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                      <p className="font-medium">{log.endpoint ?? "Unknown endpoint"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.method ?? "—"} · {log.message ?? "No message"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={(log.statusCode ?? 0) >= 500 ? "text-red-400" : "text-amber-400"}>
                        HTTP {log.statusCode}
                      </span>
                      <span className="text-slate-400">
                        {log.latencyMs ?? "—"} ms
                      </span>
                    </div>
                  </div>
                ))}

              {!loading && logs.filter((log) => (log.statusCode ?? 0) >= 400).length === 0 && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No failed requests found in the loaded logs.
                </p>
              )}
            </div>
          </section>
        )}

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-700/70 p-5">
            <div>
              <h3 className="font-semibold">{activePage === "Overview" ? "Recent API logs" : "API Logs"}</h3>
              <p className="mt-1 text-xs text-slate-500">Latest recorded requests</p>
            </div>
            <span className="rounded-lg bg-slate-700/40 px-3 py-1.5 text-xs text-slate-400">
              {logs.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-[#172337] text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4">Endpoint</th>
                  <th className="px-5 py-4">Method</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Latency</th>
                  <th className="px-5 py-4">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {logs.map((log, index) => (
                  <tr key={`${log.timestamp}-${index}`} className="hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-medium">{log.endpoint ?? "—"}</td>
                    <td className="px-5 py-4 text-slate-400">{log.method ?? "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        (log.statusCode ?? 0) >= 500
                          ? "bg-red-500/10 text-red-400"
                          : (log.statusCode ?? 0) >= 400
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {log.statusCode ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {log.latencyMs ?? "—"} ms
                    </td>
                    <td className="max-w-[280px] truncate px-5 py-4 text-slate-500">
                      {log.message ?? "—"}
                    </td>
                  </tr>
                ))}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      No API logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        
        <footer className="mt-6 flex items-center justify-between text-xs text-slate-600">
          <span>DevPilot · Engineering intelligence</span>
          <span className="flex items-center gap-2">
            <LayoutDashboard size={13} /> Local development
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;
