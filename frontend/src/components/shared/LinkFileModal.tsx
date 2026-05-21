import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getFiles } from '@/services/fileService';
import { Input } from '@/components/ui/input';
import { FileText, Link as LinkIcon } from 'lucide-react';

interface LinkFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | number;
  currentFileId: string | number;
  onLink: (targetFileId: string | number) => void;
}

export default function LinkFileModal({ open, onOpenChange, projectId, currentFileId, onLink }: LinkFileModalProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getFiles(projectId).then(data => {
        if (data.fileData) {
          setFiles(data.fileData.filter((f: any) => String(f.id) !== String(currentFileId)));
        }
      }).finally(() => setLoading(false));
    }
  }, [open, projectId, currentFileId]);

  const filtered = files.filter(f => (f.file_name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[200] max-w-md">
        <DialogHeader>
          <DialogTitle>Link a File</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input 
            placeholder="Search documents and photos..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
          <div className="max-h-60 overflow-y-auto space-y-2">
            {loading ? (
              <p className="text-center text-sm text-muted-foreground py-4">Loading files...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">No files found.</p>
            ) : (
              filtered.map(f => (
                <div key={f.id} className="flex items-center justify-between p-2 border rounded-md bg-card hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-2 overflow-hidden pr-2">
                    <FileText className="h-4 w-4 text-accent shrink-0" />
                    <span className="text-sm font-medium truncate">{f.file_name}</span>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => onLink(f.id)}>
                    <LinkIcon className="h-3.5 w-3.5 mr-1" /> Link
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
