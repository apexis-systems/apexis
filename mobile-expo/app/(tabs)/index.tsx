import { View, Text, ScrollView, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StorageChart } from '@/components/home/StorageChart';
import { FolderCard } from '@/components/home/FolderCard';
import { FileItem } from '@/components/home/FileItem';
import { mockUser, mockFolders, mockRecentFiles } from '@/utils/mock';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
      {/* Header */}
      <View className="flex-row justify-between items-center px-6 pt-4 pb-6">
        <View className="flex-row items-center gap-3">
          <Image
            source={{ uri: mockUser.avatar }}
            className="w-12 h-12 rounded-full border-2 border-slate-800"
          />
          <View>
            <Text className="text-slate-400 text-sm">Good morning,</Text>
            <Text className="text-white text-lg font-bold">{mockUser.name}</Text>
          </View>
        </View>

        <TouchableOpacity className="w-12 h-12 bg-slate-900 rounded-full items-center justify-center border border-slate-800 relative">
          <MaterialCommunityIcons name="bell-outline" size={24} color="#CBD5E1" />
          <View className="absolute top-3 right-3 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }} // padding for bottom tabs
      >
        {/* Storage Overview */}
        <View className="px-6 mb-8">
          <StorageChart used={mockUser.storage.used} total={mockUser.storage.total} />
        </View>

        {/* Quick Access Folders */}
        <View className="mb-8">
          <View className="flex-row justify-between items-center px-6 mb-4">
            <Text className="text-white text-xl font-bold">Quick Access</Text>
            <TouchableOpacity>
              <Text className="text-indigo-400 font-medium">See All</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={mockFolders}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24 }}
            renderItem={({ item }) => (
              <FolderCard {...item} />
            )}
          />
        </View>

        {/* Recent Files */}
        <View className="px-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-white text-xl font-bold">Recent Files</Text>
            <TouchableOpacity className="flex-row items-center gap-1">
              <Text className="text-slate-400">Sort by</Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {mockRecentFiles.map((file) => (
            <FileItem key={file.id} {...file} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
