import { Building2, FolderKanban, Users, CheckCircle2, AlertCircle, MessageSquare, TrendingUp, DollarSign } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

const sparkData = (vals: number[]) => vals.map((v, i) => ({ v, i }));

const kpis = [
  {
    label: "Active Companies",
    value: "1,284",
    change: "+12%",
    positive: true,
    icon: Building2,
    spark: sparkData([40, 55, 48, 62, 58, 72, 80]),
    color: "#f97415",
  },
  {
    label: "Active Projects",
    value: "3,847",
    change: "+8%",
    positive: true,
    icon: FolderKanban,
    spark: sparkData([120, 135, 128, 142, 155, 160, 172]),
    color: "hsl(152, 60%, 42%)",
  },
  {
    label: "Daily Active Users",
    value: "12,459",
    change: "+15%",
    positive: true,
    icon: Users,
    spark: sparkData([800, 920, 880, 1050, 1100, 1180, 1250]),
    color: "#f97415",
  },
  {
    label: "Tasks Completed Today",
    value: "2,341",
    change: "+5%",
    positive: true,
    icon: CheckCircle2,
    spark: sparkData([180, 200, 195, 220, 210, 235, 240]),
    color: "hsl(152, 60%, 42%)",
  },
  {
    label: "RFIs Pending",
    value: "127",
    change: "+3",
    positive: false,
    icon: AlertCircle,
    spark: sparkData([95, 102, 98, 110, 115, 120, 127]),
    color: "#f97415",
  },
  {
    label: "Messages Sent Today",
    value: "48,291",
    change: "+22%",
    positive: true,
    icon: MessageSquare,
    spark: sparkData([3200, 3800, 3500, 4100, 4300, 4500, 4830]),
    color: "#f97415",
  },
  {
    label: "New Companies This Week",
    value: "47",
    change: "+18%",
    positive: true,
    icon: TrendingUp,
    spark: sparkData([28, 32, 30, 35, 38, 42, 47]),
    color: "hsl(152, 60%, 42%)",
  },
  {
    label: "Revenue (MRR)",
    value: "₹18.4L",
    change: "+24%",
    positive: true,
    icon: DollarSign,
    spark: sparkData([8, 9.5, 10, 12, 14, 16, 18.4]),
    color: "#f97415",
  },
];

const KPICards = () => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="bg-card rounded-lg border border-border p-4 relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-md" style={{ backgroundColor: `${kpi.color}15` }}>
              <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
            </div>
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                kpi.positive
                  ? "bg-success/10 text-success"
                  : "bg-accent/10 text-accent"
              }`}
            >
              {kpi.change}
            </span>
          </div>
          <p className="kpi-value mt-1" style={{ color: "hsl(var(--foreground))" }}>
            {kpi.value}
          </p>
          <p className="kpi-label mt-0.5">{kpi.label}</p>
          <div className="absolute bottom-0 right-0 w-24 h-10 opacity-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kpi.spark}>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={kpi.color}
                  fill={kpi.color}
                  fillOpacity={0.2}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default KPICards;
