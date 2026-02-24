import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface FolderCardProps {
    name: string;
    filesCount: number;
    size: string;
    color: string;
}

export function FolderCard({ name, filesCount, size, color }: FolderCardProps) {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            className={`w-36 h-36 ${color} rounded-[24px] p-4 mr-4 shadow-md overflow-hidden relative justify-between`}
        >
            {/* Decorative background element overlay */}
            <View className="absolute top-[-20] right-[-20] w-24 h-24 bg-white/20 rounded-full blur-xl" />

            <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center">
                <MaterialCommunityIcons name="folder-outline" size={24} color="white" />
            </View>

            <View>
                <Text className="text-white font-bold text-lg mb-1" numberOfLines={1}>{name}</Text>
                <Text className="text-white/80 text-xs">{filesCount} files • {size}</Text>
            </View>
        </TouchableOpacity>
    );
}
