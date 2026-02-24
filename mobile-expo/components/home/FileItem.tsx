import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface FileItemProps {
    name: string;
    size: string;
    type: string;
    date: string;
}

const getIconForType = (type: string) => {
    switch (type.toLowerCase()) {
        case 'pdf': return { name: 'file-pdf-box', color: '#EF4444', bg: 'bg-red-500/10' };
        case 'image': return { name: 'file-image-outline', color: '#3B82F6', bg: 'bg-blue-500/10' };
        case 'doc':
        case 'docx': return { name: 'file-word-outline', color: '#10B981', bg: 'bg-emerald-500/10' };
        case 'figma':
        case 'fig': return { name: 'draw-pen', color: '#F59E0B', bg: 'bg-amber-500/10' };
        case 'spreadsheet':
        case 'xlsx': return { name: 'file-excel-outline', color: '#10B981', bg: 'bg-emerald-500/10' };
        default: return { name: 'file-outline', color: '#94A3B8', bg: 'bg-slate-500/10' };
    }
};

export function FileItem({ name, size, type, date }: FileItemProps) {
    const iconData = getIconForType(type);

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            className="flex-row items-center p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-3"
        >
            <View className={`w-12 h-12 rounded-xl justify-center items-center mr-4 ${iconData.bg}`}>
                <MaterialCommunityIcons name={iconData.name as any} size={28} color={iconData.color} />
            </View>

            <View className="flex-1">
                <Text className="text-white font-medium text-base mb-1" numberOfLines={1}>{name}</Text>
                <Text className="text-slate-400 text-xs">{date} • {size}</Text>
            </View>

            <TouchableOpacity className="p-2">
                <MaterialCommunityIcons name="dots-vertical" size={20} color="#64748B" />
            </TouchableOpacity>
        </TouchableOpacity>
    );
}
