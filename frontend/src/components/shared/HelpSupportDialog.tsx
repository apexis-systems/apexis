"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlayCircle, HelpCircle, Video } from 'lucide-react';

interface HelpSupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const videos = [
  { title: 'Getting Started with Apexis', duration: '3:45' },
  { title: 'Uploading Documents & Photos', duration: '2:30' },
  { title: 'Managing Project Permissions', duration: '4:10' },
  { title: 'Using the Snag List', duration: '3:00' },
];

const faqs = [
  { q: 'How do I upload documents to a project?', a: 'Navigate to the project workspace, select the Documents tab, choose a folder, and click Upload.' },
  { q: 'How do I control what clients can see?', a: 'Admin users can toggle visibility on documents and photos using the eye icon.' },
  { q: 'Can I share files with external users?', a: 'Yes, use the Share button on any document or photo to share via WhatsApp, Email, or Copy Link.' },
  { q: 'What is the Snag List?', a: 'A task tracker for issues that need resolution. Each snag has a status, assignee, and comments.' },
];

const HelpSupportDialog = ({ open, onOpenChange }: HelpSupportDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-accent" />
            Help & Support
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="videos" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="videos" className="flex-1 text-xs">Support Videos</TabsTrigger>
            <TabsTrigger value="tutorials" className="flex-1 text-xs">YouTube Tutorials</TabsTrigger>
            <TabsTrigger value="faq" className="flex-1 text-xs">FAQs</TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="mt-4 space-y-2">
            {videos.map((v, i) => (
              <button key={i} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 hover:bg-secondary/50 transition-colors text-left">
                <PlayCircle className="h-8 w-8 text-accent shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{v.title}</p>
                  <p className="text-xs text-muted-foreground">{v.duration}</p>
                </div>
              </button>
            ))}
          </TabsContent>

          <TabsContent value="tutorials" className="mt-4 space-y-2">
            {videos.map((v, i) => (
              <button key={i} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 hover:bg-secondary/50 transition-colors text-left">
                <Video className="h-8 w-8 text-destructive shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{v.title}</p>
                  <p className="text-xs text-muted-foreground">YouTube · {v.duration}</p>
                </div>
              </button>
            ))}
          </TabsContent>

          <TabsContent value="faq" className="mt-4 space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">{f.q}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.a}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default HelpSupportDialog;
