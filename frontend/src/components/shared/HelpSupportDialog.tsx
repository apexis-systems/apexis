"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HelpCircle, Play, Search, X, ExternalLink, Youtube } from 'lucide-react';

interface HelpSupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface YouTubeVideo {
  id: string;
  title: string;
  duration: string;
  description?: string;
}

const youtubeTutorials: YouTubeVideo[] = [
  {
    id: 'JepGKRCDAmk',
    title: 'How to create a RFI from a photo',
    duration: '0:39',
    description: 'Learn how to generate a Request For Information (RFI) directly from a project photo.',
  },
  {
    id: 'joJ_s9nXLXg',
    title: 'How to create a snag on computer',
    duration: '0:33',
    description: 'Learn how to create and log a snag/issue from the web/computer portal.',
  },
  {
    id: 'uXy60dZKshk',
    title: 'How to create a RFI on a photo on computer',
    duration: '0:29',
    description: 'Creating RFIs on project photos using the web interface.',
  },
  {
    id: '8u7gZt2EOys',
    title: 'How to upload a document on a computer',
    duration: '0:43',
    description: 'Easily upload, organize, and store documents from your computer.',
  },
  {
    id: 'OfflHy2fanI',
    title: 'How to click a photo',
    duration: '0:30',
    description: 'Guidelines on taking and adding photos within the ApexisPro app.',
  },
  {
    id: 'qXnJHhu6MxE',
    title: 'How to add a snag',
    duration: '0:23',
    description: 'Quickly log snags on-site using your mobile device.',
  },
  {
    id: 'bpdf9xfnASU',
    title: 'How to upload a photo from phone gallery',
    duration: '0:25',
    description: 'Upload existing pictures from your phone gallery to the project gallery.',
  },
  {
    id: 'uVyOSkIvE1Y',
    title: 'How to link a document to a document',
    duration: '0:30',
    description: 'Connect related documents together for easier navigation.',
  },
  {
    id: 'p8bUX7P4Fts',
    title: 'How to send us a feedback',
    duration: '0:14',
    description: 'Help us improve by sending your feedback directly from the app.',
  },
  {
    id: 'tB41THJIaI4',
    title: 'How to change light mode to dark mode',
    duration: '0:12',
    description: 'Toggle between light and dark themes in settings.',
  },
  {
    id: 'TMShpJyGfXw',
    title: 'How to change language',
    duration: '0:20',
    description: 'Update the language settings in your profile.',
  },
  {
    id: '8E2aGUkYxN8',
    title: 'How to create a snag on a photo',
    duration: '0:31',
    description: 'Create and pin a snag directly onto an uploaded photo.',
  },
  {
    id: '86oxYFUHh54',
    title: 'How to respond to a RFI',
    duration: '0:20',
    description: 'Quick walkthrough on responding to open Requests For Information.',
  },
  {
    id: 'pd5mim3dhbY',
    title: 'How to Respond to RFI by linking to a photo',
    duration: '0:30',
    description: 'Attach visual proof when responding to a project RFI.',
  },
  {
    id: 'Sc1nxD_RxKc',
    title: 'Respond to RFI by linking a document',
    duration: '0:23',
    description: 'Reference files or drawings when answering an RFI.',
  },
  {
    id: 'cwk2UqHyhEw',
    title: 'How to Link a photo to a Document',
    duration: '1:02',
    description: 'Associate relevant site photos with files or documents.',
  },
  {
    id: '_r5jg07xVOs',
    title: 'How to onboard a client',
    duration: '0:15',
    description: 'Invite and onboard clients to your project workspace.',
  },
  {
    id: 'OUaO0dEKNmc',
    title: 'How to create a RFI on a document on phone',
    duration: '0:32',
    description: 'Mark up documents and raise RFIs directly from your phone.',
  },
  {
    id: '94e5BWsuVZM',
    title: 'How to organize RFIs for easier access',
    duration: '0:29',
    description: 'Manage and categorize RFIs to keep projects organized.',
  },
  {
    id: 'rIS7ReEeTvQ',
    title: 'How to create a RFI',
    duration: '0:47',
    description: 'Standard workflow for creating a new RFI.',
  },
  {
    id: 'fGIVed0-7tA',
    title: 'How to add Only For Reference mark on a document',
    duration: '0:23',
    description: 'Mark a document as "Only For Reference" (OFR).',
  },
  {
    id: '1b4kDjHXscc',
    title: 'How to add Do Not Follow mark on a document',
    duration: '0:22',
    description: 'Tag obsolete or updated documents as "Do Not Follow".',
  },
  {
    id: 'i3fH-XHu7Xw',
    title: 'How to upload a document on phone',
    duration: '0:40',
    description: 'Upload documents and files directly using your phone.',
  },
  {
    id: 'NBtk6Nkm7a4',
    title: 'How to change roles',
    duration: '0:14',
    description: 'Update project roles and privileges in workspace settings.',
  },
  {
    id: 'cX1LyzXD8hY',
    title: 'How to change profile photo and username',
    duration: '0:17',
    description: 'Edit your personal profile information.',
  },
  {
    id: '5iGohI_YJuM',
    title: 'How to change company settings',
    duration: '0:20',
    description: 'Modify company profile and settings.',
  },
  {
    id: 'PzIgB8YaFvk',
    title: 'How to onboard a contributor',
    duration: '0:18',
    description: 'Onboard and add team contributors to your workspace.',
  },
];

const faqs = [
  { q: 'How do I upload documents to a project?', a: 'Navigate to the project workspace, select the Documents tab, choose a folder, and click Upload.' },
  { q: 'How do I control what clients can see?', a: 'Admin users can toggle visibility on documents and photos using the eye icon.' },
  { q: 'Can I share files with external users?', a: 'Yes, use the Share button on any document or photo to share via WhatsApp, Email, or Copy Link.' },
  { q: 'What is the Snag List?', a: 'A task tracker for issues that need resolution. Each snag has a status, assignee, and comments.' },
];

const HelpSupportDialog = ({ open, onOpenChange }: HelpSupportDialogProps) => {
  const [activeTab, setActiveTab] = useState<'tutorials' | 'faq'>('tutorials');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVideo, setActiveVideo] = useState<YouTubeVideo | null>(null);

  const handleClose = () => {
    setActiveVideo(null);
    setSearchQuery('');
    onOpenChange(false);
  };

  const filteredTutorials = youtubeTutorials.filter(v =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFaqs = faqs.filter(f =>
    f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) handleClose();
      else onOpenChange(val);
    }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <HelpCircle className="h-5 w-5 text-accent" />
            Help & Support
          </DialogTitle>
        </DialogHeader>

        {/* Tabs switcher */}
        <div className="flex border-b border-border mb-4">
          <button
            onClick={() => {
              setActiveTab('tutorials');
              setActiveVideo(null);
            }}
            className={`flex-1 pb-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'tutorials'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Support Videos
          </button>
          <button
            onClick={() => {
              setActiveTab('faq');
              setActiveVideo(null);
            }}
            className={`flex-1 pb-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'faq'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            FAQs
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-4 shrink-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'tutorials' ? 'tutorials' : 'FAQs'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {searchQuery.length > 0 && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 p-0.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Active Player */}
        {activeTab === 'tutorials' && activeVideo && (
          <div className="bg-secondary/40 rounded-xl border border-border p-3 mb-4 shrink-0">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeVideo.id}?autoplay=1&modestbranding=1&rel=0&playsinline=1`}
                title={activeVideo.title}
                className="absolute inset-0 w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="mt-3 flex justify-between items-start gap-4">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-foreground">{activeVideo.title}</h4>
                {activeVideo.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{activeVideo.description}</p>
                )}
              </div>
              <button
                onClick={() => setActiveVideo(null)}
                className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
              <a
                href={`https://www.youtube.com/watch?v=${activeVideo.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-colors"
              >
                <Youtube className="h-3.5 w-3.5" />
                Open in YouTube
              </a>
              <button
                onClick={() => setActiveVideo(null)}
                className="px-3 py-1.5 rounded-lg bg-border hover:bg-secondary text-xs font-semibold text-foreground transition-colors"
              >
                Close Player
              </button>
            </div>
          </div>
        )}

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {activeTab === 'tutorials' && (
            filteredTutorials.length > 0 ? (
              filteredTutorials.map((v, i) => (
                <div
                  key={i}
                  onClick={() => setActiveVideo(v)}
                  className="flex gap-4 p-3 rounded-xl border border-border bg-card hover:bg-secondary/40 transition-all cursor-pointer group"
                >
                  {/* Thumbnail */}
                  <div className="relative w-32 aspect-video rounded-lg overflow-hidden bg-black shrink-0">
                    <img
                      src={`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`}
                      alt={v.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="h-8 w-8 rounded-full bg-white/95 shadow flex items-center justify-center transform group-hover:scale-110 transition-transform">
                        <Play className="h-4 w-4 text-black fill-black ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-black/75 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white">
                      {v.duration}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors truncate">
                      {v.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {v.description || 'Watch tutorial on YouTube'}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                        <Play className="h-3 w-3 fill-accent" />
                        Play Here
                      </span>
                      <a
                        href={`https://www.youtube.com/watch?v=${v.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Watch on YouTube
                      </a>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">No YouTube tutorials found</p>
            )
          )}

          {activeTab === 'faq' && (
            filteredFaqs.length > 0 ? (
              filteredFaqs.map((f, i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-card">
                  <h4 className="text-sm font-semibold text-foreground leading-relaxed">{f.q}</h4>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{f.a}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">No FAQs found</p>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HelpSupportDialog;
