const companies = [
  { name: "Shapoorji Pallonji", projects: 24, users: 186, messages: 42800, tasks: 3200 },
  { name: "L&T Infrastructure", projects: 18, users: 142, messages: 38200, tasks: 2800 },
  { name: "Godrej Properties", projects: 15, users: 98, messages: 28400, tasks: 2100 },
  { name: "Prestige Group", projects: 12, users: 85, messages: 22100, tasks: 1800 },
  { name: "Sobha Limited", projects: 10, users: 72, messages: 18500, tasks: 1400 },
  { name: "Brigade Group", projects: 8, users: 56, messages: 14200, tasks: 1100 },
  { name: "Puravankara", projects: 7, users: 48, messages: 11800, tasks: 900 },
  { name: "Tata Realty", projects: 6, users: 42, messages: 9400, tasks: 780 },
];

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();

const CompanyUsage = () => (
  <div className="space-y-4">
    <h2 className="section-title">🏢 Company Usage Analytics</h2>
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-semibold text-foreground">#</th>
              <th className="text-left p-3 font-semibold text-foreground">Company</th>
              <th className="text-center p-3 font-semibold text-foreground">Projects</th>
              <th className="text-center p-3 font-semibold text-foreground">Users</th>
              <th className="text-center p-3 font-semibold text-foreground">Messages</th>
              <th className="text-center p-3 font-semibold text-foreground">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c, i) => (
              <tr key={c.name} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="p-3 text-muted-foreground font-medium">{i + 1}</td>
                <td className="p-3 font-medium text-foreground">{c.name}</td>
                <td className="p-3 text-center text-muted-foreground">{c.projects}</td>
                <td className="p-3 text-center text-muted-foreground">{c.users}</td>
                <td className="p-3 text-center text-muted-foreground">{fmt(c.messages)}</td>
                <td className="p-3 text-center text-muted-foreground">{fmt(c.tasks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default CompanyUsage;
