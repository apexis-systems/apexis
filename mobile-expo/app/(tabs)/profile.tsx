import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { mockUser } from '@/utils/mock';
import { StorageChart } from '@/components/home/StorageChart';
import { Button, ButtonText } from '@/components/ui/button';

export default function ProfileScreen() {
    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
            {/* Header */}
            <View className="flex-row justify-between items-center px-6 pt-4 pb-4 border-b border-slate-900">
                <Text className="text-white text-2xl font-bold">Profile</Text>
                <TouchableOpacity className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center border border-slate-800">
                    <MaterialCommunityIcons name="cog-outline" size={20} color="#CBD5E1" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* User Card */}
                <View className="items-center mt-8 mb-6">
                    <View className="relative mb-4">
                        <Image
                            source={{ uri: mockUser.avatar }}
                            className="w-28 h-28 rounded-full border-4 border-slate-800"
                        />
                        <TouchableOpacity className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-500 rounded-full items-center justify-center border-2 border-slate-950">
                            <MaterialCommunityIcons name="pencil" size={16} color="white" />
                        </TouchableOpacity>
                    </View>

                    <Text className="text-white text-2xl font-bold mb-1">{mockUser.name}</Text>
                    <Text className="text-slate-400 text-base">{mockUser.email}</Text>

                    <View className="bg-indigo-500/20 px-4 py-1.5 rounded-full mt-3 border border-indigo-500/30">
                        <Text className="text-indigo-400 font-bold uppercase tracking-widest text-xs">
                            {mockUser.tier}
                        </Text>
                    </View>
                </View>

                {/* Storage Quick View */}
                <View className="px-6 mb-8 mt-2">
                    <Text className="text-white text-lg font-bold mb-4">Storage Plan</Text>
                    <StorageChart used={mockUser.storage.used} total={mockUser.storage.total} />
                    <Button
                        size="md"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl mt-4 h-12"
                    >
                        <ButtonText className="font-semibold text-white">Upgrade Plan</ButtonText>
                    </Button>
                </View>

                {/* Quick Links Menu */}
                <View className="px-6 mb-12">
                    <Text className="text-slate-400 font-semibold uppercase text-xs tracking-wider mb-4 px-2">
                        Account Settings
                    </Text>

                    <View className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800">
                        <MenuOption icon="shield-check-outline" title="Security & Privacy" />
                        <MenuOption icon="credit-card-outline" title="Billing Details" />
                        <MenuOption icon="devices" title="Connected Devices" />
                        <MenuOption icon="history" title="Activity Log" isLast />
                    </View>

                    <TouchableOpacity className="items-center mt-8 py-4">
                        <Text className="text-rose-500 font-bold">Log Out</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

function MenuOption({ icon, title, isLast = false }: { icon: any, title: string, isLast?: boolean }) {
    return (
        <TouchableOpacity className={`flex-row items-center justify-between p-4 px-5 ${!isLast ? 'border-b border-slate-800' : ''}`}>
            <View className="flex-row items-center gap-4">
                <View className="w-10 h-10 bg-slate-800 rounded-full items-center justify-center">
                    <MaterialCommunityIcons name={icon} size={20} color="#94A3B8" />
                </View>
                <Text className="text-white text-base font-medium">{title}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#475569" />
        </TouchableOpacity>
    );
}
