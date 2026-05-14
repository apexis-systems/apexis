const projects = [
  { name: "Skyline Tower A", company: "Skyline Realty", completion: 78, delayed: 3, rfisPending: 2, drawingsAwaiting: 1, siteIssues: 0, status: "healthy" as const },
  { name: "Metro Bridge Phase 2", company: "Metro Infra Ltd", completion: 45, delayed: 8, rfisPending: 5, drawingsAwaiting: 3, siteIssues: 2, status: "attention" as const },
  { name: "Green Valley Mall", company: "Green Valley Developers", completion: 92, delayed: 0, rfisPending: 1, drawingsAwaiting: 0, siteIssues: 0, status: "healthy" as const },
  { name: "Highway NH-48 Ext", company: "National Highways Authority", completion: 34, delayed: 14, rfisPending: 12, drawingsAwaiting: 6, siteIssues: 5, status: "critical" as const },
  { name: "City Hospital Block C", company: "City Health Trust", completion: 61, delayed: 5, rfisPending: 4, drawingsAwaiting: 2, siteIssues: 1, status: "attention" as const },
  { name: "Prestige Lakeside", company: "Prestige Group", completion: 88, delayed: 1, rfisPending: 0, drawingsAwaiting: 0, siteIssues: 0, status: "healthy" as const },
  { name: "Godrej Horizon", company: "Godrej Properties", completion: 55, delayed: 6, rfisPending: 8, drawingsAwaiting: 4, siteIssues: 3, status: "critical" as const },
  { name: "Tech Park Phase 3", company: "TechSpace Infra", completion: 71, delayed: 2, rfisPending: 1, drawingsAwaiting: 1, siteIssues: 0, status: "healthy" as const },
];

const statusConfig = {
  healthy: { dot: "bg-success", label: "Healthy" },
  attention: { dot: "bg-warning", label: "Attention" },
  critical: { dot: "bg-destructive", label: "Critical" },
};

const ProjectHealth = () => (
  <div className="space-y-4">
    <h2 className="section-title">🏥 Project Health Dashboard</h2>
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-semibold text-foreground">Project</th>
              <th className="text-left p-3 font-semibold text-foreground">Status</th>
              <th className="text-left p-3 font-semibold text-foreground">Completion</th>
              <th className="text-center p-3 font-semibold text-foreground">Delayed</th>
              <th className="text-center p-3 font-semibold text-foreground">RFIs</th>
              <th className="text-center p-3 font-semibold text-foreground">Drawings</th>
              <th className="text-center p-3 font-semibold text-foreground">Issues</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.name} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="p-3">
                  <div className="font-medium text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.company}</div>
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${statusConfig[p.status].dot}`} />
                    <span className="text-xs font-medium text-muted-foreground">{statusConfig[p.status].label}</span>
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          p.status === "critical" ? "bg-destructive" : p.status === "attention" ? "bg-warning" : "bg-success"
                        }`}
                        style={{ width: `${p.completion}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{p.completion}%</span>
                  </div>
                </td>
                <td className="p-3 text-center">
                  <span className={p.delayed > 5 ? "text-destructive font-semibold" : "text-muted-foreground"}>{p.delayed}</span>
                </td>
                <td className="p-3 text-center">
                  <span className={p.rfisPending > 5 ? "text-accent font-semibold" : "text-muted-foreground"}>{p.rfisPending}</span>
                </td>
                <td className="p-3 text-center text-muted-foreground">{p.drawingsAwaiting}</td>
                <td className="p-3 text-center">
                  <span className={p.siteIssues > 2 ? "text-destructive font-semibold" : "text-muted-foreground"}>{p.siteIssues}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default ProjectHealth;
