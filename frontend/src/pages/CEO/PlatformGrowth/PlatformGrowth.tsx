import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const userGrowth = [
  { month: "Jul", users: 2400 },
  { month: "Aug", users: 3800 },
  { month: "Sep", users: 5200 },
  { month: "Oct", users: 7100 },
  { month: "Nov", users: 9800 },
  { month: "Dec", users: 12400 },
  { month: "Jan", users: 16200 },
  { month: "Feb", users: 21500 },
  { month: "Mar", users: 28900 },
];

const projectsPerWeek = [
  { week: "W1", projects: 42 },
  { week: "W2", projects: 58 },
  { week: "W3", projects: 51 },
  { week: "W4", projects: 67 },
  { week: "W5", projects: 73 },
  { week: "W6", projects: 89 },
  { week: "W7", projects: 95 },
  { week: "W8", projects: 112 },
];

const companiesPerMonth = [
  { month: "Jul", companies: 38 },
  { month: "Aug", companies: 52 },
  { month: "Sep", companies: 64 },
  { month: "Oct", companies: 78 },
  { month: "Nov", companies: 95 },
  { month: "Dec", companies: 112 },
  { month: "Jan", companies: 142 },
  { month: "Feb", companies: 168 },
  { month: "Mar", companies: 198 },
];

const chartStyle = { fontSize: 11, fill: "hsl(30, 8%, 45%)" };

const PlatformGrowth = () => {
  return (
    <div className="space-y-4">
      <h2 className="section-title">📊 Platform Growth</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm font-semibold mb-3 text-foreground">User Growth Over Time</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 20%, 85%)" />
              <XAxis dataKey="month" tick={chartStyle} />
              <YAxis tick={chartStyle} />
              <Tooltip />
              <Area type="monotone" dataKey="users" stroke="#f97415" fill="#f97415" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm font-semibold mb-3 text-foreground">Projects Created Per Week</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={projectsPerWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 20%, 85%)" />
              <XAxis dataKey="week" tick={chartStyle} />
              <YAxis tick={chartStyle} />
              <Tooltip />
              <Bar dataKey="projects" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm font-semibold mb-3 text-foreground">Companies Joining Per Month</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={companiesPerMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 20%, 85%)" />
              <XAxis dataKey="month" tick={chartStyle} />
              <YAxis tick={chartStyle} />
              <Tooltip />
              <Bar dataKey="companies" fill="hsl(30, 10%, 22%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default PlatformGrowth;
