import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const [projects, setProjects] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', start_date: '', end_date: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      const res = await PrivateAxios.get('/projects');
      setProjects(res.data.projects || []);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  const totalDocs = projects.reduce((sum, p) => sum + (p.totalDocs || 0), 0);
  const totalPhotos = projects.reduce((sum, p) => sum + (p.totalPhotos || 0), 0);

  const handleCreate = async () => {
    if (!newProject.name || !newProject.start_date || !newProject.end_date) return;
    setIsSubmitting(true);
    try {
      await PrivateAxios.post('/projects', newProject);
      setIsCreating(false);
      setNewProject({ name: '', description: '', start_date: '', end_date: '' });
      fetchProjects();
    } catch (e) {
      console.error("Failed to create project:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleSubtitle =
    user.role === 'admin'
      ? 'Manage all your projects'
      : user.role === 'contributor'
        ? 'Your assigned projects'
        : 'Your shared projects';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0d0d' }}>
      {/* Top Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#2a2a2a',
          backgroundColor: '#111111',
        }}
      >
        <TouchableOpacity
          onPress={() => router.push('/(tabs)')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: '#f97316',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>A</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Apexis</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {user.role === 'admin' && (
            <TouchableOpacity onPress={() => setIsCreating(true)} style={{ padding: 8, borderRadius: 20 }}>
              <Feather name="plus-circle" size={18} color="#f97316" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={{ padding: 8, borderRadius: 20 }}>
            <Feather name="search" size={18} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 8, borderRadius: 20 }}>
            <Feather name="bell" size={18} color="#888" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
        {/* Greeting Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: '#1e1e1e',
              borderWidth: 1,
              borderColor: '#2a2a2a',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 10, color: '#888' }}>Logo</Text>
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
              Hi, {user.name.split(' ')[0]} 👋
            </Text>
            <Text style={{ fontSize: 11, color: '#888' }}>{roleSubtitle}</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Projects', value: projects.length },
            { label: 'Documents', value: totalDocs },
            { label: 'Photos', value: totalPhotos },
          ].map((stat) => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                borderRadius: 10,
                backgroundColor: '#111111',
                borderWidth: 1,
                borderColor: '#2a2a2a',
                padding: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>{stat.value}</Text>
              <Text style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Section label */}
        <Text style={{ fontSize: 11, fontWeight: '500', color: '#888', marginBottom: 10 }}>
          Your Projects
        </Text>

        {/* Project Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {projects.map((project) => (
            <TouchableOpacity
              key={project.id}
              onPress={() => router.push(`/project/${project.id}`)}
              style={{ width: '22%', alignItems: 'center', gap: 4 }}
            >
              {/* Thumbnail */}
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: project.color || '#f97316',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: '#2a2a2a',
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
                  {project.name ? project.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
              {/* Name */}
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 10,
                  fontWeight: '500',
                  color: '#fff',
                  textAlign: 'center',
                  lineHeight: 13,
                }}
              >
                {project.name.split(' ').slice(0, 2).join(' ')}
              </Text>
              {/* Stats */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Feather name="file-text" size={9} color="#888" />
                  <Text style={{ fontSize: 9, color: '#888' }}>{project.totalDocs || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Feather name="camera" size={9} color="#888" />
                  <Text style={{ fontSize: 9, color: '#888' }}>{project.totalPhotos || 0}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {projects.length === 0 && (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#888' }}>No projects available</Text>
          </View>
        )}
      </ScrollView>
      {/* Create Project Modal */}
      <Modal visible={isCreating} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#111', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#333' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16 }}>Create New Project</Text>

            <Text style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Project Name</Text>
            <TextInput
              style={{ backgroundColor: '#222', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 }}
              placeholder="E.g. Alpha Tower"
              placeholderTextColor="#555"
              value={newProject.name}
              onChangeText={(text) => setNewProject({ ...newProject, name: text })}
            />

            <Text style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Description</Text>
            <TextInput
              style={{ backgroundColor: '#222', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 }}
              placeholder="Short description"
              placeholderTextColor="#555"
              value={newProject.description}
              onChangeText={(text) => setNewProject({ ...newProject, description: text })}
            />

            <Text style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Start Date (YYYY-MM-DD)</Text>
            <TouchableOpacity
              style={{ backgroundColor: '#222', padding: 12, borderRadius: 8, marginBottom: 12 }}
              onPress={() => setShowStartPicker(true)}
            >
              <Text style={{ color: newProject.start_date ? '#fff' : '#555' }}>
                {newProject.start_date || 'Select Start Date'}
              </Text>
            </TouchableOpacity>

            {showStartPicker && (
              <DateTimePicker
                value={newProject.start_date ? new Date(newProject.start_date) : new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowStartPicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setNewProject({ ...newProject, start_date: selectedDate.toISOString().split('T')[0] });
                  }
                }}
              />
            )}

            <Text style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>End Date (YYYY-MM-DD)</Text>
            <TouchableOpacity
              style={{ backgroundColor: '#222', padding: 12, borderRadius: 8, marginBottom: 20 }}
              onPress={() => setShowEndPicker(true)}
            >
              <Text style={{ color: newProject.end_date ? '#fff' : '#555' }}>
                {newProject.end_date || 'Select End Date'}
              </Text>
            </TouchableOpacity>

            {showEndPicker && (
              <DateTimePicker
                value={newProject.end_date ? new Date(newProject.end_date) : new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowEndPicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setNewProject({ ...newProject, end_date: selectedDate.toISOString().split('T')[0] });
                  }
                }}
              />
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setIsCreating(false)} style={{ padding: 12 }}>
                <Text style={{ color: '#888', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                disabled={isSubmitting}
                style={{ backgroundColor: '#f97316', padding: 12, borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' }}
              >
                {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
