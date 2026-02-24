import { View, Text } from 'react-native';

interface StorageChartProps {
    used: number;
    total: number;
}

export function StorageChart({ used, total }: StorageChartProps) {
    const percentage = Math.round((used / total) * 100);

    return (
        <View className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800">
            <View className="flex-row justify-between items-center mb-6">
                <View>
                    <Text className="text-white text-3xl font-bold tracking-tight">{used} GB</Text>
                    <Text className="text-slate-400 text-sm mt-1">Used of {total} GB</Text>
                </View>
                <View className="bg-indigo-500/20 px-3 py-1.5 rounded-full">
                    <Text className="text-indigo-400 font-semibold">{percentage}% Used</Text>
                </View>
            </View>

            {/* Custom Progress Bar */}
            <View className="h-4 w-full bg-slate-800 rounded-full overflow-hidden relative">
                <View
                    className="h-full bg-indigo-500 rounded-full absolute left-0"
                    style={{ width: `${percentage}%` }}
                />
                {/* Adds a slight highlight effect to the progress bar */}
                <View
                    className="h-full bg-white/20 rounded-full absolute left-0"
                    style={{ width: `${percentage}%` }}
                />
            </View>

            <View className="flex-row justify-between mt-4">
                <View className="flex-row items-center gap-2">
                    <View className="w-3 h-3 rounded-full bg-indigo-500" />
                    <Text className="text-slate-300 text-xs">Used Space</Text>
                </View>
                <View className="flex-row items-center gap-2">
                    <View className="w-3 h-3 rounded-full bg-slate-700" />
                    <Text className="text-slate-300 text-xs">Free Space</Text>
                </View>
            </View>
        </View>
    );
}
