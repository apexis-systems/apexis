import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getFiles, getLinkedItems } from '@/services/fileService';
import { Input } from '@/components/ui/input';
import { FileText, Folder, CornerLeftUp, Check, X, Search, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface LinkFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | number;
  currentFileId?: string | number;
  linkedFileIds?: (string | number)[];
  onLink: (targetFileId: string | number) => void;
  onRemoveLink?: (targetFileId: string | number) => void;
  onlyPhotos?: boolean;
  handleLinkItemClick?: (item: any) => void;
}

export default function LinkFileModal({ open, onOpenChange, projectId, currentFileId, linkedFileIds, onLink, onRemoveLink, onlyPhotos, handleLinkItemClick }: LinkFileModalProps) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'document' | 'photo'>('document');
  const [mainTab, setMainTab] = useState<'linked' | 'link'>('linked');
  const [linkedSubTab, setLinkedSubTab] = useState<string>('rfi');
  const [currentParentId, setCurrentParentId] = useState<string | number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [linkedItems, setLinkedItems] = useState<any[]>([]);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | number | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setSelectedIds(new Set());
      setSearchQuery('');
      setCurrentParentId(null);
      if (onlyPhotos) setActiveTab('photo');

      const fetchLinks = async () => {
        if (currentFileId) return await getLinkedItems(currentFileId);
        return { links: [] };
      };

      Promise.all([
        getFiles(projectId),
        fetchLinks()
      ]).then(([fileDataRes, linkDataRes]) => {
        if (fileDataRes.fileData) {
          setFiles(fileDataRes.fileData);
          if (linkedFileIds) {
            const linked = fileDataRes.fileData.filter((f: any) => linkedFileIds.includes(f.id) || linkedFileIds.includes(String(f.id)));
            setLinkedItems(linked.map((f: any) => ({ ...f, type: 'file' })));
          }
        }
        if (fileDataRes.folderData) setFolders(fileDataRes.folderData);
        if (linkDataRes.links && currentFileId) setLinkedItems(linkDataRes.links);
      }).catch(err => {
        console.error(err);
      }).finally(() => {
        setLoading(false);
      });
    } else {
      setSearchQuery('');
      setCurrentParentId(null);
      setLinkedItems([]);
      setSelectedIds(new Set());
    }
  }, [open, projectId, currentFileId, linkedFileIds, onlyPhotos]);

  const handleRemoveLink = async (item: any) => {
    const targetId = item.id || item.target_id;
    setUnlinkingId(targetId);
    try {
      if (onRemoveLink) {
        await onRemoveLink(targetId);
      }
    } catch (error) {
      console.error('Failed to remove link:', error);
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleTabChange = (tab: 'document' | 'photo') => {
    setActiveTab(tab);
    setCurrentParentId(null);
  };

  const getValidFolders = () =>
    folders.filter(f => {
      const n = (f.name || '').toLowerCase();
      return n !== 'archive' && n !== 'confirmation' && n !== 'confirmations';
    });

  const getFoldersInCurrentLevel = () => {
    const valid = getValidFolders();
    return valid.filter(f => {
      if (currentParentId === null) {
        return (f.folder_type === activeTab || !f.folder_type) && String(f.parent_id ?? 'null') === 'null';
      }
      return String(f.parent_id) === String(currentParentId);
    });
  };

  const getFilesInCurrentLevel = () =>
    files.filter(f => {
      if (String(f.id) === String(currentFileId)) return false;
      if (currentParentId === null) {
        if (f.folder_id !== null && f.folder_id !== undefined) {
          if (folders.some(fold => String(fold.id) === String(f.folder_id))) return false;
        }
        return (f.file_type?.startsWith('image/') ? 'photo' : 'document') === activeTab;
      } else {
        if (String(f.folder_id) !== String(currentParentId)) return false;
        return true;
      }
    });

  const getFilteredSearchFiles = () =>
    files.filter(f => {
      if (String(f.id) === String(currentFileId)) return false;
      if (!f.file_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      const isImg = f.file_type?.startsWith('image/') ||
        f.file_name?.toLowerCase().endsWith('.jpg') ||
        f.file_name?.toLowerCase().endsWith('.png') ||
        f.file_name?.toLowerCase().endsWith('.jpeg');
      return (isImg ? 'photo' : 'document') === activeTab;
    });

  const getBreadcrumbs = () => {
    const tabLabel = activeTab === 'document' ? t('documents') : t('photos');
    if (currentParentId === null) return tabLabel;
    const path: string[] = [];
    let current = folders.find(f => String(f.id) === String(currentParentId));
    while (current) {
      path.unshift(current.name);
      current = folders.find(f => String(f.id) === String(current.parent_id));
    }
    return tabLabel + ' > ' + path.join(' > ');
  };

  const goUp = () => {
    if (currentParentId === null) return;
    const currentFolderObj = folders.find(f => String(f.id) === String(currentParentId));
    setCurrentParentId(currentFolderObj ? (currentFolderObj.parent_id ?? null) : null);
  };

  const handleConfirmLink = async () => {
    if (selectedIds.size === 0) return;
    setLinking(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => onLink(id)));
      setSelectedIds(new Set());
    } finally {
      setLinking(false);
    }
  };

  const foldersInCurrentLevel = getFoldersInCurrentLevel();
  const filesInCurrentLevel = getFilesInCurrentLevel();
  const searchFiles = getFilteredSearchFiles();

  const isFilePhoto = (item: any) => {
    const name = (item.title || item.file_name || item.name || '').toLowerCase();
    return item.file_type?.startsWith('image/') ||
      name.endsWith('.jpg') || name.endsWith('.jpeg') ||
      name.endsWith('.png') || name.endsWith('.gif') || name.endsWith('.webp');
  };

  const linkedDocs = linkedItems.filter(i => (i.type === 'file' || i.target_type === 'file') && !isFilePhoto(i));
  const linkedPhotos = linkedItems.filter(i => (i.type === 'file' || i.target_type === 'file') && isFilePhoto(i));
  const linkedRFIs = linkedItems.filter(i => i.type === 'rfi' || i.target_type === 'rfi');
  const linkedSnags = linkedItems.filter(i => i.type === 'snag' || i.target_type === 'snag');

  const linkedSubTabs = [
    ...(linkedRFIs.length > 0 ? [{ key: 'rfi', label: `RFI (${linkedRFIs.length})`, color: 'text-rose-500', border: 'border-rose-500', bg: 'bg-rose-500/10' }] : []),
    ...(linkedSnags.length > 0 ? [{ key: 'snag', label: `Snags (${linkedSnags.length})`, color: 'text-orange-500', border: 'border-orange-500', bg: 'bg-orange-500/10' }] : []),
    ...(linkedPhotos.length > 0 ? [{ key: 'photo', label: `Photos (${linkedPhotos.length})`, color: 'text-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-500/10' }] : []),
    ...(linkedDocs.length > 0 ? [{ key: 'doc', label: `Docs (${linkedDocs.length})`, color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-500/10' }] : []),
  ];

  const activeLinkedSubTab = linkedSubTabs.find(s => s.key === linkedSubTab)
    ? linkedSubTab
    : (linkedSubTabs[0]?.key || 'rfi');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden bg-background z-[60]"
        overlayClassName="z-[60]"
      >
        <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-lg">{t('link_a_file')}</DialogTitle>
        </DialogHeader>

        {/* Main Tabs */}
        <div className="flex border-b bg-muted/10 shrink-0">
          {(['linked', 'link'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className={cn(
                "flex-1 py-3 text-sm font-semibold transition-colors border-b-2",
                mainTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {tab === 'linked'
                ? `Linked Items${linkedItems.length > 0 ? ` (${linkedItems.length})` : ''}`
                : t('link_a_file')}
            </button>
          ))}
        </div>

        {/* ── LINKED ITEMS TAB ── */}
        {mainTab === 'linked' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p>{t('loading_files')}</p>
              </div>
            ) : linkedItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground opacity-60">
                <FileText className="h-12 w-12" />
                <p>No items linked yet.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Sub-tabs */}
                {linkedSubTabs.length > 0 && (
                  <div className="flex border-b bg-muted/5 shrink-0 overflow-x-auto no-scrollbar">
                    {linkedSubTabs.map(st => (
                      <button
                        key={st.key}
                        onClick={() => setLinkedSubTab(st.key)}
                        className={cn(
                          "px-6 py-3 text-xs font-bold transition-colors border-b-2 whitespace-nowrap",
                          activeLinkedSubTab === st.key ? `${st.border} ${st.color}` : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
                        )}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                )}
                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4 bg-muted/5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(() => {
                      let itemsToRender = [];
                      if (activeLinkedSubTab === 'rfi') itemsToRender = linkedRFIs;
                      if (activeLinkedSubTab === 'snag') itemsToRender = linkedSnags;
                      if (activeLinkedSubTab === 'photo') itemsToRender = linkedPhotos;
                      if (activeLinkedSubTab === 'doc') itemsToRender = linkedDocs;

                      return itemsToRender.map(item => {
                        const key = item.id || item.target_id;
                        const name = item.title || item.file_name || item.name || item.subject || '—';
                        return (
                          <div
                            key={key}
                            onClick={() => handleLinkItemClick?.(item)}
                            className="relative h-[110px] rounded-xl border border-border bg-card flex flex-col p-3 cursor-pointer hover:border-primary/40 transition-colors"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="p-1.5 rounded-md bg-muted">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveLink(item); }}
                                disabled={unlinkingId === key}
                                className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                              >
                                {unlinkingId === key ? <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" /> : <X className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            <p className="text-xs font-medium line-clamp-2 text-foreground" title={name}>{name}</p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LINK A FILE TAB ── */}
        {mainTab === 'link' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="p-4 border-b bg-muted/20 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('search_files')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-background"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Sub-tabs & Breadcrumbs */}
            {!searchQuery && (
              <div className="shrink-0 flex flex-col border-b">
                <div className="flex bg-muted/10">
                  {(['document', 'photo'] as const).filter(tab => !(onlyPhotos && tab === 'document')).map(tab => (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      className={cn(
                        "flex-1 py-3 text-sm font-semibold transition-colors border-b-2",
                        activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      {tab === 'document' ? t('documents') : t('photos')}
                    </button>
                  ))}
                </div>
                <div className="flex items-center px-4 py-2 bg-muted/20 text-xs text-muted-foreground gap-2 overflow-x-auto whitespace-nowrap">
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                  <span>{getBreadcrumbs()}</span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 bg-muted/5">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p>{t('loading_files')}</p>
                </div>
              ) : searchQuery ? (
                searchFiles.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {searchFiles.map(item => (
                      <FileCard
                        key={item.id}
                        item={item}
                        linkedItems={linkedItems}
                        selectedIds={selectedIds}
                        setSelectedIds={setSelectedIds}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <Search className="h-10 w-10 opacity-20" />
                    <p>{t('no_files_matching')} "{searchQuery}"</p>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  {(currentParentId !== null || foldersInCurrentLevel.length > 0) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {currentParentId !== null && (
                        <button onClick={goUp} className="h-[100px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-background hover:bg-accent/5 transition-colors gap-2 group">
                          <CornerLeftUp className="h-6 w-6 text-primary group-hover:-translate-y-1 transition-transform" />
                          <span className="text-xs font-semibold">{t('go_up')}</span>
                        </button>
                      )}
                      {foldersInCurrentLevel.map(folder => {
                        const childFolders = folders.filter(f => String(f.parent_id) === String(folder.id));
                        const childFiles = files.filter(p => String(p.folder_id) === String(folder.id));
                        const count = childFiles.length;
                        const subcount = childFolders.length;
                        return (
                          <button key={folder.id} onClick={() => setCurrentParentId(folder.id)} className="h-[100px] flex flex-col items-center justify-center border rounded-xl bg-background hover:bg-accent/5 transition-colors gap-1 p-2">
                            <Folder className="h-8 w-8 text-primary opacity-80" />
                            <span className="text-xs font-semibold text-center line-clamp-1 w-full px-2" title={folder.name}>{folder.name}</span>
                            <span className="text-[10px] text-muted-foreground text-center line-clamp-1 w-full px-1">
                              {count === 0 && subcount === 0
                                ? t('files_count_label').replace('{count}', '0')
                                : <>{t('files_count_label').replace('{count}', String(count))}{subcount > 0 ? `, ${t(subcount === 1 ? 'folder_count_label' : 'folders_count_label').replace('{count}', String(subcount))}` : ''}</>
                              }
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {filesInCurrentLevel.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {filesInCurrentLevel.map(item => (
                        <FileCard
                          key={item.id}
                          item={item}
                          linkedItems={linkedItems}
                          selectedIds={selectedIds}
                          setSelectedIds={setSelectedIds}
                        />
                      ))}
                    </div>
                  )}

                  {foldersInCurrentLevel.length === 0 && filesInCurrentLevel.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-3 opacity-60">
                      <Folder className="h-12 w-12" />
                      <p>{currentParentId === null ? t('no_docs_yet') : t('folder_is_empty')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {selectedIds.size > 0 && (
          <div className="p-4 border-t shrink-0 flex gap-3 bg-background shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedIds(new Set())}>
              {t('cancel')}
            </Button>
            <Button className="flex-[2]" onClick={handleConfirmLink} disabled={linking}>
              {linking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t('link')} {selectedIds.size} {selectedIds.size > 1 ? t('files') : t('file')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FileCard({ item, linkedItems, selectedIds, setSelectedIds }: { item: any, linkedItems: any[], selectedIds: Set<string | number>, setSelectedIds: any }) {
  const isAlreadyLinked = linkedItems.some(link => link.type === 'file' && String(link.id) === String(item.id));
  const isSelected = selectedIds.has(item.id);

  const isImage = item.file_type?.startsWith('image/') ||
    item.file_name?.toLowerCase().endsWith('.jpg') ||
    item.file_name?.toLowerCase().endsWith('.png') ||
    item.file_name?.toLowerCase().endsWith('.jpeg');

  const toggleSelect = () => {
    if (isAlreadyLinked) return;
    setSelectedIds((prev: Set<string | number>) => {
      const next = new Set(prev);
      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
      return next;
    });
  };

  const checked = isAlreadyLinked || isSelected;

  return (
    <div
      onClick={toggleSelect}
      className={cn(
        "relative h-[130px] rounded-xl border flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-all bg-background",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50",
        isAlreadyLinked && "opacity-70 cursor-not-allowed grayscale-[0.5]"
      )}
    >
      <div className="absolute top-2 right-2 z-10">
        <div className={cn(
          "w-5 h-5 rounded flex items-center justify-center border shadow-sm transition-colors",
          checked ? (isAlreadyLinked ? "bg-muted-foreground border-transparent" : "bg-primary border-primary") : "border-muted-foreground/30 bg-background/50 backdrop-blur-sm"
        )}>
          {checked && <Check className="h-3.5 w-3.5 text-white" />}
        </div>
      </div>

      {isImage ? (
        <>
          <div className="absolute inset-0">
            {item.downloadUrl ? (
              <img src={item.downloadUrl} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <ImageIcon className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <p className="text-[10px] font-medium text-white text-center truncate w-full" title={item.file_name}>
              {item.file_name}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center w-full">
            <div className="p-3 bg-primary/10 rounded-xl">
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="w-full p-2 bg-muted/30 border-t mt-auto">
            <p className="text-[11px] font-medium text-center truncate w-full px-1" title={item.file_name}>
              {item.file_name}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
