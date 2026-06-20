"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Reply, Send, Loader2, Edit2, Trash2, X, Check } from 'lucide-react';
import { Comment, getComments, addComment as addCommentApi, updateComment as updateCommentApi, deleteComment as deleteCommentApi } from '@/services/commentService';

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
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editSending, setEditSending] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const canEditOrDelete = (c: Comment) => {
    if (!user || String(c.user_id) !== String(user.id)) return false;
    if (c.is_deleted) return false;
    const baseTime = c.edited_at ? new Date(c.edited_at) : new Date(c.createdAt);
    const diffMs = Date.now() - baseTime.getTime();
    return diffMs <= 5 * 60 * 1000;
  };

  const handleEditSave = async (id: number) => {
    if (!editingText.trim()) return;
    setEditSending(true);
    try {
      const updated = await updateCommentApi(id, editingText.trim());
      setComments(prev => prev.map(item => item.id === id ? updated : item));
      setEditingId(null);
      setEditingText('');
    } catch (e) {
      console.error('Failed to update comment:', e);
    } finally {
      setEditSending(false);
    }
  };

  const handleCommentDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      const updated = await deleteCommentApi(id);
      setComments(prev => prev.map(item => item.id === id ? updated : item));
    } catch (e) {
      console.error('Failed to delete comment:', e);
    }
  };

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
    setNewText('');
    setReplyTo(null);
    setShowMentions(false);
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
        setSelectedMentionIndex(0);
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

  const filteredMembers = members.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase()));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectMention(filteredMembers[selectedMentionIndex]);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    }
  };

  useEffect(() => {
    if (showMentions) {
      const el = document.getElementById(`mention-item-${selectedMentionIndex}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedMentionIndex, showMentions]);

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
    finally {
      setSending(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const topLevel = comments.filter(c => !c.parent_id);
  const replies = (pid: number) => comments.filter(c => c.parent_id === pid);
  const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  const renderCommentBubble = (c: Comment, isReply: boolean) => {
    const isEditing = editingId === c.id;
    const editable = canEditOrDelete(c);

    return (
      <div key={c.id} className={`${isReply ? 'ml-4 mt-1 bg-muted/30' : 'bg-secondary/50'} rounded-lg p-2 transition-all mt-1`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-foreground">{c.user?.name || 'User'}</span>
            {c.is_edited && !c.is_deleted && (
              <span className="text-[8px] bg-accent/10 text-accent px-1 rounded font-medium">Edited</span>
            )}
            {c.is_deleted && (
              <span className="text-[8px] bg-destructive/10 text-destructive px-1 rounded font-medium">Deleted</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground">{fmt(c.createdAt)}</span>
            {editable && !isEditing && (
              <div className="flex items-center gap-1.5 ml-1">
                <button 
                  onClick={() => { setEditingId(c.id); setEditingText(c.text); }}
                  className="text-muted-foreground hover:text-accent transition-colors cursor-pointer"
                  title="Edit comment"
                >
                  <Edit2 className="h-2.5 w-2.5" />
                </button>
                <button 
                  onClick={() => handleCommentDelete(c.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  title="Delete comment"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Input
              value={editingText}
              onChange={e => setEditingText(e.target.value)}
              className="h-7 text-xs flex-1"
              disabled={editSending}
              autoFocus
            />
            <Button
              size="sm"
              onClick={() => handleEditSave(c.id)}
              disabled={editSending || !editingText.trim()}
              className="h-7 w-7 p-0 bg-accent text-accent-foreground hover:bg-accent/90 shrink-0 cursor-pointer"
            >
              {editSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setEditingId(null); setEditingText(''); }}
              disabled={editSending}
              className="h-7 w-7 p-0 shrink-0 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="mt-0.5">
            {c.is_deleted ? (
              <div>
                <p className="text-xs text-muted-foreground/60 line-through italic mt-0.5">
                  {renderText(c.text)}
                </p>
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[8px] font-semibold uppercase tracking-wider mt-1">
                  Comment Deleted • {fmt(c.deleted_at || c.createdAt)}
                </div>
              </div>
            ) : c.is_edited && c.edit_history && c.edit_history.length > 0 ? (
              <div className="space-y-1 mt-1 border-l-2 border-accent/25 pl-1.5 py-0.5">
                {c.edit_history.map((hist, idx) => (
                  <div key={idx} className="text-[10px] text-muted-foreground/80 flex flex-col gap-0.5 mb-1 last:mb-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold uppercase tracking-wider text-[6px] bg-muted px-1 py-0.2 rounded font-mono shrink-0">
                        Prev v{idx + 1}
                      </span>
                      <span className="line-through truncate text-muted-foreground/75">{hist.text}</span>
                    </div>
                    <span className="text-[7px] text-muted-foreground/60 italic ml-10">
                      Edited at {fmt(hist.editedAt)}
                    </span>
                  </div>
                ))}
                <div className="text-xs text-foreground flex items-center gap-1.5 pt-1 border-t border-border/20 mt-1">
                  <span className="font-semibold uppercase tracking-wider text-[6px] bg-accent/15 text-accent px-1 py-0.2 rounded shrink-0 font-mono">Current</span>
                  <span>{renderText(c.text)}</span>
                </div>
                <div className="text-[8px] text-muted-foreground/70 italic">
                  Last updated at {fmt(c.edited_at || c.createdAt)}
                </div>
              </div>
            ) : (
              <p className="text-xs text-foreground mt-0.5">{renderText(c.text)}</p>
            )}
          </div>
        )}

        {!isReply && !c.is_deleted && (
          <button onClick={() => setReplyTo(c.id)} className="flex items-center gap-1 mt-1 text-[9px] text-accent hover:underline cursor-pointer">
            <Reply className="h-2.5 w-2.5" /> Reply
          </button>
        )}
      </div>
    );
  };

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
              {renderCommentBubble(c, false)}
              {replies(c.id).map(r => renderCommentBubble(r, true))}
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
                ref={inputRef}
                value={newText}
                onChange={e => handleTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a comment... (@ to tag)"
                className="h-8 text-xs"
                maxLength={500}
                disabled={sending}
              />
              {showMentions && filteredMembers.length > 0 && (
                <div className="absolute bottom-full left-0 w-[280px] bg-popover text-popover-foreground border border-border rounded-md shadow-md mb-1 z-50 max-h-48 overflow-y-auto py-1 animate-in fade-in slide-in-from-bottom-1 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Mentions
                  </div>
                  {filteredMembers.map((m, idx) => (
                    <button
                      id={`mention-item-${idx}`}
                      type="button"
                      key={m.id}
                      onClick={() => selectMention(m)}
                      onMouseDown={(e) => e.preventDefault()}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2.5 ${idx === selectedMentionIndex ? 'bg-accent/20' : 'hover:bg-accent/10'}`}
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
