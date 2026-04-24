"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Reply, Send, Loader2 } from 'lucide-react';
import { Comment, getComments, addComment as addCommentApi } from '@/services/commentService';

interface CommentThreadProps {
  targetId: string | number;
  targetType: 'document' | 'photo' | string;
  projectId?: string | number;
}

import { getMemberForTag } from '@/services/projectService';

const CommentThread = ({ targetId, targetType, projectId }: CommentThreadProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newText, setNewText] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [comments, loading]);

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    getComments(targetId, targetType)
      .then(setComments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [targetId, targetType]);

  useEffect(() => {
    if (projectId) {
      getMemberForTag(projectId).then(data => {
        if (data.members) {
          const uniqueUsers = data.members
            .map((m: any) => m.user || m.users || m)
            .filter((u: any, index: number, self: any[]) =>
              u && u.id && u.name &&
              self.findIndex(t => String(t.id) === String(u.id)) === index
            );
          setMembers(uniqueUsers);
        }
      });
    }
  }, [projectId, user?.id]);

  const handleTextChange = (val: string) => {
    setNewText(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
      const query = val.substring(lastAt + 1);
      if (!query.includes(' ')) {
        setMentionQuery(query);
        setShowMentions(true);
        setMentionIndex(lastAt);
        return;
      }
    }
    setShowMentions(false);
  };

  const selectMention = (m: any) => {
    const before = newText.substring(0, mentionIndex);
    setNewText(`${before}@[${m.id}:${m.name}] `);
    setShowMentions(false);
  };

  const renderText = (text: string) => {
    const mentionRegex = /(@\[(\d+):([^\]]+)\])/g;
    const parts = text.split(mentionRegex);
    const result = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i % 4 === 1 || i % 4 === 2) continue;
      if (i % 4 === 3) {
        result.push(<span key={i} className="font-bold text-accent">@{part}</span>);
        continue;
      }
      if (part) result.push(part);
    }
    return result;
  };

  const handleAdd = async () => {
    if (!newText.trim() || !user) return;
    setSending(true);
    try {
      const c = await addCommentApi({ target_id: targetId, target_type: targetType, text: newText.trim(), parent_id: replyTo ?? undefined });
      setComments(prev => [...prev, c]);
      setNewText('');
      setReplyTo(null);
    } catch (e) { console.error('addComment', e); }
    finally { setSending(false); }
  };

  const topLevel = comments.filter(c => !c.parent_id);
  const replies = (pid: number) => comments.filter(c => c.parent_id === pid);
  const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="flex flex-col h-full border-t border-border pt-3">
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        <MessageSquare className="h-3.5 w-3.5 text-accent" />
        <span className="text-xs font-semibold text-foreground">Comments & Tags ({comments.length})</span>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-accent" /></div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-0">
          {topLevel.map(c => (
            <div key={c.id}>
              <div className="rounded-lg bg-secondary/50 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-foreground">{c.user?.name || 'User'}</span>
                  <span className="text-[9px] text-muted-foreground">{fmt(c.createdAt)}</span>
                </div>
                <p className="text-xs text-foreground mt-0.5">{renderText(c.text)}</p>
                <button onClick={() => setReplyTo(c.id)} className="flex items-center gap-1 mt-1 text-[9px] text-accent hover:underline">
                  <Reply className="h-2.5 w-2.5" /> Reply
                </button>
              </div>
              {replies(c.id).map(r => (
                <div key={r.id} className="ml-4 mt-1 rounded-lg bg-muted/50 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-foreground">{r.user?.name || 'User'}</span>
                    <span className="text-[9px] text-muted-foreground">{fmt(r.createdAt)}</span>
                  </div>
                  <p className="text-xs text-foreground mt-0.5">{renderText(r.text)}</p>
                </div>
              ))}
            </div>
          ))}
          {topLevel.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-2">No comments yet</p>
          )}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      )}

      {user && (
        <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="flex items-center gap-2 mt-2 shrink-0">
          <div className="flex-1">
            {replyTo && (
              <div className="text-[9px] text-accent mb-0.5">
                Replying to comment...{' '}
                <button type="button" onClick={() => setReplyTo(null)} className="text-muted-foreground hover:underline">Cancel</button>
              </div>
            )}
            <div className="relative">
              <Input
                value={newText}
                onChange={e => handleTextChange(e.target.value)}
                placeholder="Add a comment... (@ to tag)"
                className="h-8 text-xs"
                maxLength={500}
                disabled={sending}
              />
              {showMentions && members.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).length > 0 && (
                <div className="absolute bottom-full left-0 w-[280px] bg-popover text-popover-foreground border border-border rounded-md shadow-md mb-1 z-50 max-h-48 overflow-y-auto py-1 animate-in fade-in slide-in-from-bottom-1 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Mentions
                  </div>
                  {members.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).map(m => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => selectMention(m)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent/10 transition-colors flex items-center gap-2.5"
                    >
                      <div className="h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center text-[9px] font-bold text-accent shrink-0">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium truncate">{m.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button 
            type="submit"
            size="sm" 
            disabled={sending || !newText.trim()} 
            className="h-8 w-8 p-0 bg-accent text-accent-foreground hover:bg-accent/90 shrink-0 relative z-10 cursor-pointer"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      )}
    </div>
  );
};

export default CommentThread;
