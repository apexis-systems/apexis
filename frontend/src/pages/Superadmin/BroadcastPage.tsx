"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Send, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { sendBroadcast } from "@/services/superadminService";

const cardClass = "rounded-xl border border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)] backdrop-blur-xl";
const strongTextClass = "text-[hsl(30_10%_15%)] dark:text-[hsl(38_20%_90%)]";
const mutedTextClass = "text-[hsl(30_8%_45%)] dark:text-[hsl(38_10%_55%)]";

export default function BroadcastPage() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in both title and description");
      return;
    }

    setIsSending(true);
    setSentCount(null);

    try {
      const data = await sendBroadcast(title, description);

      toast.success("Broadcast sent successfully!");
      setSentCount(data.count);
      setTitle("");
      setDescription("");
    } catch (error: any) {
      console.error("Broadcast Error:", error);
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight flex items-center gap-2 ${strongTextClass}`}>
            <Megaphone className="w-8 h-8 text-primary" />
            Platform Broadcast
          </h1>
          <p className={`${mutedTextClass} mt-2`}>
            Send a platform-wide notification to all registered users.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className={cardClass}>
            <CardHeader className="px-0 pt-0">
              <CardTitle className={strongTextClass}>Compose Message</CardTitle>
              <CardDescription className={mutedTextClass}>
                Craft your message carefully. This will be sent as a push notification and saved in user notification centers.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <form onSubmit={handleBroadcast} className="space-y-4">
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${strongTextClass}`}>Message Title</label>
                  <Input
                    placeholder="e.g., Scheduled Maintenance"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-white/50 dark:bg-zinc-950/50 border-[hsl(35_15%_85%)] dark:border-[hsl(30_8%_22%)] text-[hsl(30_10%_15%)] dark:text-white focus:ring-primary h-12"
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${strongTextClass}`}>Description / Body</label>
                  <Textarea
                    placeholder="Enter the detailed announcement..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-white/50 dark:bg-zinc-950/50 border-[hsl(35_15%_85%)] dark:border-[hsl(30_8%_22%)] text-[hsl(30_10%_15%)] dark:text-white focus:ring-primary min-h-[200px] resize-none"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  disabled={isSending}
                  className="w-full h-12 text-lg font-semibold group relative overflow-hidden bg-primary hover:bg-primary/90 text-white"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Sending Broadcast...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      Send to All Users
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className={cardClass}>
            <CardHeader className="px-0 pt-0">
              <CardTitle className={`text-sm ${strongTextClass}`}>Broadcast Guidelines</CardTitle>
            </CardHeader>
            <CardContent className={`px-0 pb-0 text-sm ${mutedTextClass} space-y-4`}>
              <div className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p>Broadcasts reach every active user on the platform.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p>Use concise titles that grab attention immediately.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p>Ensure the description provides all necessary details or next steps.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 flex-shrink-0" />
                <p className="text-red-600 dark:text-red-400 font-medium">Avoid excessive broadcasting to prevent notification fatigue.</p>
              </div>
            </CardContent>
          </Card>

          {sentCount !== null && (
            <Card className="bg-emerald-500/10 border-emerald-500/20 animate-in fade-in slide-in-from-bottom-4">
              <CardContent className="pt-6 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className={`font-bold text-lg ${strongTextClass}`}>Broadcast Sent!</h3>
                <p className={`${mutedTextClass} text-sm`}>
                  Successfully delivered to <span className="text-emerald-500 font-bold">{sentCount}</span> users.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
