import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Modal,
  Image,
  Dimensions,
  PanResponder,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { captureRef } from 'react-native-view-shot';

interface Props {
  uri: string;
  onSave: (newUri: string) => void;
  onCancel: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageAnnotator({ uri, onSave, onCancel }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [paths, setPaths] = useState<{ d: string; color: string }[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#ef4444');
  const [imageSize, setImageSize] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 160 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const viewShotRef = useRef<any>(null);
  const currentPathRef = useRef<string>('');
  const lastPoint = useRef({ x: 0, y: 0 });
  const selectedColorRef = useRef<string>('#ef4444');

  React.useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);

  React.useEffect(() => {
    if (!uri) return;
    Image.getSize(uri, (w, h) => {
      if (!w || !h) return;
      const headerHeight = 60 + insets.top;
      const footerHeight = 120;
      const margin = 40;
      const availableHeight = SCREEN_HEIGHT - (headerHeight + footerHeight + margin);
      const ratio = Math.min(SCREEN_WIDTH / w, availableHeight / h) || 1;
      setImageSize({ width: w * ratio, height: h * ratio });
    }, (err) => {
      console.warn('Failed to get image size in annotator:', err);
      const headerHeight = 60 + insets.top;
      setImageSize({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT - (headerHeight + 160) });
    });
  }, [uri, insets.top]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const startPath = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        currentPathRef.current = startPath;
        setCurrentPath(startPath);
        lastPoint.current = { x: locationX, y: locationY };
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (!currentPathRef.current) return;
        
        // Smoothness: only add point if it moved enough
        const dx = Math.abs(locationX - lastPoint.current.x);
        const dy = Math.abs(locationY - lastPoint.current.y);
        if (dx < 0.5 && dy < 0.5) return;
        
        const newSegment = ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        currentPathRef.current += newSegment;
        setCurrentPath(currentPathRef.current);
        lastPoint.current = { x: locationX, y: locationY };
      },
      onPanResponderRelease: (evt) => {
        if (!currentPathRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const finalPath = `${currentPathRef.current} L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setPaths((prev) => [...prev, { d: finalPath, color: selectedColorRef.current }]);
        currentPathRef.current = '';
        setCurrentPath('');
      },
    })
  ).current;

  const handleUndo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const handleSave = async () => {
    if (!viewShotRef.current) return;
    setSaving(true);
    try {
      const resultUri = await captureRef(viewShotRef.current, {
        format: 'jpg',
        quality: 0.9,
      });
      onSave(resultUri);
    } catch (err) {
      console.error('Failed to capture annotation:', err);
      Alert.alert('Error', 'Failed to save annotations. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal 
      visible 
      transparent={false} 
      animationType="slide" 
      presentationStyle="overFullScreen"
      statusBarTranslucent 
      onRequestClose={onCancel}
    >
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <View style={[styles.header, { 
          paddingTop: insets.top,
          height: 60 + insets.top,
        }]}>
          <TouchableOpacity 
            onPress={() => {
              if (paths.length > 0) {
                Alert.alert('Discard Edits?', 'Are you sure you want to discard your annotations?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Discard', style: 'destructive', onPress: onCancel }
                ]);
              } else {
                onCancel();
              }
            }} 
            style={styles.btn}
          >
            <Feather name="x" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Edit Photo</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowColorPicker(!showColorPicker)} style={[styles.btn, showColorPicker && { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }]}>
              <Feather name="edit-3" size={22} color={selectedColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleUndo} style={styles.btn} disabled={paths.length === 0}>
              <Feather name="rotate-ccw" size={22} color={paths.length > 0 ? "#fff" : "#555"} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleSave} 
              style={[styles.btn, { backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 20 }]}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Done</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.canvasContainer}>
          <View
            ref={viewShotRef}
            collapsable={false}
            style={{ 
              width: imageSize.width, 
              height: imageSize.height,
              backgroundColor: '#000',
              overflow: 'hidden'
            }}
            {...panResponder.panHandlers}
          >
            <Image
              source={{ uri }}
              style={{ width: imageSize.width, height: imageSize.height, position: 'absolute' }}
              resizeMode="contain"
            />
            <Svg 
              width={imageSize.width} 
              height={imageSize.height} 
              style={{ position: 'absolute' }}
              pointerEvents="none"
            >
              {paths.map((p, i) => (
                <Path key={i} d={p.d} stroke={p.color} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {currentPath ? (
                <Path d={currentPath} stroke={selectedColor} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </Svg>
          </View>
        </View>

        {showColorPicker && (
          <View style={styles.footer}>
            <View style={styles.colorPicker}>
              {['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ffffff', '#a855f7'].map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => {
                    setSelectedColor(color);
                    setShowColorPicker(false);
                  }}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorSelected
                  ]}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  btn: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingBottom: 30
  },
  colorPicker: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  colorSelected: {
    borderColor: '#fff',
    borderWidth: 3,
    transform: [{ scale: 1.2 }],
  },
});
