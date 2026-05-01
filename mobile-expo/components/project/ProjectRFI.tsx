import React, { useState, useCallback, useEffect } from 'react';
import {
  View, TouchableOpacity, FlatList, BackHandler, ActivityIndicator,
  Modal, ScrollView, TextInput, Alert, StyleSheet, Platform, RefreshControl, Dimensions,
  KeyboardAvoidingView
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import { Project, User } from '@/types';
import {
  getRFIs, createRFI, updateRFIStatus, RFI, getRFIAssignees, updateRFIResponse, deleteRFI, updateRFI,
  getRFIById
} from '@/services/rfiService';
import DateTimePicker from '@react-native-community/datetimepicker';
import ImageAnnotator from '@/components/common/ImageAnnotator';
import { Assignee } from '@/services/snagService';
import FullScreenImageModal from '@/components/shared/FullScreenImageModal';
import { parseApiError } from '@/helpers/apiError';
import MobileFolderPickerDialog from './MobileFolderPickerDialog';

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

const { width: SCREEN_W } = Dimensions.get('window');
const CAMERA_HEIGHT = (SCREEN_W / 3) * 4;

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
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [responseBody, setResponseBody] = useState('');
  const [updatingResponse, setUpdatingResponse] = useState(false);
  const [isLoadingRFIs, setIsLoadingRFIs] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<(string | number)[]>([]);

  // Physical Orientation Tracking
  const [physicalOrientation, setPhysicalOrientation] = useState<number>(0);

  useEffect(() => {
    let subscription: any;
    const _subscribe = () => {
      subscription = Accelerometer.addListener(accelerometerData => {
        const { x, y } = accelerometerData;
        if (Math.abs(x) > Math.abs(y)) {
          if (x > 0.5) setPhysicalOrientation(90); // Landscape Left
          else if (x < -0.5) setPhysicalOrientation(270); // Landscape Right
        } else {
          if (y > 0.5) setPhysicalOrientation(180); // Upside Down
          else if (y < -0.5) setPhysicalOrientation(0); // Portrait
        }
      });
      Accelerometer.setUpdateInterval(500);
    };

    _subscribe();
    return () => subscription && subscription.remove();
  }, []);
  const [isEditing, setIsEditing] = useState(false);
  const [responseImages, setResponseImages] = useState<string[]>([]);
  const [annotatingImageIndex, setAnnotatingImageIndex] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [annotatingRemoteUri, setAnnotatingRemoteUri] = useState<string | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraMode, setCameraMode] = useState<'create' | 'response'>('create');
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
    if (initialRfiId && !detailModalVisible) {
      const openRFI = (target: RFI) => {
        if (detailModalVisible) return;
        setResponseBody('');
        setResponseImages([]);
        setSelectedRFI(target);
        setDetailModalVisible(true);
        router.setParams({ rfiId: undefined });
      };

      // If already in list, open it
      const existing = rfis.find(r => String(r.id) === String(initialRfiId));
      if (existing) {
        openRFI(existing);
      } else {
        // Fetch it specifically for faster redirection
        getRFIById(Number(initialRfiId)).then(openRFI).catch(err => {
          console.error("Failed to fetch initial RFI", err);
          router.setParams({ rfiId: undefined });
        });
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

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchRFIs(), fetchAssignees()]);
    setRefreshing(false);
  };

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

  const pickResponsePhotos = () => {
    setCameraMode('response');
    setCameraVisible(true);
  };

  const handleImageSelection = async () => {
    if (selectedImages.length >= MAX_RFI_IMAGES) {
      Alert.alert('Limit Exceeded', `Maximum ${MAX_RFI_IMAGES} photos allowed`);
      return;
    }

    await openCamera('create');
  };

  const openCamera = async (mode: 'create' | 'response' = 'create') => {
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
    setCameraMode(mode);
    setCameraVisible(true);
  };

  const pickImageFiles = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
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

      if (cameraMode === 'create') {
        setSelectedImages(prev => [...prev, uri]);
        setAnnotatingImageIndex(selectedImages.length);
      } else {
        setResponseImages(prev => [...prev, uri]);
        setAnnotatingImageIndex(responseImages.length);
      }
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

      const { width, height } = photo;
      const manipActions: any[] = [];
      
      // Orientation Correction
      const isLandscapePhysically = physicalOrientation === 90 || physicalOrientation === 270;
      const isPhotoPortrait = height > width;

      if (isLandscapePhysically && isPhotoPortrait) {
        manipActions.push({ rotate: physicalOrientation });
      } else {
        manipActions.push({ rotate: 0 });
      }

      // Resize
      const finalWidth = (isLandscapePhysically && isPhotoPortrait) ? height : width;
      const finalHeight = (isLandscapePhysically && isPhotoPortrait) ? width : height;
      const resizeOptions = finalWidth > finalHeight ? { width: 1920 } : { height: 1920 };
      manipActions.push({ resize: resizeOptions });

      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        manipActions,
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (cameraMode === 'create') {
        // Append photo for create
        setSelectedImages(prev => [...prev, manipulated.uri]);
        setAnnotatingImageIndex(selectedImages.length);
      } else {
        // Append photo for response
        setResponseImages(prev => [...prev, manipulated.uri]);
        setAnnotatingImageIndex(responseImages.length);
      }
    } catch (e: any) {
      console.error('capturePhoto error', e);
      Alert.alert('Camera Error', e?.message || 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssignedToId(null);
    setExpiryDate(null);
    setSelectedImages([]);
    setRemovedPhotos([]);
    setSelectedFolderIds([]);
    setIsEditing(false);
    setSelectedRFI(null);
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
      if (selectedFolderIds.length > 0) formData.append('folder_ids', selectedFolderIds.join(','));

      selectedImages.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `photo_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        formData.append('photos', { uri, name: filename, type } as any);
      });

      await createRFI(formData);
      Alert.alert('Success', 'RFI created successfully');
      setCreateModalVisible(false);
      resetForm();
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

  const handleUpdateRFI = async () => {
    if (!selectedRFI) return;
    if (!title.trim()) { Alert.alert('Error', 'Title is required'); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('assigned_to', String(assignedToId));
      if (expiryDate) formData.append('expiry_date', expiryDate.toISOString());
      formData.append('folder_ids', selectedFolderIds.join(','));


      if (removedPhotos.length > 0) {
        removedPhotos.forEach(key => {
          
          formData.append('removedPhotos', key);
        });
      }

      selectedImages.forEach((uri, index) => {
        if (uri.startsWith('http')) return; // skip existing
        const filename = uri.split('/').pop() || `photo_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        formData.append('photos', { uri, name: filename, type } as any);
      });

      const updated = await updateRFI(selectedRFI.id, formData);
      Alert.alert('Success', 'RFI updated');
      setCreateModalVisible(false);
      resetForm();
      setSelectedRFI(updated);
      fetchRFIs();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('handleUpdateRFI error', err);
      Alert.alert('Error', 'Failed to update RFI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRFI = async (id: number) => {
    Alert.alert(
      'Delete RFI',
      'Are you sure you want to delete this RFI?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRFI(id);
              Alert.alert('Success', 'RFI deleted successfully');
              setDetailModalVisible(false);
              fetchRFIs();
              if (onUpdate) onUpdate();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete RFI');
            }
          }
        }
      ]
    );
  };

  const handleUpdateResponse = async () => {
    if (!selectedRFI) return;
    if (!responseBody.trim() && responseImages.length === 0) {
      Alert.alert('Error', 'Response cannot be empty');
      return;
    }
    setUpdatingResponse(true);
    try {
      const formData = new FormData();
      formData.append('response', responseBody.trim());
      responseImages.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `resp_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        formData.append('photos', { uri, name: filename, type } as any);
      });


      const updated = await updateRFIResponse(selectedRFI.id, formData);
      Alert.alert('Success', 'Response updated successfully');
      setSelectedRFI(updated);
      setResponseBody('');
      setResponseImages([]);
      fetchRFIs();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('handleUpdateResponse error', err);
      Alert.alert('Error', 'Failed to submit response');
    } finally {
      setUpdatingResponse(false);
    }
  };

  const pickResponseImages = async () => {
    await openCamera('response');
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await updateRFIStatus(id, status);
      Alert.alert('Success', `Status updated to ${status}`);
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

  const handleUpdateLinks = async (ids: (string | number)[]) => {
    if (!selectedRFI) return;
    try {
      setSubmitting(true);
      const numericIds = ids.map(Number);
      const formData = new FormData();
      formData.append('folder_ids', numericIds.join(','));
      const updatedRFI = await updateRFI(selectedRFI.id, formData);
      setRfis(prev => prev.map(r => r.id === selectedRFI.id ? { ...r, folder_ids: numericIds, linked_folders: updatedRFI.linked_folders } : r));
      setSelectedRFI(prev => prev ? { ...prev, folder_ids: numericIds, linked_folders: updatedRFI.linked_folders } : null);
      Alert.alert("Success", "Links updated successfully");
    } catch (err) {
      console.error("Update Links Error:", err);
      const { message } = parseApiError(err, 'Failed to update links');
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderRFI = ({ item }: { item: RFI }) => {
    const config = statusConfig[item.status] || statusConfig.open;
    return (
      <TouchableOpacity
        onPress={() => {
          setResponseBody('');
          setResponseImages([]);
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
        onPress={() => { resetForm(); setCreateModalVisible(true); }}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
        onRequestClose={() => { setDetailModalVisible(false); setResponseBody(''); setResponseImages([]); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
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
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>RFI Details</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                  {selectedRFI && (String(selectedRFI.created_by) === String(user.id) || String(selectedRFI.creator?.id) === String(user.id)) && (
                    <TouchableOpacity onPress={() => {
                      setSelectedFolderIds(selectedRFI.folder_ids || []);
                      setShowFolderPicker(true);
                    }}>
                      <Feather name="link-2" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  {selectedRFI && (String(selectedRFI.created_by) === String(user.id) || String(selectedRFI.creator?.id) === String(user.id)) && !selectedRFI.response && !selectedRFI?.response_photos && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity onPress={() => {
                        setTitle(selectedRFI.title);
                        setDescription(selectedRFI.description || '');
                        setAssignedToId(selectedRFI.assigned_to);
                        setExpiryDate(selectedRFI.expiry_date ? new Date(selectedRFI.expiry_date) : null);
                        setSelectedFolderIds(selectedRFI.folder_ids || []);
                        setSelectedImages(selectedRFI.photoDownloadUrls || []);
                        setIsEditing(true);
                        setCreateModalVisible(true);
                      }}>
                        <Feather name="edit" size={20} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteRFI(selectedRFI.id)}>
                        <Feather name="trash-2" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => { setDetailModalVisible(false); setResponseBody(''); setResponseImages([]); }}>
                    <Feather name="x" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
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

                    {(selectedRFI?.photoDownloadUrls?.length || 0) > 0 && (
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Attachments</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                          {(selectedRFI?.photoDownloadUrls || []).map((url, idx) => (
                            <View key={idx} style={{ position: 'relative' }}>
                              <TouchableOpacity onPress={() => setPreviewImage(url)}>
                                <Image
                                  source={url}
                                  style={{ width: 120, height: 120, borderRadius: 12 }}
                                  contentFit="cover"
                                  transition={200}
                                />
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

                    {selectedRFI.linked_folders && selectedRFI.linked_folders.length > 0 && (
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>Linked Folders</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {selectedRFI.linked_folders.map((f: any) => (
                            <TouchableOpacity 
                              key={f.id}
                              onPress={() => {
                                // 1. Close the modal first
                                setDetailModalVisible(false);
                                
                                // 2. Clear any other active overlays just in case
                                setShowFolderPicker(false);
                                setSelectedRFI(null);

                                // 3. Small delay to allow modal backdrop to clear before navigation
                                setTimeout(() => {
                                  router.setParams({ 
                                    tab: f.folder_type === 'photo' ? 'photos' : 'documents', 
                                    folderId: String(f.id),
                                    rfiId: undefined // Explicitly clear any RFI trigger
                                  });
                                }, 100);
                              }}
                              style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                gap: 6, 
                                paddingHorizontal: 10, 
                                paddingVertical: 6, 
                                backgroundColor: colors.primary + '10', 
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: colors.primary + '20'
                              }}
                            >
                              <Feather name="folder" size={12} color={colors.primary} />
                              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>{f.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {(selectedRFI.response || (selectedRFI.responsePhotoUrls && selectedRFI.responsePhotoUrls.length > 0)) && (
                      <View style={{ marginBottom: 20, padding: 16, backgroundColor: colors.primary + '08', borderRadius: 16, borderWidth: 1, borderColor: colors.primary + '20' }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, marginBottom: 8, textTransform: 'uppercase' }}>Response</Text>
                        {selectedRFI.response ? <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22, marginBottom: 12 }}>{selectedRFI.response}</Text> : null}
                        {/* Existing Response Photos */}
                        {selectedRFI.responsePhotoUrls && selectedRFI.responsePhotoUrls.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                            {selectedRFI.responsePhotoUrls.map((uri, idx) => (
                              <View key={idx} style={{ position: 'relative' }}>
                                <TouchableOpacity onPress={() => setPreviewImage(uri)}>
                                  <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: 12, borderWidth: 1, borderColor: colors.border }} />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {String(selectedRFI.assigned_to) === String(user.id) && (
                      <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15, marginTop: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{selectedRFI.response ? 'Update Response' : 'Provide Response'}</Text>

                        {selectedRFI.status !== 'closed' ? (
                          <>
                            <TextInput
                              value={responseBody}
                              onChangeText={setResponseBody}
                              placeholder="Type your response here..."
                              placeholderTextColor={colors.textMuted}
                              multiline
                              style={{
                                minHeight: 100,
                                backgroundColor: colors.surface,
                                borderRadius: 12,
                                padding: 12,
                                color: colors.text,
                                borderWidth: 1,
                                borderColor: colors.border,
                                textAlignVertical: 'top'
                              }}
                            />
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                              {responseImages.map((uri, idx) => (
                                <View key={idx} style={{ position: 'relative' }}>
                                  <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: colors.border }} />
                                  <TouchableOpacity
                                    onPress={() => setResponseImages(prev => prev.filter((_, i) => i !== idx))}
                                    style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', borderRadius: 10, padding: 3 }}
                                  >
                                    <Feather name="x" size={14} color="#fff" />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => { setCameraMode('response'); setAnnotatingImageIndex(idx); }}
                                    style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 8 }}
                                  >
                                    <Feather name="edit-2" size={12} color="#fff" />
                                  </TouchableOpacity>
                                </View>
                              ))}
                              <TouchableOpacity
                                onPress={pickResponsePhotos}
                                style={{
                                  width: 80, height: 80, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border,
                                  alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface
                                }}
                              >
                                <Feather name="camera" size={24} color={colors.textMuted} />
                              </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                              onPress={handleUpdateResponse}
                              disabled={updatingResponse || (!responseBody.trim() && responseImages.length === 0)}
                              style={{
                                backgroundColor: colors.primary,
                                height: 48,
                                borderRadius: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: (updatingResponse || (!responseBody.trim() && responseImages.length === 0)) ? 0.6 : 1
                              }}
                            >
                              {updatingResponse ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Submit Response</Text>}
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View style={{ padding: 12, backgroundColor: colors.surface, borderRadius: 12, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, color: colors.textMuted }}>Closed RFIs cannot be updated</Text>
                          </View>
                        )}
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
        </KeyboardAvoidingView>

        {/* ── Secondary Modals (Russian Doll nesting for iOS compatibility) ── */}
        {createModalVisible ? (
          /* When editing, the sub-modals MUST be inside the Create Modal */
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
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{isEditing ? 'Edit RFI' : 'New RFI'}</Text>
                  <TouchableOpacity onPress={() => { setCreateModalVisible(false); setIsEditing(false); }} disabled={submitting}>
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

                    {/* Link Folders */}
                    {/* <View style={{ marginBottom: 20 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Link to Folders</Text>
                      <TouchableOpacity
                        onPress={() => setShowFolderPicker(true)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface
                        }}
                      >
                        <Feather name="folder" size={18} color={colors.primary} />
                        <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>
                          {selectedFolderIds.length > 0 ? `${selectedFolderIds.length} folders selected` : 'Select Folders'}
                        </Text>
                        <Feather name="chevron-right" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View> */}

                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 12 }}>Photos</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {selectedImages.map((uri: string, idx: number) => (
                          <View key={idx} style={{ position: 'relative' }}>
                            <Image
                              source={{ uri }}
                              style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                            />
                            <TouchableOpacity
                              onPress={() => {
                                console.log('X clicked (NESTED) for URI:', uri);
                                // If this was an original photo, we need to track its key for deletion
                                if (isEditing && selectedRFI && uri.startsWith('http')) {
                                  // Strip query params for more robust matching
                                  const baseUri = uri.split('?')[0];
                                  const originalIdx = selectedRFI.photoDownloadUrls?.findIndex(url => {
                                    const baseUrl = url.split('?')[0];
                                    return baseUrl === baseUri;
                                  });
                                  
                                  console.log('Matching (NESTED) against original photos. Base URI:', baseUri);
                                  console.log('Match found at index:', originalIdx);

                                  if (originalIdx !== undefined && originalIdx !== -1) {
                                    const keyToRemove = selectedRFI.photos[originalIdx];
                                    console.log('Key to remove found:', keyToRemove);
                                    if (keyToRemove) {
                                      setRemovedPhotos(prev => {
                                        const next = [...prev, keyToRemove];
                                        console.log('Updated removedPhotos state (NESTED):', next);
                                        return next;
                                      });
                                    }
                                  }
                                }
                                setSelectedImages(selectedImages.filter((_, i) => i !== idx));
                              }}
                              style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', borderRadius: 10, padding: 3 }}
                            >
                              <Feather name="x" size={14} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setAnnotatingImageIndex(idx)}
                              style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 8 }}
                            >
                              <Feather name="edit-2" size={12} color="#fff" />
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
                          <Feather name="camera" size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={isEditing ? handleUpdateRFI : handleCreateRFI}
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
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{isEditing ? 'Save Changes' : 'Create RFI'}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>

              {/* Camera Stack nested inside Create Modal for iOS compatibility while editing */}
              {cameraVisible && (
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
                          <View style={{
                            width: SCREEN_W,
                            height: CAMERA_HEIGHT,
                            overflow: 'hidden',
                            marginTop: Math.max(insets.top, 20) + 60,
                          }}>
                            <CameraView
                              key={cameraSessionKey}
                              style={StyleSheet.absoluteFill}
                              facing="back"
                              ref={cameraRef}
                              ratio="4:3"
                            />
                          </View>

                          <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                            <TouchableOpacity onPress={() => setCameraVisible(false)} style={cameraStyles.headerBtn}>
                              <Feather name="x" size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={cameraStyles.headerTitle}>RFI Photos</Text>
                            <View style={{ width: 60 }} />
                          </View>

                          <View style={[cameraStyles.controlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
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

                    {/* Annotator nested inside Camera for immediate editing on iOS */}
                    {annotatingImageIndex !== null && (
                      <ImageAnnotator
                        uri={cameraMode === 'create' ? selectedImages[annotatingImageIndex] : responseImages[annotatingImageIndex]}
                        onSave={(newUri) => {
                          if (cameraMode === 'create') {
                            const newImages = [...selectedImages];
                            newImages[annotatingImageIndex] = newUri;
                            setSelectedImages(newImages);
                          } else {
                            const newImages = [...responseImages];
                            newImages[annotatingImageIndex] = newUri;
                            setResponseImages(newImages);
                          }
                          setAnnotatingImageIndex(null);
                          setCameraVisible(false);
                        }}
                        onCancel={() => setAnnotatingImageIndex(null)}
                      />
                    )}
                  </View>
                </Modal>
              )}

              {/* Annotator for gallery picks while inside Create Modal */}
              {!cameraVisible && annotatingImageIndex !== null && (
                <ImageAnnotator
                  uri={cameraMode === 'create' ? selectedImages[annotatingImageIndex] : responseImages[annotatingImageIndex]}
                  onSave={(newUri) => {
                    if (cameraMode === 'create') {
                      const newImages = [...selectedImages];
                      newImages[annotatingImageIndex] = newUri;
                      setSelectedImages(newImages);
                    } else {
                      const newImages = [...responseImages];
                      newImages[annotatingImageIndex] = newUri;
                      setResponseImages(newImages);
                    }
                    setAnnotatingImageIndex(null);
                  }}
                  onCancel={() => setAnnotatingImageIndex(null)}
                />
              )}

              {/* Assignee Picker Modal nested for iOS support while editing */}
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
            </View>
          </Modal>
        ) : (
          /* When NOT editing, sub-modals (for response or existing) are nested in Detail Modal */
          <>
            {cameraVisible && (
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
                        <View style={{
                          width: SCREEN_W,
                          height: CAMERA_HEIGHT,
                          overflow: 'hidden',
                          marginTop: Math.max(insets.top, 20) + 60,
                        }}>
                          <CameraView
                            key={cameraSessionKey}
                            style={StyleSheet.absoluteFill}
                            facing="back"
                            ref={cameraRef}
                            ratio="4:3"
                          />
                        </View>

                        <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                          <TouchableOpacity onPress={() => setCameraVisible(false)} style={cameraStyles.headerBtn}>
                            <Feather name="x" size={24} color="#fff" />
                          </TouchableOpacity>
                          <Text style={cameraStyles.headerTitle}>RFI Photos</Text>
                          <View style={{ width: 60 }} />
                        </View>

                        <View style={[cameraStyles.controlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
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

                  {/* Nested Annotator for immediate capture in camera on iOS */}
                  {annotatingImageIndex !== null && (
                    <ImageAnnotator
                      uri={cameraMode === 'create' ? selectedImages[annotatingImageIndex] : responseImages[annotatingImageIndex]}
                      onSave={(newUri) => {
                        if (cameraMode === 'create') {
                          const newImages = [...selectedImages];
                          newImages[annotatingImageIndex] = newUri;
                          setSelectedImages(newImages);
                        } else {
                          const newImages = [...responseImages];
                          newImages[annotatingImageIndex] = newUri;
                          setResponseImages(newImages);
                        }
                        setAnnotatingImageIndex(null);
                        setCameraVisible(false);
                      }}
                      onCancel={() => setAnnotatingImageIndex(null)}
                    />
                  )}
                </View>
              </Modal>
            )}

            {/* Image Annotators for when camera is closed (response mode) */}
            {!cameraVisible && annotatingImageIndex !== null && (
              <ImageAnnotator
                uri={cameraMode === 'create' ? selectedImages[annotatingImageIndex] : responseImages[annotatingImageIndex]}
                onSave={(newUri) => {
                  if (cameraMode === 'create') {
                    const newImages = [...selectedImages];
                    newImages[annotatingImageIndex] = newUri;
                    setSelectedImages(newImages);
                  } else {
                    const newImages = [...responseImages];
                    newImages[annotatingImageIndex] = newUri;
                    setResponseImages(newImages);
                  }
                  setAnnotatingImageIndex(null);
                }}
                onCancel={() => setAnnotatingImageIndex(null)}
              />
            )}
          </>
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

        {/* Nested Photo Viewer for iOS support inside detail modal */}
        <FullScreenImageModal
          visible={!!previewImage}
          onClose={() => setPreviewImage(null)}
          uri={previewImage}
          onEdit={(u) => { if (u) setAnnotatingRemoteUri(u); }}
        />

        {/* Folder Picker nested for iOS support while inside Detail Modal */}
        <MobileFolderPickerDialog
          visible={showFolderPicker}
          onClose={() => setShowFolderPicker(false)}
          project={project}
          selectedFolderIds={selectedFolderIds}
          submitting={submitting}
          onConfirm={async (ids) => {
            setSelectedFolderIds(ids);
            if (selectedRFI && detailModalVisible && !createModalVisible) {
              await handleUpdateLinks(ids);
            }
            setShowFolderPicker(false);
          }}
        />

      </Modal>

      {/* Removed old redundant Create Modal location as it is now nested for iOS support */}



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
      {/* Removed root-level modal for RFI as it needs to be nested for iOS compatibility */}

      {/* Root-level fallbacks for iOS compatibility (Russian Doll nesting) */}
      {!detailModalVisible && (
        <>
          {createModalVisible ? (
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
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{isEditing ? 'Edit RFI' : 'New RFI'}</Text>
                    <TouchableOpacity onPress={() => { setCreateModalVisible(false); setIsEditing(false); }} disabled={submitting}>
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
                            <View key={idx} style={{ position: 'relative' }}>
                              <Image
                                source={{ uri }}
                                style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                              />
                              <TouchableOpacity
                                onPress={() => {
                                 
                                  // If this was an original photo, we need to track its key for deletion
                                  if (isEditing && selectedRFI && uri.startsWith('http')) {
                                    // Strip query params for more robust matching
                                    const baseUri = uri.split('?')[0];
                                    const originalIdx = selectedRFI.photoDownloadUrls?.findIndex(url => {
                                      const baseUrl = url.split('?')[0];
                                      return baseUrl === baseUri;
                                    });
                                    
                                   

                                    if (originalIdx !== undefined && originalIdx !== -1) {
                                      const keyToRemove = selectedRFI.photos[originalIdx];
                                      
                                      if (keyToRemove) {
                                        setRemovedPhotos(prev => {
                                          const next = [...prev, keyToRemove];
                                          
                                          return next;
                                        });
                                      }
                                    }
                                  }
                                  setSelectedImages(selectedImages.filter((_, i) => i !== idx));
                                }}
                                style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', borderRadius: 10, padding: 3 }}
                              >
                                <Feather name="x" size={14} color="#fff" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => setAnnotatingImageIndex(idx)}
                                style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 8 }}
                              >
                                <Feather name="edit-2" size={12} color="#fff" />
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
                            <Feather name="camera" size={24} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={isEditing ? handleUpdateRFI : handleCreateRFI}
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
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{isEditing ? 'Save Changes' : 'Create RFI'}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>

                {/* Camera Stack nested inside Create Modal for root-level new RFI on iOS */}
                {cameraVisible && (
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
                            <View style={{
                              width: SCREEN_W,
                              height: CAMERA_HEIGHT,
                              overflow: 'hidden',
                              marginTop: Math.max(insets.top, 20) + 60,
                            }}>
                              <CameraView
                                key={cameraSessionKey}
                                style={StyleSheet.absoluteFill}
                                facing="back"
                                ref={cameraRef}
                                ratio="4:3"
                              />
                            </View>

                            <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                              <TouchableOpacity onPress={() => setCameraVisible(false)} style={cameraStyles.headerBtn}>
                                <Feather name="x" size={24} color="#fff" />
                              </TouchableOpacity>
                              <Text style={cameraStyles.headerTitle}>RFI Photos</Text>
                              <View style={{ width: 60 }} />
                            </View>

                            <View style={[cameraStyles.controlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
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
                      {annotatingImageIndex !== null && (
                        <ImageAnnotator
                          uri={cameraMode === 'create' ? selectedImages[annotatingImageIndex] : responseImages[annotatingImageIndex]}
                          onSave={(newUri) => {
                            if (cameraMode === 'create') {
                              const newImages = [...selectedImages];
                              newImages[annotatingImageIndex] = newUri;
                              setSelectedImages(newImages);
                            } else {
                              const newImages = [...responseImages];
                              newImages[annotatingImageIndex] = newUri;
                              setResponseImages(newImages);
                            }
                            setAnnotatingImageIndex(null);
                            setCameraVisible(false);
                          }}
                          onCancel={() => setAnnotatingImageIndex(null)}
                        />
                      )}
                    </View>
                  </Modal>
                )}

                {/* Annotator for gallery picks while inside Create Modal */}
                {!cameraVisible && annotatingImageIndex !== null && (
                  <ImageAnnotator
                    uri={cameraMode === 'create' ? selectedImages[annotatingImageIndex] : responseImages[annotatingImageIndex]}
                    onSave={(newUri) => {
                      if (cameraMode === 'create') {
                        const newImages = [...selectedImages];
                        newImages[annotatingImageIndex] = newUri;
                        setSelectedImages(newImages);
                      } else {
                        const newImages = [...responseImages];
                        newImages[annotatingImageIndex] = newUri;
                        setResponseImages(newImages);
                      }
                      setAnnotatingImageIndex(null);
                    }}
                    onCancel={() => setAnnotatingImageIndex(null)}
                  />
                )}

                {/* Assignee Picker Modal nested for iOS support on root-level create */}
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
              </View>
            </Modal>
          ) : (
            <>
              {cameraVisible && (
                <Modal
                  visible={cameraVisible}
                  animationType="slide"
                  transparent={false}
                  presentationStyle="fullScreen"
                  statusBarTranslucent={true}
                  onRequestClose={() => setCameraVisible(false)}
                >
                  {/* Camera UI - same as above */}
                  <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <View style={{ flex: 1 }}>
                      {cameraPermission?.granted && cameraReady ? (
                        <>
                          <View style={{
                            width: SCREEN_W,
                            height: CAMERA_HEIGHT,
                            overflow: 'hidden',
                            marginTop: Math.max(insets.top, 20) + 60,
                          }}>
                            <CameraView
                              key={cameraSessionKey}
                              style={StyleSheet.absoluteFill}
                              facing="back"
                              ref={cameraRef}
                              ratio="4:3"
                            />
                          </View>
                          {/* ... Header and Controls ... */}
                          <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                            <TouchableOpacity onPress={() => setCameraVisible(false)} style={cameraStyles.headerBtn}>
                              <Feather name="x" size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={cameraStyles.headerTitle}>RFI Photos</Text>
                            <View style={{ width: 60 }} />
                          </View>
                          <View style={[cameraStyles.controlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
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
                        </>
                      ) : (
                        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                          <ActivityIndicator color="#fff" />
                        </View>
                      )}
                    </View>
                    {annotatingImageIndex !== null && (
                      <ImageAnnotator
                        uri={cameraMode === 'create' ? selectedImages[annotatingImageIndex] : responseImages[annotatingImageIndex]}
                        onSave={(newUri) => {
                          if (cameraMode === 'create') {
                            const newImages = [...selectedImages];
                            newImages[annotatingImageIndex] = newUri;
                            setSelectedImages(newImages);
                          } else {
                            const newImages = [...responseImages];
                            newImages[annotatingImageIndex] = newUri;
                            setResponseImages(newImages);
                          }
                          setAnnotatingImageIndex(null);
                          setCameraVisible(false);
                        }}
                        onCancel={() => setAnnotatingImageIndex(null)}
                      />
                    )}
                  </View>
                </Modal>
              )}
            </>
          )}

          <FullScreenImageModal
            visible={!!previewImage}
            onClose={() => setPreviewImage(null)}
            uri={previewImage}
            onEdit={(u) => { if (u) setAnnotatingRemoteUri(u); }}
          />
        </>
      )}

      {/* Removed old Annotator locations as they are now handled by nested/conditional rendering */}

      {/* Removed old Camera location as it is now nested for iOS support */}

      {/* Removed old redundant Assignee Picker location as it is now nested for iOS support */}

      {/* Removed old root-level Folder Picker as it is now nested for iOS support */}
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
    alignSelf: 'flex-start',
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
