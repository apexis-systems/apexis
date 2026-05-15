import { Brain, TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

const insights = [
  { icon: TrendingDown, text: "Project delays increased 18% in the last 2 weeks. Top cause: drawing approval bottlenecks.", type: "warning" },
  { icon: TrendingUp, text: "Companies with >10 users are 4x more likely to convert to paid plans.", type: "insight" },
  { icon: Lightbulb, text: "RFI response time is 2.3x slower in projects with >50 team members. Consider auto-routing.", type: "suggestion" },
  { icon: TrendingUp, text: "Chat adoption grew 34% after push notification launch. Consider similar for Tasks.", type: "insight" },
  { icon: Lightbulb, text: "48% of drawings are uploaded between 8-10 PM. Server scaling recommended.", type: "suggestion" },
];

const IntelligencePanel = () => (
  <div className="space-y-3">
    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
      <Brain className="h-4 w-4 text-primary" />
      Construction Intelligence
    </h3>
    <div className="space-y-2">
      {insights.map((ins, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 + i * 0.1 }}
          className="p-2.5 rounded-md border border-primary/20 bg-primary/5"
        >
          <div className="flex items-start gap-2">
            <ins.icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <p className="text-xs text-foreground leading-tight">{ins.text}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

export default IntelligencePanel;
