import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const metrics = [
  { label: "Total Messages Sent", value: "1.2M" },
  { label: "Messages per Project", value: "312 avg" },
  { label: "Messages per Day", value: "48,291" },
  { label: "Attachments Shared", value: "89,412" },
];

const attachmentBreakdown = [
  { type: "Photos", count: 42180 },
  { type: "PDFs", count: 28340 },
  { type: "Drawings", count: 12450 },
  { type: "Videos", count: 6442 },
];

const messagesPerDay = [
  { day: "Mon", msgs: 52000 }, { day: "Tue", msgs: 58000 }, { day: "Wed", msgs: 55000 },
  { day: "Thu", msgs: 61000 }, { day: "Fri", msgs: 49000 }, { day: "Sat", msgs: 22000 },
  { day: "Sun", msgs: 12000 },
];

const mostActiveTeams = [
  { team: "Shapoorji Pallonji", msgs: 12400 },
  { team: "L&T Infra", msgs: 10800 },
  { team: "Godrej Properties", msgs: 9200 },
  { team: "Prestige Group", msgs: 7800 },
  { team: "Sobha Ltd", msgs: 6500 },
];

const chartStyle = { fontSize: 11, fill: "hsl(30, 8%, 45%)" };

const CommunicationAnalytics = () => (
  <div className="space-y-4">
    <h2 className="section-title">💬 Communication Analytics</h2>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="bg-card rounded-lg border border-border p-3">
          <p className="text-xl font-bold text-foreground">{m.value}</p>
          <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-card rounded-lg border border-border p-4">
        <p className="text-sm font-semibold mb-3 text-foreground">Messages Per Day</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={messagesPerDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 20%, 85%)" />
            <XAxis dataKey="day" tick={chartStyle} />
            <YAxis tick={chartStyle} />
            <Tooltip />
            <Line type="monotone" dataKey="msgs" stroke="#f97415" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-card rounded-lg border border-border p-4">
        <p className="text-sm font-semibold mb-3 text-foreground">Most Active Teams</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={mostActiveTeams} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 20%, 85%)" />
            <XAxis type="number" tick={chartStyle} />
            <YAxis type="category" dataKey="team" tick={chartStyle} width={100} />
            <Tooltip />
            <Bar dataKey="msgs" fill="hsl(152, 60%, 42%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

export default CommunicationAnalytics;
