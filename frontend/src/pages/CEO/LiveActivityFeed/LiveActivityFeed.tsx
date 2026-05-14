import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, MessageSquare, AlertCircle, Camera, FileText, CheckCircle2 } from "lucide-react";

interface FeedItem {
    id: number;
    icon: typeof Upload;
    text: string;
    time: string;
    color: string;
}

const initialFeed: FeedItem[] = [
    { id: 1, icon: Upload, text: "Architect uploaded Drawing Rev 3 – Skyline Tower A", time: "2 min ago", color: "#f97415" },
    { id: 2, icon: Camera, text: "Site engineer posted slab casting photos – Metro Bridge", time: "5 min ago", color: "hsl(152, 60%, 42%)" },
    { id: 3, icon: AlertCircle, text: "Contractor raised RFI – Staircase detail – Highway NH-48", time: "8 min ago", color: "hsl(0, 84%, 60%)" },
    { id: 4, icon: CheckCircle2, text: "Task 'Foundation inspection' completed – Green Valley Mall", time: "12 min ago", color: "hsl(152, 60%, 42%)" },
    { id: 5, icon: MessageSquare, text: "New message thread started – Prestige Lakeside team", time: "15 min ago", color: "#f97415" },
    { id: 6, icon: FileText, text: "Site update report generated – City Hospital Block C", time: "15 min ago", color: "hsl(30, 8%, 45%)" },
    { id: 7, icon: Upload, text: "Structural drawing v4.2 uploaded – Godrej Horizon", time: "22 min ago", color: "#f97415" },
    { id: 8, icon: CheckCircle2, text: "RFI #1042 resolved – Sobha Ltd waterproofing spec", time: "25 min ago", color: "hsl(152, 60%, 42%)" },
];

const newItems: Omit<FeedItem, "id">[] = [
    { icon: Camera, text: "Progress photos uploaded – Tech Park Phase 3", time: "Just now", color: "hsl(152, 60%, 42%)" },
    { icon: AlertCircle, text: "New RFI raised – Electrical routing – Skyline Tower A", time: "Just now", color: "hsl(0, 84%, 60%)" },
    { icon: MessageSquare, text: "PM tagged in chat – Budget review – Metro Bridge", time: "Just now", color: "#f97415" },
    { icon: Upload, text: "MEP drawing Rev 2 uploaded – City Hospital", time: "Just now", color: "#f97415" },
];

const LiveActivityFeed = () => {
    const [feed, setFeed] = useState(initialFeed);
    const [nextId, setNextId] = useState(9);
    const [newIdx, setNewIdx] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setNewIdx((prev) => {
                const idx = prev % newItems.length;
                const item = { ...newItems[idx], id: nextId + prev, time: "Just now" };
                setFeed((f) => [item as FeedItem, ...f.slice(0, 9)]);
                return prev + 1;
            });
        }, 8000);
        return () => clearInterval(interval);
    }, [nextId]);

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                Live Activity Feed
            </h3>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                    {feed.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: -8, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors"
                        >
                            <item.icon className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: item.color }} />
                            <div className="min-w-0">
                                <p className="text-xs text-foreground leading-tight">{item.text}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default LiveActivityFeed;
