import React, { useMemo, useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, BackHandler } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Text } from '@/components/ui/AppText';
import { useTranslation } from 'react-i18next';
import { deleteTrashItemPermanently, getTrashItems, restoreTrashItem } from '@/services/trashService';

const CATEGORY_ORDER = ['project', 'folder', 'document', 'photo', 'rfi', 'snag', 'manual'];

const getItemIcon = (itemType: string) => {
  if (itemType === 'project') return 'briefcase';
  if (itemType === 'photo') return 'camera';
  if (itemType === 'folder') return 'folder';
  if (itemType === 'rfi') return 'help-circle';
  if (itemType === 'snag') return 'alert-triangle';
  if (itemType === 'manual') return 'book-open';
  return 'file-text';
};

const getItemLabel = (itemType: string) => {
  if (itemType === 'project') return 'Projects';
  if (itemType === 'document') return 'Documents';
  if (itemType === 'photo') return 'Photos';
  if (itemType === 'folder') return 'Folders';
  if (itemType === 'rfi') return 'RFIs';
  if (itemType === 'snag') return 'Snags';
  if (itemType === 'manual') return 'Manuals';
  return 'Items';
};

interface NestedTrashItem {
  id: string | number;
  itemType: string;
  name: string;
  deletedAt: string;
}

interface TrashItem {
  id: string | number;
  itemType: string;
  name: string;
  description?: string | null;
  deletedAt: string;
  daysRemaining: number;
  projectName: string;
  itemSubType?: string | null;
  totalDocs?: number;
  totalPhotos?: number;
  canRestore?: boolean;
  canDeleteForever?: boolean;
  nestedItems?: NestedTrashItem[];
  nestedItemsCount?: number;
}

export default function TrashScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const fetchTrash = useCallback(async () => {
    try {
      const data = await getTrashItems(user?.organization?.id);
      const nextItems = data.items || [];
      setItems(nextItems);
      setOpenSections((prev) => {
        const next: Record<string, boolean> = {};
        CATEGORY_ORDER.forEach((category, index) => {
          if (nextItems.some((item: TrashItem) => item.itemType === category)) {
            next[category] = prev[category] ?? index < 2;
          }
        });
        return next;
      });
    } catch (e) {
      console.error('Failed to fetch trash', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.organization?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchTrash();

      const onBackPress = () => {
        router.push('/settings');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [fetchTrash, router])
  );

  const groupedItems = useMemo(() => {
    return CATEGORY_ORDER
      .map((category) => ({
        category,
        label: getItemLabel(category),
        items: items.filter((item) => item.itemType === category),
      }))
      .filter((group) => group.items.length > 0);
  }, [items]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrash();
  };

  const handleRestore = async (item: TrashItem) => {
    try {
      const actionKey = `${item.itemType}-${item.id}`;
      setIsRestoring(actionKey);
      await restoreTrashItem(item.itemType, item.id);
      Alert.alert(t('trash.successTitle') as string, t('trash.successRestore') as string);
      fetchTrash();
    } catch {
      Alert.alert(t('trash.errorTitle') as string, t('trash.errorRestore') as string);
    } finally {
      setIsRestoring(null);
    }
  };

  const handlePermanentDelete = (item: TrashItem) => {
    Alert.alert(
      t('trash.permanentDeleteTitle') as string,
      t('trash.permanentDeleteDesc') as string,
      [
        { text: t('trash.cancel') as string, style: 'cancel' },
        {
          text: t('trash.deletePermanently') as string,
          style: 'destructive',
          onPress: async () => {
            try {
              const actionKey = `${item.itemType}-${item.id}`;
              setIsDeleting(actionKey);
              await deleteTrashItemPermanently(item.itemType, item.id);
              Alert.alert(t('trash.successTitle') as string, t('trash.successDelete') as string);
              fetchTrash();
            } catch {
              Alert.alert(t('trash.errorTitle') as string, t('trash.errorDelete') as string);
            } finally {
              setIsDeleting(null);
            }
          },
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <View style={{ paddingTop: 20, paddingHorizontal: 24, marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>{t('trash.title')}</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>{t('trash.emptyDesc')}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 100 }}>
            <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Feather name="trash-2" size={40} color={colors.textMuted} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{t('trash.emptyTitle')}</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 }}>
              {t('trash.emptyDesc')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {groupedItems.map((group) => {
              const isOpen = openSections[group.category];

              return (
                <View key={group.category} style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                  <TouchableOpacity
                    onPress={() => setOpenSections((prev) => ({ ...prev, [group.category]: !prev[group.category] }))}
                    style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name={getItemIcon(group.category) as any} size={18} color={colors.text} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{group.label}</Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>{group.items.length} items in recovery</Text>
                      </View>
                    </View>
                    <Feather name={isOpen ? 'chevron-down' : 'chevron-right'} size={20} color={colors.textMuted} />
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={{ padding: 14, gap: 12 }}>
                      {group.items.map((item) => {
                        const actionKey = `${item.itemType}-${item.id}`;
                        const folderKey = `folder-${item.id}`;
                        const folderOpen = !!openFolders[folderKey];

                        return (
                          <View key={actionKey} style={{ backgroundColor: colors.background, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, position: 'relative' }}>
                            <View style={{
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              backgroundColor: item.daysRemaining <= 5 ? '#ef4444' : '#f59e0b',
                              paddingHorizontal: 12,
                              paddingVertical: 4,
                              borderBottomLeftRadius: 16,
                              borderTopRightRadius: 20,
                            }}>
                              <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>
                                {item.daysRemaining === 1 ? t('trash.dayLeft', { count: item.daysRemaining }) : t('trash.daysLeft', { count: item.daysRemaining })}
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', marginRight: 88 }}>
                              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Feather name={getItemIcon(item.itemType) as any} size={18} color={colors.text} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.1 }}>
                                  {item.itemType === 'folder' && item.itemSubType === 'photo' ? 'Photo Folder' : item.itemType === 'folder' ? 'Doc Folder' : getItemLabel(item.itemType).slice(0, -1)}
                                </Text>
                                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }} numberOfLines={1}>{item.name}</Text>
                                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }} numberOfLines={2}>{item.description || t('trash.noDescription')}</Text>
                              </View>
                            </View>

                            <View style={{ marginTop: 14, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}>
                              <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>
                                <Text style={{ fontWeight: '700', color: colors.text }}>Project:</Text> {item.projectName}
                              </Text>
                              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                                {new Date(item.deletedAt).toLocaleDateString()}
                              </Text>
                            </View>

                            {item.itemType === 'project' && (
                              <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Feather name="file-text" size={14} color={colors.textMuted} />
                                  <Text style={{ fontSize: 13, color: colors.textMuted }}><Text style={{ fontWeight: '700', color: colors.text }}>{item.totalDocs || 0}</Text> {t('trash.documents')}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Feather name="camera" size={14} color={colors.textMuted} />
                                  <Text style={{ fontSize: 13, color: colors.textMuted }}><Text style={{ fontWeight: '700', color: colors.text }}>{item.totalPhotos || 0}</Text> {t('trash.photos')}</Text>
                                </View>
                              </View>
                            )}

                            {item.itemType === 'folder' && (item.nestedItemsCount || 0) > 0 && (
                              <View style={{ marginTop: 12, borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                                <TouchableOpacity
                                  onPress={() => setOpenFolders((prev) => ({ ...prev, [folderKey]: !prev[folderKey] }))}
                                  style={{ paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Inside this folder</Text>
                                  <Text style={{ fontSize: 12, color: colors.textMuted }}>{item.nestedItemsCount} items</Text>
                                </TouchableOpacity>

                                {folderOpen && (
                                  <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
                                    {item.nestedItems?.map((nestedItem) => (
                                      <View key={`${nestedItem.itemType}-${nestedItem.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 9 }}>
                                        <Feather name={getItemIcon(nestedItem.itemType) as any} size={14} color={colors.textMuted} />
                                        <Text style={{ fontSize: 13, color: colors.text, flex: 1 }} numberOfLines={1}>{nestedItem.name}</Text>
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                            )}

                            {(item.canRestore || item.canDeleteForever) && (
                              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                                {item.canRestore && (
                                  <TouchableOpacity
                                    onPress={() => handleRestore(item)}
                                    disabled={isRestoring === actionKey}
                                    style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                                  >
                                    {isRestoring === actionKey ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="rotate-ccw" size={17} color={colors.primary} />}
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>{t('trash.restore')}</Text>
                                  </TouchableOpacity>
                                )}

                                {item.canDeleteForever && (
                                  <TouchableOpacity
                                    onPress={() => handlePermanentDelete(item)}
                                    disabled={isDeleting === actionKey}
                                    style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                                  >
                                    {isDeleting === actionKey ? <ActivityIndicator size="small" color="#ef4444" /> : <Feather name="trash-2" size={17} color="#ef4444" />}
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#ef4444' }}>{t('trash.delete')}</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
