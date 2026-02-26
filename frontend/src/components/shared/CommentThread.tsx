"use client";

import { useState } from 'react';
import { Comment } from '@/types';
import { mockComments } from '@/data/mock';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Reply, Send } from 'lucide-react';

interface CommentThreadProps {
  targetId: string;
  targetType: 'document' | 'photo';
}

const CommentThread = ({ targetId, targetType }: CommentThreadProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>(
    mockComments.filter((c) => c.targetId === targetId && c.targetType === targetType)
  );
  const [newText, setNewText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const addComment = () => {
    if (!newText.trim() || !user) return;
    const comment: Comment = {
      id: `c-${Date.now()}`,
      targetId,
      targetType,
      userId: user.id,
      userName: user.name,
      text: newText.trim(),
      timestamp: 'Just now',
      parentId: replyTo || undefined,
    };
    setComments((prev) => [...prev, comment]);
    setNewText('');
    setReplyTo(null);
  };

  const topLevel = comments.filter((c) => !c.parentId);
  const replies = (parentId: string) => comments.filter((c) => c.parentId === parentId);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="h-3.5 w-3.5 text-accent" />
        <span className="text-xs font-semibold text-foreground">Comments ({comments.length})</span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {topLevel.map((c) => (
          <div key={c.id}>
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-foreground">{c.userName}</span>
                <span className="text-[9px] text-muted-foreground">{c.timestamp}</span>
              </div>
              <p className="text-xs text-foreground mt-0.5">{c.text}</p>
              <button
                onClick={() => setReplyTo(c.id)}
                className="flex items-center gap-1 mt-1 text-[9px] text-accent hover:underline"
              >
                <Reply className="h-2.5 w-2.5" /> Reply
              </button>
            </div>
            {/* Replies */}
            {replies(c.id).map((r) => (
              <div key={r.id} className="ml-4 mt-1 rounded-lg bg-muted/50 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-foreground">{r.userName}</span>
                  <span className="text-[9px] text-muted-foreground">{r.timestamp}</span>
                </div>
                <p className="text-xs text-foreground mt-0.5">{r.text}</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Input */}
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
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Add a comment..."
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && addComment()}
              maxLength={500}
            />
          </div>
          <Button onClick={addComment} size="sm" className="h-8 w-8 p-0 bg-accent text-accent-foreground hover:bg-accent/90">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default CommentThread;
