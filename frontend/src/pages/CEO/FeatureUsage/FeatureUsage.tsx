const features = [
  { name: "Chat", usage: 92, color: "#f97415" },
  { name: "Tasks", usage: 65, color: "hsl(152, 60%, 42%)" },
  { name: "Drawings", usage: 48, color: "hsl(30, 10%, 22%)" },
  { name: "RFIs", usage: 34, color: "hsl(0, 84%, 60%)" },
  { name: "Site Updates", usage: 28, color: "hsl(38, 92%, 50%)" },
];

const FeatureUsage = () => (
  <div className="space-y-4">
    <h2 className="section-title">⚡ Feature Usage Analytics</h2>
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="space-y-3">
        {features.map((f) => (
          <div key={f.name} className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground w-24">{f.name}</span>
            <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
              <div
                className="h-full rounded flex items-center pl-2 transition-all duration-500"
                style={{ width: `${f.usage}%`, backgroundColor: f.color }}
              >
                <span className="text-[11px] font-semibold" style={{ color: "white" }}>{f.usage}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default FeatureUsage;
