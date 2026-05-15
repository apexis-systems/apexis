import { AlertTriangle, Clock, FileWarning, HardDrive } from "lucide-react";
import { motion } from "framer-motion";

const alerts = [
  { icon: AlertTriangle, text: "3 projects inactive for 14+ days", severity: "critical" as const },
  { icon: Clock, text: "5 company trials ending in 3 days", severity: "warning" as const },
  { icon: FileWarning, text: "Highway NH-48: 12 unresolved RFIs", severity: "critical" as const },
  { icon: HardDrive, text: "Storage at 78% capacity", severity: "warning" as const },
  { icon: AlertTriangle, text: "Godrej Horizon: 8 RFIs pending > 7 days", severity: "critical" as const },
  { icon: Clock, text: "2 drawings awaiting approval > 5 days", severity: "warning" as const },
];

const severityStyles = {
  critical: "border-destructive/30 bg-destructive/5",
  warning: "border-warning/30 bg-warning/5",
};

const iconStyles = {
  critical: "text-destructive",
  warning: "text-warning",
};

const AlertsPanel = () => (
  <div className="space-y-3">
    <h3 className="text-sm font-bold text-foreground">🚨 Alerts</h3>
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className={`flex items-start gap-2 p-2.5 rounded-md border ${severityStyles[a.severity]}`}
        >
          <a.icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${iconStyles[a.severity]}`} />
          <p className="text-xs text-foreground leading-tight">{a.text}</p>
        </motion.div>
      ))}
    </div>
  </div>
);

export default AlertsPanel;
