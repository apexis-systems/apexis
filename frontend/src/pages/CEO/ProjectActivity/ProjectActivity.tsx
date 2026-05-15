import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const metrics = [
  { label: "Total Tasks Created", value: "24,891", sub: "All time" },
  { label: "Tasks Completed", value: "18,432", sub: "74% completion" },
  { label: "Tasks Pending", value: "6,459", sub: "Active" },
  { label: "Avg Completion Time", value: "3.2 days", sub: "↓ from 4.1" },
  { label: "Total RFIs Raised", value: "4,218", sub: "All time" },
  { label: "RFIs Resolved", value: "3,891", sub: "92% resolved" },
  { label: "Avg RFI Resolution", value: "2.8 days", sub: "↓ from 3.5" },
  { label: "Total Drawings", value: "12,847", sub: "Uploaded" },
  { label: "Versions Released", value: "34,291", sub: "All revisions" },
  { label: "Site Updates Posted", value: "8,492", sub: "This month +18%" },
];

const tasksPerDay = [
  { day: "Mon", completed: 380 }, { day: "Tue", completed: 420 }, { day: "Wed", completed: 390 },
  { day: "Thu", completed: 450 }, { day: "Fri", completed: 410 }, { day: "Sat", completed: 180 },
  { day: "Sun", completed: 110 },
];

const rfisPerProject = [
  { project: "Tower A", rfis: 42 }, { project: "Bridge X", rfis: 38 },
  { project: "Mall Y", rfis: 28 }, { project: "Highway", rfis: 22 },
  { project: "Hospital", rfis: 18 },
];

const chartStyle = { fontSize: 11, fill: "hsl(30, 8%, 45%)" };

const ProjectActivity = () => (
  <div className="space-y-4">
    <h2 className="section-title">🏗️ Project Activity Analytics</h2>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="bg-card rounded-lg border border-border p-3">
          <p className="text-lg font-bold text-foreground">{m.value}</p>
          <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-card rounded-lg border border-border p-4">
        <p className="text-sm font-semibold mb-3 text-foreground">Tasks Completed Per Day</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={tasksPerDay}>
             <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 20%, 85%)" />
             <XAxis dataKey="day" tick={chartStyle} />
             <YAxis tick={chartStyle} />
             <Tooltip />
             <Bar dataKey="completed" fill="#f97415" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-card rounded-lg border border-border p-4">
        <p className="text-sm font-semibold mb-3 text-foreground">RFIs Per Project</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={rfisPerProject} layout="vertical">
             <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 20%, 85%)" />
             <XAxis type="number" tick={chartStyle} />
             <YAxis type="category" dataKey="project" tick={chartStyle} width={70} />
             <Tooltip />
             <Bar dataKey="rfis" fill="hsl(30, 10%, 22%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

export default ProjectActivity;
