import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { mockProjects } from '@/data/mock';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const filteredProjects = mockProjects.filter((project) => {
    if (user.role === 'admin') return true;
    if (user.role === 'contributor') return project.assignedTo.includes(user.id);
    if (user.role === 'client') return project.sharedWith.includes(user.id);
    return false;
  });

  const totalDocs = filteredProjects.reduce((sum, p) => sum + p.totalDocs, 0);
  const totalPhotos = filteredProjects.reduce((sum, p) => sum + p.totalPhotos, 0);

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
            { label: 'Projects', value: filteredProjects.length },
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
          {filteredProjects.map((project) => (
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
                  backgroundColor: project.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: '#2a2a2a',
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
                  {project.name.charAt(0)}
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
                  <Text style={{ fontSize: 9, color: '#888' }}>{project.totalDocs}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Feather name="camera" size={9} color="#888" />
                  <Text style={{ fontSize: 9, color: '#888' }}>{project.totalPhotos}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {filteredProjects.length === 0 && (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#888' }}>No projects available</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
