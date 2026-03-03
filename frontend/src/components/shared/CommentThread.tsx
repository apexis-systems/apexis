"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Reply, Send, Loader2 } from 'lucide-react';
import { Comment, getComments, addComment as addCommentApi } from '@/services/commentService';

interface CommentThreadProps {
  targetId: string | number;
  targetType: 'document' | 'photo' | string;
}

const CommentThread = ({ targetId, targetType }: CommentThreadProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newText, setNewText] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);

  useEffect(() => {
    if (!targetId) return;
    getComments(targetId, targetType)
      .then(setComments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [targetId, targetType]);

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
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="h-3.5 w-3.5 text-accent" />
        <span className="text-xs font-semibold text-foreground">Comments ({comments.length})</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-accent" /></div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {topLevel.map(c => (
            <div key={c.id}>
              <div className="rounded-lg bg-secondary/50 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-foreground">{c.user?.name || 'User'}</span>
                  <span className="text-[9px] text-muted-foreground">{fmt(c.createdAt)}</span>
                </div>
                <p className="text-xs text-foreground mt-0.5">{c.text}</p>
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
                  <p className="text-xs text-foreground mt-0.5">{r.text}</p>
                </div>
              ))}
            </div>
          ))}
          {topLevel.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-2">No comments yet</p>
          )}
        </div>
      )}

      {user && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1">
            {replyTo && (
              <div className="text-[9px] text-accent mb-0.5">
                Replying to comment...{' '}
                <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:underline">Cancel</button>
              </div>
            )}
            <Input
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Add a comment..."
              className="h-8 text-xs"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              maxLength={500}
              disabled={sending}
            />
          </div>
          <Button onClick={handleAdd} size="sm" disabled={sending} className="h-8 w-8 p-0 bg-accent text-accent-foreground hover:bg-accent/90">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CommentThread;
