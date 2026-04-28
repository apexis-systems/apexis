import React, { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, BackHandler } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getProjects, restoreProject, deleteProject } from '@/services/projectService';
import { Text } from '@/components/ui/AppText';

export default function TrashScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchTrash();

      const onBackPress = () => {
        router.push('/settings');
        return true; // Prevent default behavior
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const fetchTrash = async () => {
    try {
      const data = await getProjects(undefined, true);
      setProjects(data.projects || []);
    } catch (e) {
      console.error('Failed to fetch trash', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrash();
  };

  const handleRestore = async (projectId: string) => {
    try {
      setIsRestoring(projectId);
      await restoreProject(projectId);
      Alert.alert('Success', 'Project restored successfully');
      fetchTrash();
    } catch (e) {
      Alert.alert('Error', 'Failed to restore project');
    } finally {
      setIsRestoring(null);
    }
  };

  const handlePermanentDelete = (projectId: string) => {
    Alert.alert(
      'Permanent Delete',
      'Are you sure? This will permanently delete ALL project data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(projectId);
              await deleteProject(projectId, true);
              Alert.alert('Success', 'Project permanently deleted');
              fetchTrash();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete project');
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
      <View style={{ paddingTop: 20, paddingHorizontal: 24, marginBottom: 30 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>Trash Management</Text>
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
        ) : projects.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 100 }}>
            <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Feather name="trash-2" size={40} color={colors.textMuted} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Trash is Empty</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 }}>
              Deleted projects will be saved here for 30 days before being automatically purged.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {projects.map((project) => (
              <View key={project.id} style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.border, position: 'relative', overflow: 'hidden' }}>
                {/* Days Remaining Badge */}
                <View style={{ 
                  position: 'absolute', 
                  top: 0, 
                  right: 0, 
                  backgroundColor: project.daysRemaining <= 5 ? '#ef4444' : '#f59e0b', 
                  paddingHorizontal: 12, 
                  paddingVertical: 4, 
                  borderBottomLeftRadius: 16 
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>
                    {project.daysRemaining} {project.daysRemaining === 1 ? 'DAY' : 'DAYS'} LEFT
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }} numberOfLines={1}>{project.name}</Text>
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }} numberOfLines={2}>{project.description || 'No description'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textMuted }}>CONT: {project.contributor_code}</Text>
                    </View>
                    <View style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textMuted }}>CLNT: {project.client_code}</Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="file-text" size={14} color={colors.textMuted} />
                      <Text style={{ fontSize: 13, color: colors.textMuted }}><Text style={{ fontWeight: '700', color: colors.text }}>{project.totalDocs || 0}</Text> Documents</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="camera" size={14} color={colors.textMuted} />
                      <Text style={{ fontSize: 13, color: colors.textMuted }}><Text style={{ fontWeight: '700', color: colors.text }}>{project.totalPhotos || 0}</Text> Photos</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>
                    {new Date(project.deletedAt).toLocaleDateString()}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                  <TouchableOpacity
                    onPress={() => handleRestore(project.id)}
                    disabled={isRestoring === project.id}
                    style={{ flex: 1, height: 48, borderRadius: 16, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                  >
                    {isRestoring === project.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="rotate-ccw" size={18} color={colors.primary} />}
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>Restore</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handlePermanentDelete(project.id)}
                    disabled={isDeleting === project.id}
                    style={{ flex: 1, height: 48, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                  >
                    {isDeleting === project.id ? <ActivityIndicator size="small" color="#ef4444" /> : <Feather name="trash-2" size={18} color="#ef4444" />}
                    <Text style={{ fontSize: 15, fontWeight: '700', color: "#ef4444" }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
