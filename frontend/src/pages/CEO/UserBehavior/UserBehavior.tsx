const screenUsage = [
  { screen: "Chat", sessions: 42 },
  { screen: "Tasks", sessions: 28 },
  { screen: "Drawings", sessions: 18 },
  { screen: "RFIs", sessions: 8 },
  { screen: "Dashboard", sessions: 4 },
];

const metrics = [
  { label: "Avg Session Time", value: "18 min" },
  { label: "Sessions Per Day", value: "3.2" },
];

const UserBehavior = () => (
  <div className="space-y-4">
    <h2 className="section-title">👤 User Behavior Insights</h2>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="bg-card rounded-lg border border-border p-4">
            <p className="text-2xl font-bold text-foreground">{m.value}</p>
            <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-card rounded-lg border border-border p-4">
        <p className="text-sm font-semibold mb-3 text-foreground">Most Used Screens (% of sessions)</p>
        <div className="space-y-2">
          {screenUsage.map((s) => (
            <div key={s.screen} className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground w-20">{s.screen}</span>
              <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-primary rounded"
                  style={{ width: `${s.sessions}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-8">{s.sessions}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default UserBehavior;
