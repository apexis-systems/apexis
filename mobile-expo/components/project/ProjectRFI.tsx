import React, { useState, useCallback, useEffect } from 'react';
import {
  View, TouchableOpacity, FlatList, BackHandler, ActivityIndicator,
  Modal, ScrollView, TextInput, Alert, Image, StyleSheet
} from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Project, User } from '@/types';
import {
  getRFIs, createRFI, updateRFIStatus, RFI, getRFIAssignees
} from '@/services/rfiService';
import { getAssignees, Assignee } from '@/services/snagService';

interface Props {
  project: Project;
  user: User;
}

const statusConfig = {
  open: { icon: 'alert-circle', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Open' },
  closed: { icon: 'check-circle', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Closed' },
  overdue: { icon: 'alert-triangle', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Overdue' },
};

export default function ProjectRFI({ project, user }: Props) {
  const { colors, isDark } = useTheme();
  const [rfis, setRfis] = useState<RFI[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'overdue'>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRFI, setSelectedRFI] = useState<RFI | null>(null);

  // Create Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToId, setAssignedToId] = useState<number | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Filter Modals
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilterType, setActiveFilterType] = useState<'status' | 'creator' | 'assignee' | null>(null);

  const projectId = Number(project.id);

  const fetchRFIs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRFIs(projectId);
      setRfis(data);
    } catch (err) {
      console.error('fetchRFIs error', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchAssignees = useCallback(async () => {
    try {
      const data = await getRFIAssignees(projectId);
      setAssignees(data);
    } catch (err) {
      console.error('fetchAssignees error', err);
    }
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      fetchRFIs();
      fetchAssignees();

      const onBackPress = () => {
        if (detailModalVisible) {
          setDetailModalVisible(false);
          return true;
        }
        if (createModalVisible) {
          setCreateModalVisible(false);
          return true;
        }
        if (statusFilter !== 'all') {
          setStatusFilter('all');
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [detailModalVisible, createModalVisible, statusFilter, fetchRFIs, fetchAssignees])
  );

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setSelectedImages([...selectedImages, ...result.assets.map(a => a.uri)]);
    }
  };

  const handleCreateRFI = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('project_id', String(projectId));
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      if (assignedToId) formData.append('assigned_to', String(assignedToId));

      selectedImages.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `photo_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        formData.append('photos', { uri, name: filename, type } as any);
      });

      await createRFI(formData);
      Alert.alert('Success', 'RFI created successfully');
      setCreateModalVisible(false);
      setTitle('');
      setDescription('');
      setSelectedImages([]);
      setAssignedToId(null);
      fetchRFIs();
    } catch (err) {
      console.error('handleCreateRFI error', err);
      Alert.alert('Error', 'Failed to create RFI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await updateRFIStatus(id, status);
      fetchRFIs();
      if (selectedRFI?.id === id) {
        setSelectedRFI({ ...selectedRFI, status: status as any });
      }
    } catch (err) {
      console.error('handleStatusUpdate error', err);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const filteredRfis = rfis.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesCreator = creatorFilter === 'all' || String(r.created_by) === creatorFilter;
    const matchesAssignee = assigneeFilter === 'all' || 
                           (assigneeFilter === 'null' ? !r.assigned_to : String(r.assigned_to) === assigneeFilter);
    return matchesStatus && matchesCreator && matchesAssignee;
  });

  const renderRFI = ({ item }: { item: RFI }) => {
    const config = statusConfig[item.status] || statusConfig.open;
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedRFI(item);
          setDetailModalVisible(true);
        }}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: config.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={config.icon as any} size={20} color={config.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>{item.title}</Text>
              <View style={{ backgroundColor: config.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: config.color }}>{config.label}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }} numberOfLines={2}>{item.description}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 8, color: colors.textMuted }}>{item.creator?.name?.charAt(0) || '?'}</Text>
                </View>
                <Text style={{ fontSize: 10, color: colors.textMuted }}>by {item.creator?.name || 'Unknown'}</Text>
              </View>
              {item.assignee && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="user" size={10} color={colors.primary} />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.primary }}>{item.assignee.name}</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <Feather name="clock" size={10} color={colors.textMuted} />
              <Text style={{ fontSize: 10, color: colors.textMuted }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <TouchableOpacity
        onPress={() => setCreateModalVisible(true)}
        style={{
          backgroundColor: colors.primary,
          height: 44,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 16
        }}
      >
        <Feather name="plus" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>New RFI</Text>
      </TouchableOpacity>

      {/* Dropdown Filters */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TouchableOpacity
          onPress={() => { setActiveFilterType('status'); setFilterModalVisible(true); }}
          style={{
            flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10,
            backgroundColor: statusFilter !== 'all' ? colors.primary + '10' : colors.surface
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: statusFilter !== 'all' ? colors.primary : colors.textMuted }}>
            {statusFilter === 'all' ? 'STATUS' : statusFilter.toUpperCase()}
          </Text>
          <Feather name="chevron-down" size={12} color={statusFilter !== 'all' ? colors.primary : colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setActiveFilterType('creator'); setFilterModalVisible(true); }}
          style={{
            flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10,
            backgroundColor: creatorFilter !== 'all' ? colors.primary + '10' : colors.surface
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: creatorFilter !== 'all' ? colors.primary : colors.textMuted }} numberOfLines={1}>
            {creatorFilter === 'all' ? 'CREATOR' : (rfis.find(r => String(r.created_by) === creatorFilter)?.creator?.name || 'CREATOR').toUpperCase()}
          </Text>
          <Feather name="chevron-down" size={12} color={creatorFilter !== 'all' ? colors.primary : colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setActiveFilterType('assignee'); setFilterModalVisible(true); }}
          style={{
            flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10,
            backgroundColor: assigneeFilter !== 'all' ? colors.primary + '10' : colors.surface
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: assigneeFilter !== 'all' ? colors.primary : colors.textMuted }} numberOfLines={1}>
            {assigneeFilter === 'all' ? 'ASSIGNEE' : (assigneeFilter === 'null' ? 'UNASSIGNED' : (rfis.find(r => String(r.assigned_to) === assigneeFilter)?.assignee?.name || 'ASSIGNEE').toUpperCase())}
          </Text>
          <Feather name="chevron-down" size={12} color={assigneeFilter !== 'all' ? colors.primary : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredRfis}
          renderItem={renderRFI}
          keyExtractor={item => String(item.id)}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Feather name="message-square" size={48} color={colors.border} />
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>No RFIs found</Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            height: '80%',
            padding: 20
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>RFI Details</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedRFI && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <View style={{
                      backgroundColor: statusConfig[selectedRFI.status]?.bg || 'rgba(0,0,0,0.1)',
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: statusConfig[selectedRFI.status]?.color }}>
                        {statusConfig[selectedRFI.status]?.label}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      Created on {new Date(selectedRFI.createdAt).toLocaleDateString()}
                    </Text>
                  </View>

                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12 }}>
                    {selectedRFI.title}
                  </Text>

                  <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22, marginBottom: 20 }}>
                    {selectedRFI.description}
                  </Text>

                  <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 16, gap: 12, marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: colors.textMuted }}>Created by</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{selectedRFI.creator?.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: colors.textMuted }}>Assigned to</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{selectedRFI.assignee?.name || 'Unassigned'}</Text>
                    </View>
                  </View>

                  {selectedRFI.photoDownloadUrls && selectedRFI.photoDownloadUrls.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Attachments</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                        {selectedRFI.photoDownloadUrls.map((url, idx) => (
                          <Image key={idx} source={{ uri: url }} style={{ width: 120, height: 120, borderRadius: 12 }} />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {user.role !== 'client' && (
                    <View style={{ gap: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Update Status</Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {['open', 'closed', 'overdue'].map((s) => (
                          <TouchableOpacity
                            key={s}
                            onPress={() => handleStatusUpdate(selectedRFI.id, s)}
                            style={{
                              flex: 1,
                              height: 40,
                              borderRadius: 10,
                              backgroundColor: selectedRFI.status === s ? statusConfig[s as keyof typeof statusConfig].color : colors.surface,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 1,
                              borderColor: colors.border
                            }}
                          >
                            <Text style={{
                              fontSize: 12, fontWeight: '700',
                              color: selectedRFI.status === s ? '#fff' : colors.text
                            }}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Create Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            height: '90%',
            padding: 20
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>New RFI</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} disabled={submitting}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 20 }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Title *</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Enter RFI title"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: 16,
                      color: colors.text,
                      fontSize: 14,
                      backgroundColor: colors.surface
                    }}
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Description</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Provide more details..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={4}
                    style={{
                      minHeight: 100,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 16,
                      color: colors.text,
                      fontSize: 14,
                      backgroundColor: colors.surface,
                      textAlignVertical: 'top'
                    }}
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Assign To</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {assignees.map((a) => (
                      <TouchableOpacity
                        key={a.id}
                        onPress={() => setAssignedToId(a.id === assignedToId ? null : a.id)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 20,
                          backgroundColor: assignedToId === a.id ? colors.primary : colors.surface,
                          borderWidth: 1,
                          borderColor: assignedToId === a.id ? colors.primary : colors.border
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: assignedToId === a.id ? '#fff' : colors.text }}>
                          {a.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 12 }}>Photos</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {selectedImages.map((uri: string, idx: number) => (
                      <View key={idx}>
                        <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 10 }} />
                        <TouchableOpacity
                          onPress={() => setSelectedImages(selectedImages.filter((_: string, i: number) => i !== idx))}
                          style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'red', borderRadius: 10, padding: 2 }}
                        >
                          <Feather name="x" size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity
                      onPress={pickImage}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderStyle: 'dashed',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.surface
                      }}
                    >
                      <Feather name="camera" size={24} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleCreateRFI}
                  disabled={submitting}
                  style={{
                    backgroundColor: colors.primary,
                    height: 52,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 20,
                    marginBottom: 40,
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Create RFI</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* Filter Options Modal */}
      <Modal visible={filterModalVisible} animationType="fade" transparent>
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 16, maxHeight: '60%' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 16, textAlign: 'center' }}>
              SELECT {activeFilterType?.toUpperCase()}
            </Text>
            <ScrollView>
              {activeFilterType === 'status' && ['all', 'open', 'overdue', 'closed'].map(item => (
                <TouchableOpacity
                  key={item}
                  onPress={() => { setStatusFilter(item as any); setFilterModalVisible(false); }}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ color: statusFilter === item ? colors.primary : colors.text, fontWeight: statusFilter === item ? '700' : '400' }}>
                    {item.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
              {activeFilterType === 'creator' && (
                <>
                  <TouchableOpacity
                    onPress={() => { setCreatorFilter('all'); setFilterModalVisible(false); }}
                    style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}
                  >
                    <Text style={{ color: creatorFilter === 'all' ? colors.primary : colors.text, fontWeight: creatorFilter === 'all' ? '700' : '400' }}>ALL CREATORS</Text>
                  </TouchableOpacity>
                  {Array.from(new Set(rfis.map(r => r.creator?.id))).filter(Boolean).map(id => {
                    const name = rfis.find(r => r.creator?.id === id)?.creator?.name;
                    return (
                      <TouchableOpacity
                        key={id}
                        onPress={() => { setCreatorFilter(String(id)); setFilterModalVisible(false); }}
                        style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}
                      >
                        <Text style={{ color: creatorFilter === String(id) ? colors.primary : colors.text, fontWeight: creatorFilter === String(id) ? '700' : '400' }}>{name?.toUpperCase()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
              {activeFilterType === 'assignee' && (
                <>
                  <TouchableOpacity
                    onPress={() => { setAssigneeFilter('all'); setFilterModalVisible(false); }}
                    style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}
                  >
                    <Text style={{ color: assigneeFilter === 'all' ? colors.primary : colors.text, fontWeight: assigneeFilter === 'all' ? '700' : '400' }}>ALL ASSIGNEES</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setAssigneeFilter('null'); setFilterModalVisible(false); }}
                    style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}
                  >
                    <Text style={{ color: assigneeFilter === 'null' ? colors.primary : colors.text, fontWeight: assigneeFilter === 'null' ? '700' : '400' }}>UNASSIGNED</Text>
                  </TouchableOpacity>
                  {Array.from(new Set(rfis.map(r => r.assignee?.id))).filter(Boolean).map(id => {
                    const name = rfis.find(r => r.assignee?.id === id)?.assignee?.name;
                    return (
                      <TouchableOpacity
                        key={id}
                        onPress={() => { setAssigneeFilter(String(id)); setFilterModalVisible(false); }}
                        style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}
                      >
                        <Text style={{ color: assigneeFilter === String(id) ? colors.primary : colors.text, fontWeight: assigneeFilter === String(id) ? '700' : '400' }}>{name?.toUpperCase()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
