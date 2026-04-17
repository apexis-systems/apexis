import React, { useState, useCallback, useEffect } from 'react';
import {
  View, TouchableOpacity, FlatList, BackHandler, ActivityIndicator,
  Modal, ScrollView, TextInput, Alert, Image, StyleSheet, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Project, User } from '@/types';
import {
  getRFIs, createRFI, updateRFIStatus, RFI, getRFIAssignees, updateRFIResponse
} from '@/services/rfiService';
import DateTimePicker from '@react-native-community/datetimepicker';
import ImageAnnotator from '@/components/common/ImageAnnotator';
import { Assignee } from '@/services/snagService';
import FullScreenImageModal from '@/components/shared/FullScreenImageModal';
import { parseApiError } from '@/helpers/apiError';

interface Props {
  project: Project;
  user: User;
  onUpdate?: () => void;
  initialRfiId?: string;
}

const statusConfig = {
  open: { icon: 'alert-circle', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Open' },
  closed: { icon: 'check-circle', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Closed' },
  overdue: { icon: 'alert-triangle', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Overdue' },
};

export default function ProjectRFI({ project, user, onUpdate, initialRfiId }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const MAX_RFI_IMAGES = 4;
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
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [responseBody, setResponseBody] = useState('');
  const [updatingResponse, setUpdatingResponse] = useState(false);
  const [annotatingImageIndex, setAnnotatingImageIndex] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [annotatingRemoteUri, setAnnotatingRemoteUri] = useState<string | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = React.useRef<CameraView>(null);

  // Filter Modals
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilterType, setActiveFilterType] = useState<'status' | 'creator' | 'assignee' | null>(null);

  // Assignee dropdown in create form
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (showDatePicker) {
        setShowDatePicker(false);
        if (selectedDate) {
          setExpiryDate(selectedDate);
          setShowTimePicker(true);
        }
      } else if (showTimePicker) {
        setShowTimePicker(false);
        if (selectedDate && expiryDate) {
          const finalDate = new Date(expiryDate);
          finalDate.setHours(selectedDate.getHours());
          finalDate.setMinutes(selectedDate.getMinutes());
          setExpiryDate(finalDate);
        }
      }
    } else {
      setShowDatePicker(false);
      if (selectedDate) setExpiryDate(selectedDate);
    }
  };

  useEffect(() => {
    if (initialRfiId && rfis.length > 0) {
      const target = rfis.find(r => String(r.id) === String(initialRfiId));
      if (target) {
        setSelectedRFI(target);
        setDetailModalVisible(true);
        // Clear param to prevent loop
        router.setParams({ rfiId: undefined });
      }
    }
  }, [initialRfiId, rfis, router]);

  useEffect(() => {
    if (!cameraVisible) {
      setCameraReady(false);
      return;
    }

    let active = true;

    const prepareCamera = async () => {
      if (!cameraPermission?.granted) {
        const res = await requestCameraPermission();
        if (!res.granted) return;
      }

      setCameraReady(false);
      setCameraSessionKey(prev => prev + 1);

      const timer = setTimeout(() => {
        if (active) setCameraReady(true);
      }, 250);

      return () => clearTimeout(timer);
    };

    let cleanup: void | (() => void);
    prepareCamera().then(result => {
      cleanup = result;
    });

    return () => {
      active = false;
      if (cleanup) cleanup();
    };
  }, [cameraVisible, cameraPermission?.granted, requestCameraPermission]);

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
        if (previewImage) {
          setPreviewImage(null);
          return true;
        }
        if (annotatingImageIndex !== null) {
          setAnnotatingImageIndex(null);
          return true;
        }
        if (cameraVisible) {
          setCameraVisible(false);
          return true;
        }
        if (detailModalVisible) {
          setDetailModalVisible(false);
          return true;
        }
        if (createModalVisible) {
          setCreateModalVisible(false);
          return true;
        }
        if (filterModalVisible) {
          setFilterModalVisible(false);
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
    }, [detailModalVisible, createModalVisible, filterModalVisible, statusFilter, fetchRFIs, fetchAssignees, previewImage, annotatingImageIndex, cameraVisible])
  );

  const handleImageSelection = async () => {
    if (selectedImages.length >= MAX_RFI_IMAGES) {
      Alert.alert('Limit Exceeded', `Maximum ${MAX_RFI_IMAGES} photos allowed`);
      return;
    }

    await openCamera();
  };

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert(
          'Permission Required',
          'Camera permission is needed to take RFI photos. Please enable it in your device settings.'
        );
        return;
      }
    }
    setCameraVisible(true);
  };

  const pickImageFiles = async () => {
    const remaining = MAX_RFI_IMAGES - selectedImages.length;
    if (remaining <= 0) {
      Alert.alert('Limit Exceeded', `Maximum ${MAX_RFI_IMAGES} photos allowed`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.9,
      } as any);

      if (result.canceled || !result.assets?.length) return;

      const nextUris: string[] = [];

      for (const asset of result.assets.slice(0, remaining)) {
        let uri = asset.uri;
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1920 } }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
          );
          uri = manipulated.uri;
        } catch (e) {
          console.warn('RFI gallery image manipulation failed:', e);
        }
        nextUris.push(uri);
      }

      setSelectedImages(prev => [...prev, ...nextUris].slice(0, MAX_RFI_IMAGES));
    } catch (error) {
      console.error('pickImageFiles error', error);
      Alert.alert('Error', 'Failed to pick image from gallery.');
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;
    if (selectedImages.length >= MAX_RFI_IMAGES) {
      Alert.alert('Limit Exceeded', `Maximum ${MAX_RFI_IMAGES} photos allowed`);
      return;
    }
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        exif: true,
      });

      if (!photo?.uri) return;

      // Fix orientation and format for iOS compatibility
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1920 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      const newIdx = selectedImages.length;
      setSelectedImages(prev => [...prev, manipulated.uri]);
      setCameraVisible(false);
      setAnnotatingImageIndex(newIdx);
    } catch (e: any) {
      console.error('capturePhoto error', e);
      Alert.alert('Camera Error', e?.message || 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCreateRFI = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    if (!assignedToId) {
      Alert.alert('Error', 'Assignee is required');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('project_id', String(projectId));
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('assigned_to', String(assignedToId));
      if (expiryDate) formData.append('expiry_date', expiryDate.toISOString());

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
      setExpiryDate(null);
      fetchRFIs();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('handleCreateRFI error', err);
      const { message, code } = parseApiError(err, 'Failed to create RFI');
      Alert.alert(code === 'LIMIT_REACHED' ? 'Limit Reached' : 'Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateResponse = async () => {
    if (!selectedRFI) return;
    if (!responseBody.trim()) {
      Alert.alert('Error', 'Response cannot be empty');
      return;
    }
    setUpdatingResponse(true);
    try {
      const updated = await updateRFIResponse(selectedRFI.id, { response: responseBody.trim() });
      Alert.alert('Success', 'Response submitted');
      setSelectedRFI(updated);
      fetchRFIs();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('handleUpdateResponse error', err);
      Alert.alert('Error', 'Failed to submit response');
    } finally {
      setUpdatingResponse(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await updateRFIStatus(id, status);
      fetchRFIs();
      if (onUpdate) onUpdate();
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

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="calendar" size={10} color={colors.textMuted} />
                <Text style={{ fontSize: 10, color: colors.textMuted }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              {item.expiry_date && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="clock" size={10} color={item.status === 'overdue' ? '#ef4444' : colors.textMuted} />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: item.status === 'overdue' ? '#ef4444' : colors.textMuted }}>
                    {new Date(item.expiry_date).toLocaleDateString()}
                  </Text>
                </View>
              )}
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
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
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

                  {(selectedRFI?.photoDownloadUrls?.length ?? 0) > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Attachments</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                        {(selectedRFI?.photoDownloadUrls || []).map((url, idx) => (
                          <View key={idx} style={{ position: 'relative' }}>
                            <TouchableOpacity onPress={() => setPreviewImage(url)}>
                              <Image source={{ uri: url }} style={{ width: 120, height: 120, borderRadius: 12 }} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setAnnotatingRemoteUri(url)}
                              style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 10 }}
                            >
                              <Feather name="edit-2" size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {selectedRFI.expiry_date && (
                    <View style={{ marginBottom: 20, padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: selectedRFI.status === 'overdue' ? '#ef4444' : colors.primary }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Expiry Date</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: selectedRFI.status === 'overdue' ? '#ef4444' : colors.text }}>
                        {new Date(selectedRFI.expiry_date).toLocaleString()}
                      </Text>
                    </View>
                  )}

                  {selectedRFI.response && (
                    <View style={{ marginBottom: 20, padding: 16, backgroundColor: colors.primary + '08', borderRadius: 16, borderWidth: 1, borderColor: colors.primary + '20' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, marginBottom: 8, textTransform: 'uppercase' }}>Response</Text>
                      <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22 }}>{selectedRFI.response}</Text>
                    </View>
                  )}

                  {String(selectedRFI.assigned_to) === String(user.id) && selectedRFI.status !== 'closed' && (
                    <View style={{ marginBottom: 20, gap: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{selectedRFI.response ? 'Update Response' : 'Provide Response'}</Text>
                      <TextInput
                        value={responseBody}
                        onChangeText={setResponseBody}
                        placeholder="Type your response..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        style={{
                          minHeight: 80,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          padding: 12,
                          color: colors.text,
                          backgroundColor: colors.surface,
                          textAlignVertical: 'top'
                        }}
                      />
                      <TouchableOpacity
                        onPress={handleUpdateResponse}
                        disabled={updatingResponse || !responseBody.trim()}
                        style={{
                          backgroundColor: colors.primary,
                          height: 48,
                          borderRadius: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: (updatingResponse || !responseBody.trim()) ? 0.6 : 1
                        }}
                      >
                        {updatingResponse ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Submit Response</Text>}
                      </TouchableOpacity>
                    </View>
                  )}

                  {String(selectedRFI.assigned_to) === String(user.id) && (
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
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
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
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Assign To *</Text>
                  <TouchableOpacity
                    onPress={() => setShowAssigneeDropdown(true)}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: assignedToId ? colors.primary : colors.border,
                      paddingHorizontal: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: assignedToId ? colors.text : colors.textMuted }}>
                      {assignedToId
                        ? assignees.find(a => a.id === assignedToId)?.name || 'Select assignee'
                        : 'Select assignee *'}
                    </Text>
                    <Feather name="chevron-down" size={18} color={assignedToId ? colors.primary : colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>Expiry Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.surface
                    }}
                  >
                    <Text style={{ color: expiryDate ? colors.text : colors.textMuted }}>
                      {expiryDate ? expiryDate.toLocaleString() : 'Select Date & Time'}
                    </Text>
                    <Feather name="calendar" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={expiryDate || new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleDateChange}
                    />
                  )}
                  {showTimePicker && Platform.OS === 'android' && (
                    <DateTimePicker
                      value={expiryDate || new Date()}
                      mode="time"
                      display="default"
                      onChange={handleDateChange}
                    />
                  )}
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 12 }}>Photos</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {selectedImages.map((uri: string, idx: number) => (
                      <View key={idx}>
                        <TouchableOpacity onPress={() => setAnnotatingImageIndex(idx)}>
                          <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 10 }} />
                          <View style={{ position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 4 }}>
                            <Feather name="edit-2" size={10} color="#fff" />
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setSelectedImages(selectedImages.filter((_: string, i: number) => i !== idx))}
                          style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'red', borderRadius: 10, padding: 2 }}
                        >
                          <Feather name="x" size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity
                      onPress={handleImageSelection}
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
                      <Feather name="plus" size={24} color={colors.textMuted} />
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

            {/* Assignee Picker Modal (nested for iOS compatibility) */}
            <Modal visible={showAssigneeDropdown} animationType="fade" transparent onRequestClose={() => setShowAssigneeDropdown(false)}>
              <TouchableOpacity
                activeOpacity={1}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 }}
                onPress={() => setShowAssigneeDropdown(false)}
              >
                <TouchableOpacity activeOpacity={1} onPress={() => { }}>
                  <View style={{
                    backgroundColor: colors.background,
                    borderRadius: 16,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}>
                    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>Assign To *</Text>
                    </View>
                    <ScrollView style={{ maxHeight: 320 }}>
                      {assignees.map((a) => (
                        <TouchableOpacity
                          key={a.id}
                          onPress={() => { setAssignedToId(a.id); setShowAssigneeDropdown(false); }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                            backgroundColor: assignedToId === a.id ? colors.primary + '10' : 'transparent',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{
                              width: 30,
                              height: 30,
                              borderRadius: 15,
                              backgroundColor: colors.primary + '20',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                                {a.name?.charAt(0)?.toUpperCase() || '?'}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 14, color: assignedToId === a.id ? colors.primary : colors.text, fontWeight: assignedToId === a.id ? '700' : '400' }}>
                              {a.name}
                            </Text>
                          </View>
                          {assignedToId === a.id && <Feather name="check" size={16} color={colors.primary} />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>

            {/* High-Fidelity Camera Modal (nested for iOS compatibility) */}
            <Modal
              visible={cameraVisible}
              animationType="slide"
              transparent={false}
              presentationStyle="fullScreen"
              statusBarTranslucent={true}
              onRequestClose={() => setCameraVisible(false)}
            >
              <View style={{ flex: 1, backgroundColor: '#000' }}>
                <View style={{ flex: 1 }}>
                  {cameraPermission?.granted && cameraReady ? (
                    <>
                      <CameraView key={cameraSessionKey} style={StyleSheet.absoluteFill} facing="back" ref={cameraRef} />

                      {/* Header Overlay */}
                      <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                        <TouchableOpacity onPress={() => setCameraVisible(false)} style={cameraStyles.headerBtn}>
                          <Feather name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={cameraStyles.headerTitle}>RFI Photos</Text>
                        <View style={{ width: 60 }} />
                      </View>

                      {/* Bottom Controls Overlay */}
                      <View style={[cameraStyles.controlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
                        {/* Preview row */}
                        {selectedImages.length > 0 && (
                          <View style={cameraStyles.previewContainer}>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingTop: 10, paddingRight: 30 }}
                            >
                              {selectedImages.map((uri, idx) => (
                                <View key={idx} style={cameraStyles.previewWrapper}>
                                  <Image source={{ uri }} style={cameraStyles.previewThumb} />
                                  <TouchableOpacity
                                    onPress={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                                    style={cameraStyles.removeBtn}
                                  >
                                    <Feather name="x" size={12} color="#fff" />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </ScrollView>
                          </View>
                        )}

                        <View style={cameraStyles.shutterRow}>
                          <TouchableOpacity onPress={pickImageFiles} style={cameraStyles.sideBtn}>
                            <View style={cameraStyles.iconCircle}>
                              <Feather name="image" size={24} color="#fff" />
                            </View>
                            <Text style={cameraStyles.btnLabel}>Gallery</Text>
                          </TouchableOpacity>

                          <TouchableOpacity onPress={capturePhoto} disabled={isCapturing} style={cameraStyles.shutterBtn}>
                            <View style={cameraStyles.shutterOuter}>
                              <View style={cameraStyles.shutterInner} />
                            </View>
                            <Text style={cameraStyles.btnLabel}>Photo</Text>
                          </TouchableOpacity>

                          <View style={{ width: 70 }} />
                        </View>
                      </View>

                      {/* Floating Done Button */}
                      {selectedImages.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setCameraVisible(false)}
                          style={{
                            position: 'absolute',
                            bottom: insets.bottom + 180,
                            right: 20,
                            backgroundColor: colors.primary,
                            paddingHorizontal: 24,
                            paddingVertical: 14,
                            borderRadius: 30,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            elevation: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 5,
                            zIndex: 20
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Done ({selectedImages.length})</Text>
                          <Feather name="arrow-right" size={20} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                      {cameraPermission?.granted ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={{ color: '#fff', marginBottom: 20 }}>Camera permission required</Text>
                          <TouchableOpacity onPress={requestCameraPermission} style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 10 }}>
                            <Text style={{ color: '#fff', fontWeight: '700' }}>Grant Permission</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </Modal>
          </View>
        </View>
      </Modal>

      {/* Filter Options Modal mark */}
      <Modal visible={filterModalVisible} animationType="fade" transparent onRequestClose={() => setFilterModalVisible(false)}>
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
      {/* Photo Preview Modal */}
      <FullScreenImageModal
        visible={!!previewImage}
        onClose={() => setPreviewImage(null)}
        uri={previewImage}
        onEdit={(u) => { if (u) setAnnotatingRemoteUri(u); }}
      />

      {/* Image Annotator */}
      {annotatingImageIndex !== null && (
        <ImageAnnotator
          uri={selectedImages[annotatingImageIndex]}
          onSave={(newUri) => {
            const newImages = [...selectedImages];
            newImages[annotatingImageIndex] = newUri;
            setSelectedImages(newImages);
            setAnnotatingImageIndex(null);
          }}
          onCancel={() => setAnnotatingImageIndex(null)}
        />
      )}

      {/* Annotator for remote/existing RFI images */}
      {annotatingRemoteUri && (
        <ImageAnnotator
          uri={annotatingRemoteUri}
          onSave={(newUri) => {
            if (selectedRFI) {
              const newUrls = (selectedRFI.photoDownloadUrls || []).map(u => (u === annotatingRemoteUri ? newUri : u));
              setSelectedRFI({ ...selectedRFI, photoDownloadUrls: newUrls });
              setRfis(prev => prev.map(r => r.id === selectedRFI.id ? { ...r, photoDownloadUrls: newUrls } : r));
              if (previewImage === annotatingRemoteUri) setPreviewImage(newUri);
            }
            setAnnotatingRemoteUri(null);
          }}
          onCancel={() => setAnnotatingRemoteUri(null)}
        />
      )}

    </View>
  );
}

const cameraStyles = StyleSheet.create({
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerBtn: {
    padding: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 10,
    paddingTop: 10
  },
  previewContainer: {
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  previewWrapper: {
    position: 'relative',
    marginRight: 5,
  },
  previewThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000',
    zIndex: 20,
  },
  shutterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  sideBtn: {
    alignItems: 'center',
    width: 70,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtn: {
    alignItems: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#ea8c0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
  },
  btnLabel: {
    color: '#ccc',
    fontSize: 10,
    marginTop: 5,
  },
});
