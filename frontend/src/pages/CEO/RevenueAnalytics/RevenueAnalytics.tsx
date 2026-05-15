import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const revenueGrowth = [
  { month: "Jul", revenue: 2.1 }, { month: "Aug", revenue: 3.4 }, { month: "Sep", revenue: 5.2 },
  { month: "Oct", revenue: 7.8 }, { month: "Nov", revenue: 10.1 }, { month: "Dec", revenue: 12.4 },
  { month: "Jan", revenue: 14.2 }, { month: "Feb", revenue: 16.8 }, { month: "Mar", revenue: 18.4 },
];

const planDistribution = [
  { name: "Free", value: 68, color: "hsl(30, 8%, 45%)" },
  { name: "₹199/mo", value: 22, color: "#f97415" },
  { name: "₹299/mo", value: 10, color: "hsl(30, 10%, 22%)" },
];

const metrics = [
  { label: "Free Plan Users", value: "18,492" },
  { label: "Paid Users", value: "8,712" },
  { label: "Conversion Rate", value: "32%" },
  { label: "MRR", value: "₹18.4L" },
  { label: "ARR", value: "₹2.2Cr" },
  { label: "Churn Rate", value: "2.1%" },
  { label: "Trial → Paid", value: "28%" },
];

const chartStyle = { fontSize: 11, fill: "hsl(30, 8%, 45%)" };

const RevenueAnalytics = () => (
  <div className="space-y-4">
    <h2 className="section-title">💰 Subscription & Revenue</h2>
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="bg-card rounded-lg border border-border p-3">
          <p className="text-lg font-bold text-foreground">{m.value}</p>
          <p className="text-[10px] font-medium text-muted-foreground">{m.label}</p>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-card rounded-lg border border-border p-4">
        <p className="text-sm font-semibold mb-3 text-foreground">Revenue Growth (₹ Lakhs)</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={revenueGrowth}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 20%, 85%)" />
            <XAxis dataKey="month" tick={chartStyle} />
            <YAxis tick={chartStyle} />
            <Tooltip />
            <Area type="monotone" dataKey="revenue" stroke="hsl(152, 60%, 42%)" fill="hsl(152, 60%, 42%)" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-card rounded-lg border border-border p-4">
        <p className="text-sm font-semibold mb-3 text-foreground">Plan Distribution</p>
        <div className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={planDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
                {planDistribution.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </div>
);

export default RevenueAnalytics;
