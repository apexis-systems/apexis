import { CheckCircle2, AlertTriangle } from "lucide-react";

const metrics = [
  { label: "Server Uptime", value: "99.97%", status: "good" as const },
  { label: "API Response Time", value: "142ms", status: "good" as const },
  { label: "File Storage Used", value: "2.4 TB", status: "warning" as const },
  { label: "Failed Uploads", value: "0.02%", status: "good" as const },
];

const SystemHealth = () => (
  <div className="space-y-4">
    <h2 className="section-title">🖥️ System Health</h2>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="bg-card rounded-lg border border-border p-4 flex items-start gap-3">
          {m.status === "good" ? (
            <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          )}
          <div>
            <p className="text-lg font-bold text-foreground">{m.value}</p>
            <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default SystemHealth;
