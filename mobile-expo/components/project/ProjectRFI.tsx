import React, { useState, useCallback, useEffect } from 'react';
import {
  View, TouchableOpacity, FlatList, BackHandler, ActivityIndicator,
  Modal, ScrollView, TextInput, Alert, StyleSheet, Platform, RefreshControl, Dimensions,
  KeyboardAvoidingView
} from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/AppText';
import { Feather, Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocket } from '@/contexts/SocketContext';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImageManipulator from 'expo-image-manipulator';

import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import { Project, User } from '@/types';
import {
  getRFIs, createRFI, updateRFIStatus, RFI, ConversationMessage, getRFIAssignees, updateRFIResponse, deleteRFI, updateRFI,
  getRFIById, markRFISeen, getRFIMessages, sendRFIMessage
} from '@/services/rfiService';
import DateTimePicker from '@react-native-community/datetimepicker';

// Removed AnimatedCameraView for stability

// Removed AnimatedCameraView for stability
import ImageAnnotator from '@/components/common/ImageAnnotator';
import { Assignee } from '@/services/snagService';
import FullScreenImageModal from '@/components/shared/FullScreenImageModal';
import { parseApiError } from '@/helpers/apiError';
import MobileFolderPickerDialog from './MobileFolderPickerDialog';
import VoiceNoteRecorder from '@/components/chat/VoiceNoteRecorder';
import VoiceNotePlayer from '@/components/chat/VoiceNotePlayer';

const isAudio = (url: string) => {
  if (!url) return false;
  try {
    const urlWithoutQuery = url.split('?')[0];
    return !!urlWithoutQuery.match(/\.(m4a|mp4|wav|mp3|webm|aac|3gp|caf)$/i);
  } catch {
    return false;
  }
};
interface Props {
  project: Project;
  user: User;
  onUpdate?: () => void;
  initialRfiId?: string;
}

const statusConfig = (t: any) => ({
  open: { icon: 'alert-circle', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: t('projectRfi.statusLabel.open') },
  closed: { icon: 'check-circle', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: t('projectRfi.statusLabel.closed') },
  overdue: { icon: 'alert-triangle', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: t('projectRfi.statusLabel.overdue') },
});


const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CAMERA_HEIGHT = (SCREEN_W / 3) * 4;

const mergeUniqueMessages = (messages: ConversationMessage[]) => {
  const seen = new Set<number>();
  return messages.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
};

export default function ProjectRFI({ project, user, onUpdate, initialRfiId }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const config = statusConfig(t);

  const router = useRouter();

  const insets = useSafeAreaInsets();
  const MAX_RFI_IMAGES = 4;
  const [rfis, setRfis] = useState<RFI[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'overdue'>('all');
  const [playingUri, setPlayingUri] = useState<string | null>(null);
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
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [responseBody, setResponseBody] = useState('');
  const [updatingResponse, setUpdatingResponse] = useState(false);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageAttachment, setMessageAttachment] = useState<string | null>(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<(string | number)[]>([]);

  // Physical Orientation Tracking
  const [physicalOrientation, setPhysicalOrientation] = useState<number>(0);

  useEffect(() => {
    console.log("Playing URI : ", playingUri)
  }, [playingUri])

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
  const [removedResponsePhotos, setRemovedResponsePhotos] = useState<string[]>([]);
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
  const zoomShared = useSharedValue(0); // 0–1 for expo-camera
  const startZoom = useSharedValue(0);
  const MIN_ZOOM = Platform.OS === 'ios' ? 0.5 : 1.0;
  const [zoomDisplay, setZoomDisplay] = useState(Platform.OS === 'ios' ? '0.5x' : '1.0x'); // live label
  const [cameraZoom, setCameraZoom] = useState(0); // Standard React state for camera zoom prop
  const zoomLabelOpacity = useSharedValue(0);
  let zoomHideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Max real-world zoom multiplier each platform supports
  const MAX_ZOOM_FACTOR = Platform.OS === 'ios' ? 10 : 10;

  // Converts 0-1 internal value → display string like "2.3x"
  const toDisplayZoom = (val: number) => {
    const factor = MIN_ZOOM + val * (MAX_ZOOM_FACTOR - MIN_ZOOM);
    return `${factor.toFixed(1)}x`;
  };

  const showZoomLabel = (val: number) => {
    const rounded = Math.round(val * 1000) / 1000;
    setZoomDisplay(toDisplayZoom(rounded));
    setCameraZoom(rounded);
    zoomLabelOpacity.value = withTiming(1, { duration: 80 });
    if (zoomHideTimer.current) clearTimeout(zoomHideTimer.current);
    zoomHideTimer.current = setTimeout(() => {
      zoomLabelOpacity.value = withTiming(0, { duration: 400 });
    }, 1500);
  };

  const pinchGesture = React.useMemo(() =>
    Gesture.Pinch()
      .onStart(() => {
        startZoom.value = zoomShared.value;
      })
      .onUpdate((event) => {
        // Multiplicative zoom feels natural — same as native camera apps
        const raw = startZoom.value + (event.scale - 1) * (1 / (MAX_ZOOM_FACTOR - MIN_ZOOM));
        const clamped = Math.max(0, Math.min(1, raw));
        zoomShared.value = clamped;
        runOnJS(showZoomLabel)(clamped);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoomShared, startZoom]);

  // Removed animatedCameraProps

  // Removed animatedCameraProps

  const zoomLabelStyle = useAnimatedStyle(() => ({
    opacity: zoomLabelOpacity.value,
  }));

  // Unified Manual Zoom Handler
  const handleManualZoom = (factor: number) => {
    const z = (factor - MIN_ZOOM) / (MAX_ZOOM_FACTOR - MIN_ZOOM);
    const clamped = Math.max(0, Math.min(1, z));
    
    // Sync everything immediately
    zoomShared.value = clamped; 
    showZoomLabel(clamped);
  };

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

  useEffect(() => {
    if (selectedRFI) {
      setResponseBody(selectedRFI.response || '');
      setRemovedResponsePhotos([]);
      setResponseImages([]);
    }
  }, [selectedRFI?.id]);

  useEffect(() => {
    if (responseImages.length > 0) {
      const latest = responseImages[responseImages.length - 1];
      setMessageAttachment(latest);
    }
  }, [responseImages]);

  const selectedImageCount = selectedImages.filter(uri => !isAudio(uri)).length;
  const hasSelectedAudio = !!selectedAudio;
  const responseImageCount = responseImages.filter(uri => !isAudio(uri)).length;
  const hasPendingResponseAudio = responseImages.some(isAudio);
  const hasExistingResponseImage = !!selectedRFI?.responsePhotoUrls?.some(uri => !isAudio(uri));
  const hasExistingResponseAudio = !!selectedRFI?.responsePhotoUrls?.some(isAudio);
  const isConversationParticipant = !!selectedRFI && (
    String(selectedRFI.assigned_to) === String(user?.id) ||
    String(selectedRFI.created_by) === String(user?.id) ||
    String(selectedRFI.creator?.id) === String(user?.id)
  );

  const projectId = Number(project.id);

  const fetchRFIs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getRFIs(projectId);
      setRfis(data);
    } catch (err) {
      console.error("fetchRFIs error", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId]);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !projectId) return;

    socket.emit('join-project', projectId);

    const onRFISeen = (data: { rfiId: number, seen_at: string }) => {
      setRfis(prev => prev.map(r => r.id === data.rfiId ? { ...r, seen_at: data.seen_at } : r));
      setSelectedRFI(prev => (prev && prev.id === data.rfiId) ? { ...prev, seen_at: data.seen_at } : prev);
    };

    const onRFIUpdated = (data: { rfi: RFI }) => {
      setRfis(prev => {
        const idx = prev.findIndex(r => r.id === data.rfi.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = data.rfi;
          return copy;
        }
        return [data.rfi, ...prev];
      });
      setSelectedRFI(prev => (prev && prev.id === data.rfi.id) ? data.rfi : prev);
    };

    const onRFIDeleted = (data: { rfiId: number }) => {
      setRfis(prev => prev.filter(r => r.id !== data.rfiId));
      setSelectedRFI(prev => (prev && prev.id === data.rfiId) ? null : prev);
    };

    socket.on('rfi-seen', onRFISeen);
    socket.on('rfi-updated', onRFIUpdated);
    socket.on('rfi-deleted', onRFIDeleted);
    socket.on('rfi-conversation-message', ({ itemType, itemId, message }: { itemType: 'rfi' | 'snag'; itemId: number; message: ConversationMessage }) => {
      if (itemType !== 'rfi' || !selectedRFI || selectedRFI.id !== itemId) return;
      setConversationMessages(prev => mergeUniqueMessages([...prev, message]));
    });

    return () => {
      socket.off('rfi-seen', onRFISeen);
      socket.off('rfi-updated', onRFIUpdated);
      socket.off('rfi-deleted', onRFIDeleted);
      socket.off('rfi-conversation-message');
    };
  }, [socket, projectId, selectedRFI?.id]);

  useEffect(() => {
    if (selectedRFI && String(selectedRFI.assigned_to) === String(user?.id) && !selectedRFI.seen_at) {
      markRFISeen(selectedRFI.id).then(data => {
        setSelectedRFI(prev => prev ? { ...prev, seen_at: data.seen_at } : null);
        setRfis(prev => prev.map(r => r.id === selectedRFI.id ? { ...r, seen_at: data.seen_at } : r));
      }).catch(err => console.error("Failed to mark RFI as seen:", err));
    }
  }, [selectedRFI?.id, user?.id]);

  useEffect(() => {
    if (!selectedRFI) {
      setConversationMessages([]);
      setMessageText('');
      setMessageAttachment(null);
      return;
    }

    setLoadingMessages(true);
    getRFIMessages(selectedRFI.id)
      .then((messages) => setConversationMessages(mergeUniqueMessages(messages)))
      .catch(err => {
        console.error("getRFIMessages error", err);
      })
      .finally(() => setLoadingMessages(false));
  }, [selectedRFI?.id]);

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
    if (selectedImageCount >= MAX_RFI_IMAGES) {
      Alert.alert(t('projectRfi.limitExceeded'), t('projectRfi.maxPhotosAllowed', { max: MAX_RFI_IMAGES }));
      return;
    }


    await openCamera('create');
  };

  const openCamera = async (mode: 'create' | 'response' = 'create') => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert(
          t('projectRfi.cameraAccess'),
          t('projectRfi.cameraPermissionNeeded')
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
        setAnnotatingImageIndex(selectedImageCount);
      } else {
        setResponseImages(prev => {
          const filtered = prev.filter(p => isAudio(p));
          return [...filtered, uri];
        });
        setAnnotatingImageIndex(0);
      }
    } catch (error) {
      console.error('pickImageFiles error', error);
      Alert.alert(t('projectRfi.error'), t('projectRfi.failedToPickImage'));
    }

  };

  const capturePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;
    if (cameraMode === 'create' && selectedImageCount >= MAX_RFI_IMAGES) {
      Alert.alert(t('projectRfi.limitExceeded'), t('projectRfi.maxPhotosAllowed', { max: MAX_RFI_IMAGES }));
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
        setAnnotatingImageIndex(selectedImageCount);
      } else {
        // Replace existing image but keep audio
        setResponseImages(prev => {
          const filtered = prev.filter(p => isAudio(p));
          return [...filtered, manipulated.uri];
        });
        setAnnotatingImageIndex(0);
      }
    } catch (e: any) {
      console.error('capturePhoto error', e);
      Alert.alert(t('projectRfi.cameraError'), e?.message || t('projectRfi.failedToCapture'));
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
    setSelectedAudio(null);
    setRemovedPhotos([]);
    setSelectedFolderIds([]);
    setIsEditing(false);
    setSelectedRFI(null);
  };

  const handleCreateRFI = async () => {
    if (!title.trim()) {
      Alert.alert(t('projectRfi.error'), t('projectRfi.titleRequired'));
      return;
    }
    if (!assignedToId) {
      Alert.alert(t('projectRfi.error'), t('projectRfi.assigneeRequired'));
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
      if (selectedAudio) {
        const filename = selectedAudio.split('/').pop() || `voice_${Date.now()}.m4a`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `audio/${match[1]}` : `audio/mp4`;
        formData.append('photos', { uri: selectedAudio, name: filename, type } as any);
      }

      await createRFI(formData);
      Alert.alert(t('projectRfi.success'), t('projectRfi.rfiCreated'));
      setCreateModalVisible(false);

      resetForm();
      fetchRFIs();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('handleCreateRFI error', err);
      const { message, code } = parseApiError(err, t('projectRfi.failedToCreate'));
      Alert.alert(code === 'LIMIT_REACHED' ? t('projectRfi.limitReached') : t('projectRfi.error'), message);
    } finally {

      setSubmitting(false);
    }
  };

  const handleUpdateRFI = async () => {
    if (!selectedRFI) return;
    if (!title.trim()) { Alert.alert(t('projectRfi.error'), t('projectRfi.titleRequired')); return; }

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
      if (selectedAudio && !selectedAudio.startsWith('http')) {
        const filename = selectedAudio.split('/').pop() || `voice_${Date.now()}.m4a`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `audio/${match[1]}` : `audio/mp4`;
        formData.append('photos', { uri: selectedAudio, name: filename, type } as any);
      }

      const updated = await updateRFI(selectedRFI.id, formData);
      Alert.alert(t('projectRfi.success'), t('projectRfi.rfiUpdated'));
      setCreateModalVisible(false);

      resetForm();
      setSelectedRFI(updated);
      fetchRFIs();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('handleUpdateRFI error', err);
      Alert.alert(t('projectRfi.error'), t('projectReports.weekly.failedGenerate')); // Reusing for consistency or use failedToCreate
    } finally {

      setSubmitting(false);
    }
  };

  const handleDeleteRFI = async (id: number) => {
    Alert.alert(
      t('projectRfi.deleteRfi'),
      t('projectRfi.deleteConfirm'),
      [
        { text: t('projectRfi.cancel'), style: 'cancel' },
        {
          text: t('projectWorkspace.moveToTrash'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRFI(id);
              Alert.alert(t('projectRfi.success'), t('projectRfi.rfiDeleted'));
              setDetailModalVisible(false);

              fetchRFIs();
              if (onUpdate) onUpdate();
            } catch (err) {
              Alert.alert(t('projectRfi.error'), t('projectRfi.failedToCreate')); // Simplified fallback
            }
          }
        }
      ]
    );

  };

  const handleUpdateResponse = async (commentOverride?: string, imagesOverride?: string[]) => {
    if (!selectedRFI) return;
    setUpdatingResponse(true);
    try {
      const formData = new FormData();
      const finalComment = commentOverride !== undefined ? commentOverride : responseBody;
      const finalImages = imagesOverride !== undefined ? imagesOverride : responseImages;

      formData.append('response', (finalComment || "").trim());
      finalImages.forEach((uri, index) => {
        let filename = uri.split('/').pop() || `resp_${index}.jpg`;
        if (isAudio(uri) && !filename.includes('.')) filename += '.m4a';
        const match = /\.(\w+)$/.exec(filename);
        let type = `image/jpeg`;
        if (match) {
          type = isAudio(filename) ? `audio/${match[1]}` : `image/${match[1]}`;
        }
        formData.append('photos', { uri, name: filename, type } as any);
      });

      if (removedResponsePhotos.length > 0) {
        formData.append('removedPhotos', JSON.stringify(removedResponsePhotos));
      }

      const updated = await updateRFIResponse(selectedRFI.id, formData);
      Alert.alert(t('projectRfi.success'), t('projectRfi.responseUpdated'));


      // Update local state to reflect changes immediately
      setRfis(prev => prev.map(r => r.id === selectedRFI.id ? updated : r));
      setSelectedRFI(updated);
      setResponseBody(updated.response || '');
      setResponseImages([]);
      setRemovedResponsePhotos([]);
      fetchRFIs(true);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('handleUpdateResponse error', err);
      Alert.alert(t('projectRfi.error'), t('projectRfi.failedToSendMessage'));
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
      Alert.alert(t('projectRfi.success'), t('projectRfi.statusUpdated', { status }));
      fetchRFIs();

      if (onUpdate) onUpdate();
      if (selectedRFI?.id === id) {
        setSelectedRFI({ ...selectedRFI, status: status as any });
      }
    } catch (err) {
      console.error('handleStatusUpdate error', err);
      Alert.alert(t('projectRfi.error'), t('projectRfi.failedToUpdateStatus'));
    }

  };

  const sendConversationMessage = async () => {
    if (!selectedRFI) return;
    if (!messageText.trim() && !messageAttachment) return;

    setUpdatingResponse(true);
    try {
      const formData = new FormData();
      if (messageText.trim()) formData.append('text', messageText.trim());

      if (messageAttachment) {
        let filename = messageAttachment.split('/').pop() || `message_${Date.now()}.jpg`;
        if (isAudio(messageAttachment) && !filename.includes('.')) filename += '.m4a';
        const match = /\.(\w+)$/.exec(filename);
        let type = isAudio(filename) ? 'audio/m4a' : 'image/jpeg';
        if (match) {
          type = isAudio(filename) ? `audio/${match[1]}` : `image/${match[1]}`;
        }
        formData.append('file', { uri: messageAttachment, name: filename, type } as any);
      }

      const message = await sendRFIMessage(selectedRFI.id, formData);
      setConversationMessages(prev => mergeUniqueMessages([...prev, message]));
      setMessageText('');
      setMessageAttachment(null);
    } catch (err) {
      console.error('sendConversationMessage error', err);
      Alert.alert(t('projectRfi.error'), t('projectRfi.failedToUpdateResponse'));
    } finally {
      setUpdatingResponse(false);
    }
  };

  const filteredRfis = rfis.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesCreator = creatorFilter === 'all' || String(r.created_by) === creatorFilter;
    const matchesAssignee = assigneeFilter === 'all' || String(r.assigned_to) === assigneeFilter;
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
      Alert.alert(t('projectRfi.success'), t('projectRfi.linksUpdated'));
    } catch (err) {

      console.error("Update Links Error:", err);
      const { message } = parseApiError(err, t('projectRfi.failedToUpdateLinks'));
      Alert.alert(t('projectRfi.error'), message);

    } finally {
      setSubmitting(false);
    }
  };

  const renderRFI = ({ item }: { item: RFI }) => {
    const itemConfig = config[item.status] || config.open;
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
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: itemConfig.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={itemConfig.icon as any} size={20} color={itemConfig.color} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>{item.title}</Text>
              <View style={{ backgroundColor: itemConfig.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: itemConfig.color }}>{itemConfig.label}</Text>
              </View>

            </View>

            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }} numberOfLines={2}>{item.description}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 8, color: colors.textMuted }}>{item.creator?.name?.charAt(0) || '?'}</Text>
                </View>
                <Text style={{ fontSize: 10, color: colors.textMuted }}>{t('projectRfi.by')} {item.creator?.name || t('projectRfi.unknown')}</Text>
              </View>

              {item.assignee && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="user" size={10} color={colors.primary} />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.primary }}>{item.assignee.name}</Text>
                </View>
              )}

              {item.seen_at && (
                <Ionicons name="checkmark-done" size={12} color="#f97316" />
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
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('projectRfi.newRfi')}</Text>
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
            {statusFilter === 'all' ? t('projectRfi.status') : statusFilter.toUpperCase()}
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
            {creatorFilter === 'all' ? t('projectRfi.creator') : (rfis.find(r => String(r.created_by) === creatorFilter)?.creator?.name || t('projectRfi.creator')).toUpperCase()}
          </Text>
          <Feather name="chevron-down" size={12} color={creatorFilter !== 'all' ? colors.primary : colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setActiveFilterType('assignee'); setFilterModalVisible(true); }}
          style={{
            flex: 1.2, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10,
            backgroundColor: assigneeFilter !== 'all' ? colors.primary + '10' : colors.surface
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: assigneeFilter !== 'all' ? colors.primary : colors.textMuted }} numberOfLines={1}>
            {assigneeFilter === 'all' ? t('projectRfi.assignee') : rfis.find(r => String(r.assigned_to) === assigneeFilter)?.assignee?.name || t('projectRfi.assignee')}
          </Text>
          <Feather name="chevron-down" size={14} color={assigneeFilter !== 'all' ? colors.primary : colors.textMuted} />
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
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>{t('projectRfi.noRfisFound')}</Text>
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
              height: SCREEN_H * 0.80,
              padding: 20
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{t('projectRfi.rfiDetails')}</Text>
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
                        setSelectedImages((selectedRFI.photoDownloadUrls || []).filter(url => !isAudio(url)));
                        setSelectedAudio((selectedRFI.photoDownloadUrls || []).find(isAudio) || null);
                        setRemovedPhotos([]);
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
                  <TouchableOpacity onPress={() => { setDetailModalVisible(false); }}>
                    <Feather name="x" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {selectedRFI && (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  keyboardDismissMode="none"
                >

                  <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <View style={{
                        backgroundColor: config[selectedRFI.status]?.bg || 'rgba(0,0,0,0.1)',
                        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: config[selectedRFI.status]?.color }}>
                          {config[selectedRFI.status]?.label}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        {t('projectRfi.createdOn', { date: new Date(selectedRFI.createdAt).toLocaleDateString() })}
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
                        <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('projectRfi.createdBy')}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{selectedRFI.creator?.name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('projectRfi.assignedTo')}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{selectedRFI.assignee?.name || t('projectRfi.unassigned')}</Text>
                      </View>
                    </View>


                    {(selectedRFI?.photoDownloadUrls?.length || 0) > 0 && (
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>{t('projectRfi.attachments')}</Text>

                        {(selectedRFI.photoDownloadUrls || []).filter(url => !isAudio(url)).length > 0 && (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                            {(selectedRFI.photoDownloadUrls || []).filter(url => !isAudio(url)).map((url, idx) => (
                              <TouchableOpacity key={idx} onPress={() => setPreviewImage(url)}>
                                <Image
                                  source={url}
                                  style={{ width: 120, height: 120, borderRadius: 12 }}
                                  contentFit="cover"
                                  transition={200}
                                />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                        {(selectedRFI.photoDownloadUrls || []).filter(isAudio).length > 0 && (
                          <View style={{ marginTop: 12, gap: 10 }}>
                            {(selectedRFI.photoDownloadUrls || []).filter(isAudio).map((url, idx) => (
                              <View
                                key={idx}
                                style={{
                                  padding: 12,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  borderRadius: 16,
                                  backgroundColor: colors.surface,
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 1 },
                                  shadowOpacity: 0.05,
                                  shadowRadius: 2,
                                  elevation: 2
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted }} />
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5 }}>{t('projectRfi.voiceAttachment')}</Text>
                                </View>

                                <VoiceNotePlayer uri={url} isMe={false} colors={colors} playingUri={playingUri} onPlay={setPlayingUri} />
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {selectedRFI.expiry_date && (
                      <View style={{ marginBottom: 20, padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: selectedRFI.status === 'overdue' ? '#ef4444' : colors.primary }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>{t('projectRfi.expiryDate')}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: selectedRFI.status === 'overdue' ? '#ef4444' : colors.text }}>

                          {new Date(selectedRFI.expiry_date).toLocaleString()}
                        </Text>
                      </View>
                    )}

                    {selectedRFI.linked_folders && selectedRFI.linked_folders.length > 0 && (
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>{t('projectRfi.linkedFolders')}</Text>
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

                    <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15, marginTop: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('projectRfi.response')}</Text>
                      {loadingMessages ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (conversationMessages.length === 0 && !selectedRFI?.response && (!selectedRFI?.responsePhotoUrls || selectedRFI.responsePhotoUrls.length === 0)) ? (
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('projectRfi.noMessagesYet')}</Text>
                      ) : (
                        <View style={{ gap: 10 }}>
                          {/* Legacy Response Block */}
                          {(selectedRFI?.response || (selectedRFI?.responsePhotoUrls && selectedRFI.responsePhotoUrls.length > 0)) && (
                            <View style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                              <View style={{
                                maxWidth: '86%',
                                padding: 12,
                                borderRadius: 16,
                                backgroundColor: colors.surface,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, marginBottom: 4 }}>
                                  Response
                                </Text>
                                {selectedRFI.response ? (
                                  <Text style={{ fontSize: 13, color: colors.text }}>{selectedRFI.response}</Text>
                                ) : null}
                                {selectedRFI.responsePhotoUrls?.map((url, idx) => {
                                  const isAudioFile = isAudio(url);
                                  if (isAudioFile) {
                                    return (
                                      <View key={idx} style={{ marginTop: 8 }}>
                                        <VoiceNotePlayer uri={url} isMe={false} colors={colors} playingUri={playingUri} onPlay={setPlayingUri} />
                                      </View>
                                    );
                                  } else {
                                    return (
                                      <TouchableOpacity key={idx} onPress={() => setPreviewImage(url)}>
                                        <Image source={{ uri: url }} style={{ width: 120, height: 120, borderRadius: 10, marginTop: 8 }} />
                                      </TouchableOpacity>
                                    );
                                  }
                                })}
                              </View>
                            </View>
                          )}
                          {conversationMessages.map((message) => {
                            const isMine = String(message.sender_id) === String(user.id);
                            return (
                              <View key={message.id} style={{ alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                                <View style={{
                                  maxWidth: '86%',
                                  padding: 12,
                                  borderRadius: 16,
                                  backgroundColor: isMine ? colors.primary : colors.surface,
                                  borderWidth: 1,
                                  borderColor: isMine ? colors.primary : colors.border,
                                }}>
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: isMine ? '#fff' : colors.textMuted, marginBottom: 4 }}>
                                    {message.sender?.name || (isMine ? 'You' : 'User')}
                                  </Text>
                                  {message.text ? <Text style={{ fontSize: 13, color: isMine ? '#fff' : colors.text }}>{message.text}</Text> : null}
                                  {message.attachment_type === 'image' && message.downloadUrl ? (
                                    <TouchableOpacity onPress={() => setPreviewImage(message.downloadUrl!)}>
                                      <Image source={{ uri: message.downloadUrl }} style={{ width: 160, height: 160, borderRadius: 12, marginTop: 8 }} />
                                    </TouchableOpacity>
                                  ) : null}
                                  {message.attachment_type === 'audio' && message.downloadUrl ? (
                                    <View style={{ marginTop: 8 }}>
                                      <VoiceNotePlayer uri={message.downloadUrl} isMe={isMine} colors={colors} playingUri={playingUri} onPlay={setPlayingUri} />
                                    </View>
                                  ) : null}
                                  <Text style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.8)' : colors.textMuted, marginTop: 6 }}>
                                    {new Date(message.createdAt).toLocaleString()}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>

                    {isConversationParticipant && (
                      <View style={{ gap: 10, marginTop: 6 }}>
                        {selectedRFI.status !== 'closed' ? (
                          <>
                            <View style={{
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: 20,
                              backgroundColor: colors.surface,
                              padding: 12,
                              gap: 10
                            }}>
                              {messageAttachment ? (
                                <View style={{
                                  borderRadius: 16,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  backgroundColor: colors.background,
                                  padding: 10,
                                  gap: 10
                                }}>
                                  {isAudio(messageAttachment) ? (
                                    <VoiceNotePlayer uri={messageAttachment} isMe={false} colors={colors} playingUri={playingUri} onPlay={setPlayingUri} />
                                  ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                      <Image source={{ uri: messageAttachment }} style={{ width: 72, height: 72, borderRadius: 14, borderWidth: 1, borderColor: colors.border }} />
                                      <View style={{ flex: 1, gap: 8 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{t('projectRfi.photo')}</Text>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                          <TouchableOpacity
                                            onPress={pickResponsePhotos}
                                            style={{
                                              height: 34,
                                              paddingHorizontal: 12,
                                              borderRadius: 10,
                                              borderWidth: 1,
                                              borderColor: colors.border,
                                              backgroundColor: colors.surface,
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexDirection: 'row',
                                              gap: 6
                                            }}
                                          >
                                            <Feather name="edit-2" size={14} color={colors.text} />
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>Edit</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            onPress={() => setMessageAttachment(null)}
                                            style={{
                                              height: 34,
                                              paddingHorizontal: 12,
                                              borderRadius: 10,
                                              backgroundColor: '#fee2e2',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexDirection: 'row',
                                              gap: 6
                                            }}
                                          >
                                            <Feather name="trash-2" size={14} color="#ef4444" />
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#ef4444' }}>Remove</Text>
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    </View>
                                  )}
                                  {isAudio(messageAttachment) ? (
                                    <TouchableOpacity
                                      onPress={() => setMessageAttachment(null)}
                                      style={{ alignSelf: 'flex-end', flexDirection: 'row', gap: 6, alignItems: 'center' }}
                                    >
                                      <Feather name="trash-2" size={14} color="#ef4444" />
                                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#ef4444' }}>Remove</Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </View>
                              ) : null}
                              <TextInput
                                value={messageText}
                                onChangeText={setMessageText}
                                placeholder={t('projectRfi.typeResponsePlaceholder')}
                                placeholderTextColor={colors.textMuted}
                                multiline
                                style={{
                                  minHeight: 88,
                                  color: colors.text,
                                  textAlignVertical: 'top',
                                  fontSize: 14
                                }}
                              />
                              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  {!messageAttachment && !isVoiceRecording && (
                                    <TouchableOpacity
                                      onPress={pickResponsePhotos}
                                      style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 14,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: colors.background
                                      }}
                                    >
                                      <Feather name="camera" size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                  )}
                                  {!messageAttachment && (
                                    <View style={{ flex: 1, minHeight: 40, justifyContent: 'center' }}>
                                      <VoiceNoteRecorder
                                        colors={colors}
                                        onRecordingStateChange={setIsVoiceRecording}
                                        onSend={(uri) => setMessageAttachment(uri)}
                                        embedded
                                      />
                                    </View>
                                  )}
                                </View>
                                {!isVoiceRecording && (
                                  <TouchableOpacity
                                    onPress={sendConversationMessage}
                                    disabled={updatingResponse || (!messageText.trim() && !messageAttachment)}
                                    style={{
                                      backgroundColor: colors.primary,
                                      minWidth: 132,
                                      height: 44,
                                      paddingHorizontal: 18,
                                      borderRadius: 14,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      opacity: (updatingResponse || (!messageText.trim() && !messageAttachment)) ? 0.6 : 1
                                    }}
                                  >
                                    {updatingResponse ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{t('projectRfi.sendMessage')}</Text>}
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>

                          </>
                        ) : (
                          <View style={{ padding: 12, backgroundColor: colors.surface, borderRadius: 12, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('projectRfi.closedRfiNoUpdate')}</Text>
                          </View>

                        )}
                      </View>
                    )}

                    {isConversationParticipant && (
                      <View style={{ gap: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('projectRfi.updateStatus')}</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>

                          {['open', 'closed', 'overdue'].map((s) => (
                            <TouchableOpacity
                              key={s}
                              onPress={() => handleStatusUpdate(selectedRFI.id, s)}
                              style={{
                                flex: 1,
                                height: 40,
                                borderRadius: 10,
                                backgroundColor: selectedRFI.status === s ? config[s as keyof typeof config].color : colors.surface,
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
                                {config[s as keyof typeof config].label}
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
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{isEditing ? t('projectRfi.editRfi') : t('projectRfi.newRfi')}</Text>

                  <TouchableOpacity onPress={() => { setCreateModalVisible(false); setIsEditing(false); }} disabled={submitting}>
                    <Feather name="x" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={{ gap: 20 }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>{t('projectRfi.titleLabel')}</Text>

                      <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder={t('projectRfi.titlePlaceholder')}

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
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>{t('projectRfi.descriptionLabel')}</Text>

                      <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder={t('projectRfi.descriptionPlaceholder')}

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
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>{t('projectRfi.assignToLabel')}</Text>
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
                            ? assignees.find(a => a.id === assignedToId)?.name || t('projectRfi.selectAssignee')
                            : t('projectRfi.selectAssigneePlaceholder')}
                        </Text>
                        <Feather name="chevron-down" size={18} color={assignedToId ? colors.primary : colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>{t('projectRfi.expiryDate')}</Text>
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
                          {expiryDate ? expiryDate.toLocaleString() : t('projectRfi.selectDate')}
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
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 12 }}>{t('projectRfi.photos')}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {selectedImages.map((uri: string, idx: number) => (
                          <View key={idx} style={{ position: 'relative' }}>
                            <Image
                              source={{ uri }}
                              style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                            />
                            <TouchableOpacity
                              onPress={() => {
                                if (isEditing && selectedRFI && uri.startsWith('http')) {
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
                        {selectedImageCount < MAX_RFI_IMAGES && (
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
                        )}
                      </View>
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 12 }}>{t('projectRfi.voiceNote')}</Text>
                        {selectedAudio ? (
                          <View style={{ position: 'relative', padding: 12, paddingRight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                              <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>{t('projectRfi.voiceNote')}</Text>
                            </View>
                            <VoiceNotePlayer uri={selectedAudio} isMe={false} colors={colors} playingUri={playingUri} onPlay={setPlayingUri} />
                            <TouchableOpacity
                              onPress={() => {
                                if (isEditing && selectedRFI && selectedAudio.startsWith('http')) {
                                  const originalIdx = selectedRFI.photoDownloadUrls?.findIndex(url => url.split('?')[0] === selectedAudio.split('?')[0]);
                                  if (originalIdx !== undefined && originalIdx !== -1) {
                                    const keyToRemove = selectedRFI.photos?.[originalIdx];
                                    if (keyToRemove) setRemovedPhotos(prev => [...prev, keyToRemove]);
                                  }
                                }
                                setSelectedAudio(null);
                              }}
                              style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#ef4444', borderRadius: 10, padding: 3 }}
                            >
                              <Feather name="x" size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <VoiceNoteRecorder
                            colors={colors}
                            onRecordingStateChange={() => { }}
                            onSend={(uri) => setSelectedAudio(uri)}
                          />
                        )}
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
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{isEditing ? t('projectRfi.saveChanges') : t('projectRfi.createRfi')}</Text>
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
                  <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
                    <View style={{ flex: 1 }}>
                      {cameraPermission?.granted && cameraReady ? (
                        <>
                          <View style={{
                            width: SCREEN_W,
                            height: CAMERA_HEIGHT,
                            overflow: 'hidden',
                            marginTop: Math.max(insets.top, 20) + 60,
                          }}>
                            <GestureDetector gesture={pinchGesture}>
                              <View collapsable={false} style={StyleSheet.absoluteFill}>
                                <CameraView
                                  ref={cameraRef}
                                  style={StyleSheet.absoluteFill}
                                  facing="back"
                                  ratio="4:3"
                                  zoom={cameraZoom}
                                />
                              </View>
                            </GestureDetector>
                            {/* Dynamic Zoom Indicator */}
                            <Animated.View
                              pointerEvents="none"
                              style={[
                                zoomLabelStyle,
                                {
                                  position: 'absolute',
                                  bottom: 64,
                                  alignSelf: 'center',
                                  backgroundColor: 'rgba(0,0,0,0.55)',
                                  paddingHorizontal: 14,
                                  paddingVertical: 6,
                                  borderRadius: 20,
                                  zIndex: 30,
                                }
                              ]}
                            >
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{zoomDisplay}</Text>
                            </Animated.View>
                            {/* Direct Zoom Buttons */}
                            <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 16, zIndex: 40 }}>
                              {(Platform.OS === 'ios' ? [0.5, 1, 2] : [1, 2, 3]).map(factor => (
                                <TouchableOpacity key={factor} onPress={() => handleManualZoom((factor - MIN_ZOOM) / (MAX_ZOOM_FACTOR - MIN_ZOOM))} style={{ backgroundColor: 'rgba(0,0,0,0.55)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{factor}x</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>

                          <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                            <TouchableOpacity onPress={() => setCameraVisible(false)} style={cameraStyles.headerBtn}>
                              <Feather name="x" size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={cameraStyles.headerTitle}>{t('projectRfi.rfiPhotos')}</Text>

                            <View style={{ width: 60 }} />
                          </View>

                          <View style={[cameraStyles.controlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
                            <View style={cameraStyles.shutterRow}>
                              <TouchableOpacity onPress={pickImageFiles} style={cameraStyles.sideBtn}>
                                <View style={cameraStyles.iconCircle}>
                                  <Feather name="image" size={24} color="#fff" />
                                </View>
                                <Text style={cameraStyles.btnLabel}>{t('projectRfi.gallery')}</Text>
                              </TouchableOpacity>

                              <TouchableOpacity onPress={capturePhoto} disabled={isCapturing} style={cameraStyles.shutterBtn}>
                                <View style={cameraStyles.shutterOuter}>
                                  <View style={cameraStyles.shutterInner} />
                                </View>
                                <Text style={cameraStyles.btnLabel}>{t('projectRfi.photo')}</Text>
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
                              <Text style={{ color: '#fff', marginBottom: 20 }}>{t('projectRfi.cameraAccessNeeded')}</Text>
                              <TouchableOpacity onPress={requestCameraPermission} style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 10 }}>
                                <Text style={{ color: '#fff', fontWeight: '700' }}>{t('projectRfi.continue')}</Text>
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
                  </GestureHandlerRootView>
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
                        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{t('projectRfi.assignToLabel')}</Text>
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
                <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
                  <View style={{ flex: 1 }}>
                    {cameraPermission?.granted && cameraReady ? (
                      <>
                        <View style={{
                          width: SCREEN_W,
                          height: CAMERA_HEIGHT,
                          overflow: 'hidden',
                          marginTop: Math.max(insets.top, 20) + 60,
                        }}>
                          <GestureDetector gesture={pinchGesture}>
                            <View collapsable={false} style={StyleSheet.absoluteFill}>
                              <CameraView
                                
                                ref={cameraRef}
                                style={StyleSheet.absoluteFill}
                                facing="back"
                                ratio="4:3"
                                zoom={cameraZoom}
                              />
                            </View>
                          </GestureDetector>
                          {/* Dynamic Zoom Indicator */}
                          <Animated.View
                            pointerEvents="none"
                            style={[
                              zoomLabelStyle,
                              {
                                position: 'absolute',
                                bottom: 64,
                                alignSelf: 'center',
                                backgroundColor: 'rgba(0,0,0,0.55)',
                                paddingHorizontal: 14,
                                paddingVertical: 6,
                                borderRadius: 20,
                                zIndex: 30,
                              }
                            ]}
                          >
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{zoomDisplay}</Text>
                          </Animated.View>
                          {/* Direct Zoom Buttons */}
                          <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 16, zIndex: 40 }}>
                            {(Platform.OS === 'ios' ? [0.5, 1, 2] : [1, 2, 3]).map(factor => (
                              <TouchableOpacity key={factor} onPress={() => handleManualZoom((factor - MIN_ZOOM) / (MAX_ZOOM_FACTOR - MIN_ZOOM))} style={{ backgroundColor: 'rgba(0,0,0,0.55)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{factor}x</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                          <TouchableOpacity onPress={() => setCameraVisible(false)} style={cameraStyles.headerBtn}>
                            <Feather name="x" size={24} color="#fff" />
                          </TouchableOpacity>
                          <Text style={cameraStyles.headerTitle}>{t('projectRfi.rfiPhotos')}</Text>
                          <View style={{ width: 60 }} />
                        </View>

                        <View style={[cameraStyles.controlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
                          <View style={cameraStyles.shutterRow}>
                            <TouchableOpacity onPress={pickImageFiles} style={cameraStyles.sideBtn}>
                              <View style={cameraStyles.iconCircle}>
                                <Feather name="image" size={24} color="#fff" />
                              </View>
                              <Text style={cameraStyles.btnLabel}>{t('projectRfi.gallery')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={capturePhoto} disabled={isCapturing} style={cameraStyles.shutterBtn}>
                              <View style={cameraStyles.shutterOuter}>
                                <View style={cameraStyles.shutterInner} />
                              </View>
                              <Text style={cameraStyles.btnLabel}>{t('projectRfi.photo')}</Text>
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
                            <Text style={{ color: '#fff', marginBottom: 20 }}>{t('projectRfi.cameraAccessNeeded')}</Text>
                            <TouchableOpacity onPress={requestCameraPermission} style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 10 }}>
                              <Text style={{ color: '#fff', fontWeight: '700' }}>{t('projectRfi.continue')}</Text>
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
                </GestureHandlerRootView>
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

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
        >
          <View style={{ backgroundColor: colors.background, borderRadius: 20, width: '100%', maxWidth: 340, padding: 20, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                {t('projectRfi.selectFilter', {
                  filter: activeFilterType === 'status' ? t('projectRfi.status') : (activeFilterType === 'creator' ? t('projectRfi.creator') : t('projectRfi.assignee'))
                })}
              </Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Feather name="x" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => {
                  if (activeFilterType === 'status') setStatusFilter('all');
                  else if (activeFilterType === 'creator') setCreatorFilter('all');
                  else setAssigneeFilter('all');
                  setFilterModalVisible(false);
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('All')}</Text>
                {(activeFilterType === 'status' ? statusFilter === 'all' : activeFilterType === 'creator' ? creatorFilter === 'all' : assigneeFilter === 'all') && (
                  <Feather name="check" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>

              {activeFilterType === 'status' && ['open', 'overdue', 'closed'].map(item => (
                <TouchableOpacity
                  key={item}
                  onPress={() => { setStatusFilter(item as any); setFilterModalVisible(false); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: config[item as 'open' | 'closed' | 'overdue'].color }} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{config[item as 'open' | 'closed' | 'overdue'].label}</Text>
                  </View>
                  {statusFilter === item && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}

              {activeFilterType === 'creator' && Array.from(new Set(rfis.map(r => r.creator?.id))).filter(Boolean).map(id => {
                const name = rfis.find(r => r.creator?.id === id)?.creator?.name;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => { setCreatorFilter(String(id)); setFilterModalVisible(false); }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{name}</Text>
                    {creatorFilter === String(id) && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}

              {activeFilterType === 'assignee' && (
                <>

                  {Array.from(new Set(rfis.map(r => r.assignee?.id))).filter(Boolean).map(id => {
                    const name = rfis.find(r => r.assignee?.id === id)?.assignee?.name;
                    return (
                      <TouchableOpacity
                        key={id}
                        onPress={() => { setAssigneeFilter(String(id)); setFilterModalVisible(false); }}
                        style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                          paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{name}</Text>
                        {assigneeFilter === String(id) && <Feather name="check" size={16} color={colors.primary} />}
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
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{isEditing ? t('projectRfi.editRfi') : t('projectRfi.newRfi')}</Text>
                    <TouchableOpacity onPress={() => { setCreateModalVisible(false); setIsEditing(false); }} disabled={submitting}>
                      <Feather name="x" size={24} color={colors.text} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ gap: 20 }}>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>{t('projectRfi.titleLabel')}</Text>
                        <TextInput
                          value={title}
                          onChangeText={setTitle}
                          placeholder={t('projectRfi.titlePlaceholder')}
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
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>{t('projectRfi.descriptionLabel')}</Text>
                        <TextInput
                          value={description}
                          onChangeText={setDescription}
                          placeholder={t('projectRfi.descriptionPlaceholder')}
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
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>{t('projectRfi.assignToLabel')}</Text>
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
                              ? assignees.find(a => a.id === assignedToId)?.name || t('projectRfi.selectAssignee')
                              : t('projectRfi.selectAssigneePlaceholder')}
                          </Text>
                          <Feather name="chevron-down" size={18} color={assignedToId ? colors.primary : colors.textMuted} />
                        </TouchableOpacity>
                      </View>

                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>{t('projectRfi.expiryDate')}</Text>
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
                            {expiryDate ? expiryDate.toLocaleString() : t('projectRfi.selectDate')}
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
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 12 }}>{t('projectRfi.photos')}</Text>
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
                          {selectedImageCount < MAX_RFI_IMAGES && (
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
                          )}
                        </View>
                        <View style={{ marginTop: 12 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 12 }}>{t('projectRfi.voiceNote')}</Text>
                          {selectedAudio ? (
                            <View style={{ position: 'relative', padding: 12, paddingRight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>{t('projectRfi.voiceNote')}</Text>
                              </View>

                              <VoiceNotePlayer uri={selectedAudio} isMe={false} colors={colors} playingUri={playingUri} onPlay={setPlayingUri} />
                              <TouchableOpacity
                                onPress={() => {
                                  if (isEditing && selectedRFI && selectedAudio.startsWith('http')) {
                                    const originalIdx = selectedRFI.photoDownloadUrls?.findIndex(url => url.split('?')[0] === selectedAudio.split('?')[0]);
                                    if (originalIdx !== undefined && originalIdx !== -1) {
                                      const keyToRemove = selectedRFI.photos?.[originalIdx];
                                      if (keyToRemove) setRemovedPhotos(prev => [...prev, keyToRemove]);
                                    }
                                  }
                                  setSelectedAudio(null);
                                }}
                                style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#ef4444', borderRadius: 10, padding: 3 }}
                              >
                                <Feather name="x" size={14} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <VoiceNoteRecorder
                              colors={colors}
                              onRecordingStateChange={() => { }}
                              onSend={(uri) => setSelectedAudio(uri)}
                            />
                          )}
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
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{isEditing ? t('projectRfi.saveChanges') : t('projectRfi.createRfi')}</Text>
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
                    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
                      <View style={{ flex: 1 }}>
                        {cameraPermission?.granted && cameraReady ? (
                          <>
                            <View style={{
                              width: SCREEN_W,
                              height: CAMERA_HEIGHT,
                              overflow: 'hidden',
                              marginTop: Math.max(insets.top, 20) + 60,
                            }}>
                              <GestureDetector gesture={pinchGesture}>
                                <View collapsable={false} style={StyleSheet.absoluteFill}>
                                  <CameraView
                                    ref={cameraRef}
                                    style={StyleSheet.absoluteFill}
                                    facing="back"
                                    ratio="4:3"
                                    zoom={cameraZoom}
                                  />
                                </View>
                              </GestureDetector>
                              {/* Dynamic Zoom Indicator */}
                              <Animated.View
                                pointerEvents="none"
                                style={[
                                  zoomLabelStyle,
                                  {
                                    position: 'absolute',
                                    bottom: 64,
                                    alignSelf: 'center',
                                    backgroundColor: 'rgba(0,0,0,0.55)',
                                    paddingHorizontal: 14,
                                    paddingVertical: 6,
                                    borderRadius: 20,
                                    zIndex: 30,
                                  }
                                ]}
                              >
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{zoomDisplay}</Text>
                              </Animated.View>
                              {/* Direct Zoom Buttons */}
                              <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 16, zIndex: 40 }}>
                                  {(Platform.OS === 'ios' ? [0.5, 1, 2] : [1, 2, 3]).map(factor => (
                                    <TouchableOpacity key={factor} onPress={() => handleManualZoom(factor)} style={{ backgroundColor: 'rgba(0,0,0,0.55)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{factor}x</Text>
                                    </TouchableOpacity>
                                  ))}
                              </View>
                            </View>

                            <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                              <TouchableOpacity onPress={() => setCameraVisible(false)} style={cameraStyles.headerBtn}>
                                <Feather name="x" size={24} color="#fff" />
                              </TouchableOpacity>
                              <Text style={cameraStyles.headerTitle}>{t('projectRfi.rfiPhotos')}</Text>

                              <View style={{ width: 60 }} />
                            </View>

                            <View style={[cameraStyles.controlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
                              <View style={cameraStyles.shutterRow}>
                                <TouchableOpacity onPress={pickImageFiles} style={cameraStyles.sideBtn}>
                                  <View style={cameraStyles.iconCircle}>
                                    <Feather name="image" size={24} color="#fff" />
                                  </View>
                                  <Text style={cameraStyles.btnLabel}>{t('projectRfi.gallery')}</Text>

                                </TouchableOpacity>

                                <TouchableOpacity onPress={capturePhoto} disabled={isCapturing} style={cameraStyles.shutterBtn}>
                                  <View style={cameraStyles.shutterOuter}>
                                    <View style={cameraStyles.shutterInner} />
                                  </View>
                                  <Text style={cameraStyles.btnLabel}>{t('projectRfi.photo')}</Text>

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
                                <Text style={{ color: '#fff', marginBottom: 20 }}>{t('projectRfi.cameraAccessNeeded')}</Text>
                                <TouchableOpacity onPress={requestCameraPermission} style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 10 }}>
                                  <Text style={{ color: '#fff', fontWeight: '700' }}>{t('projectRfi.continue')}</Text>
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
                    </GestureHandlerRootView>
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
                          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{t('projectRfi.assignToLabel')}</Text>
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
                            <GestureDetector gesture={pinchGesture}>
                              <View collapsable={false} style={StyleSheet.absoluteFill}>
                                <CameraView
                                  ref={cameraRef}
                                  style={StyleSheet.absoluteFill}
                                  facing="back"
                                  ratio="4:3"
                                  zoom={cameraZoom}
                                />
                              </View>
                            </GestureDetector>
                            {/* Dynamic Zoom Indicator */}
                            <Animated.View
                              pointerEvents="none"
                              style={[
                                zoomLabelStyle,
                                {
                                  position: 'absolute',
                                  bottom: 64,
                                  alignSelf: 'center',
                                  backgroundColor: 'rgba(0,0,0,0.55)',
                                  paddingHorizontal: 14,
                                  paddingVertical: 6,
                                  borderRadius: 20,
                                  zIndex: 30,
                                }
                              ]}
                            >
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{zoomDisplay}</Text>
                            </Animated.View>
                            {/* Direct Zoom Buttons */}
                            <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 16, zIndex: 40 }}>
                              {(Platform.OS === 'ios' ? [0.5, 1, 2] : [1, 2, 3]).map(factor => (
                                <TouchableOpacity
                                  key={factor}
                                  onPress={() => handleManualZoom(factor)}
                                  style={{ backgroundColor: 'rgba(0,0,0,0.55)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
                                >
                                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{factor}x</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                          {/* ... Header and Controls ... */}
                          <View style={[cameraStyles.headerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
                            <TouchableOpacity onPress={() => setCameraVisible(false)} style={cameraStyles.headerBtn}>
                              <Feather name="x" size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={cameraStyles.headerTitle}>{t('projectRfi.rfiPhotos')}</Text>

                            <View style={{ width: 60 }} />
                          </View>
                          <View style={[cameraStyles.controlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
                            <View style={cameraStyles.shutterRow}>
                              <TouchableOpacity onPress={pickImageFiles} style={cameraStyles.sideBtn}>
                                <View style={cameraStyles.iconCircle}>
                                  <Feather name="image" size={24} color="#fff" />
                                </View>
                                <Text style={cameraStyles.btnLabel}>{t('projectRfi.gallery')}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={capturePhoto} disabled={isCapturing} style={cameraStyles.shutterBtn}>
                                <View style={cameraStyles.shutterOuter}>
                                  <View style={cameraStyles.shutterInner} />
                                </View>
                                <Text style={cameraStyles.btnLabel}>{t('projectRfi.photo')}</Text>
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
