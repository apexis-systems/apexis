import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';

export default function SettingsScreen() {
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [faceIdEnabled, setFaceIdEnabled] = useState(false);

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center px-6 pt-4 pb-6 border-b border-slate-900">
                <Text className="text-white text-2xl font-bold">Settings</Text>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="p-6">

                    <SettingsSection title="Preferences">
                        <ToggleOption
                            icon="theme-light-dark"
                            title="Dark Mode"
                            value={isDarkMode}
                            onValueChange={setIsDarkMode}
                        />
                        <ToggleOption
                            icon="bell-ring-outline"
                            title="Push Notifications"
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                        />
                        <MenuOption icon="earth" title="Language" value="English" isLast />
                    </SettingsSection>

                    <SettingsSection title="Security">
                        <ToggleOption
                            icon="face-recognition"
                            title="Face ID Authentication"
                            value={faceIdEnabled}
                            onValueChange={setFaceIdEnabled}
                        />
                        <MenuOption icon="key-outline" title="Change Password" />
                        <MenuOption icon="cellphone-key" title="Two-Factor Authentication" isLast />
                    </SettingsSection>

                    <SettingsSection title="Storage & Data">
                        <MenuOption icon="cloud-download-outline" title="Offload Unused Files" />
                        <MenuOption icon="wifi" title="Cellular Data Usage" />
                        <MenuOption icon="delete-empty-outline" title="Clear Cache" value="124 MB" isLast />
                    </SettingsSection>

                    <SettingsSection title="About">
                        <MenuOption icon="information-outline" title="App Version" value="v2.4.1" />
                        <MenuOption icon="file-document-outline" title="Terms of Service" />
                        <MenuOption icon="shield-check-outline" title="Privacy Policy" isLast />
                    </SettingsSection>

                    <View className="mb-12 mt-4 items-center">
                        <Text className="text-slate-600 text-sm">Made with ❤️ by Rhinon Tech</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function SettingsSection({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <View className="mb-8">
            <Text className="text-slate-400 font-semibold uppercase text-xs tracking-wider mb-3 ml-2">
                {title}
            </Text>
            <View className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800">
                {children}
            </View>
        </View>
    );
}

function MenuOption({ icon, title, value, isLast = false }: { icon: any, title: string, value?: string, isLast?: boolean }) {
    return (
        <TouchableOpacity className={`flex-row items-center justify-between p-4 px-5 bg-slate-900 ${!isLast ? 'border-b border-slate-800' : ''}`}>
            <View className="flex-row items-center gap-4">
                <View className="w-10 h-10 bg-slate-800 rounded-full items-center justify-center">
                    <MaterialCommunityIcons name={icon} size={20} color="#94A3B8" />
                </View>
                <Text className="text-white text-base font-medium">{title}</Text>
            </View>
            <View className="flex-row items-center gap-2">
                {value && <Text className="text-slate-400 text-sm">{value}</Text>}
                <MaterialCommunityIcons name="chevron-right" size={24} color="#475569" />
            </View>
        </TouchableOpacity>
    );
}

function ToggleOption({ icon, title, value, onValueChange, isLast = false }: { icon: any, title: string, value: boolean, onValueChange: (val: boolean) => void, isLast?: boolean }) {
    return (
        <View className={`flex-row items-center justify-between p-4 px-5 bg-slate-900 ${!isLast ? 'border-b border-slate-800' : ''}`}>
            <View className="flex-row items-center gap-4">
                <View className="w-10 h-10 bg-slate-800 rounded-full items-center justify-center">
                    <MaterialCommunityIcons name={icon} size={20} color="#94A3B8" />
                </View>
                <Text className="text-white text-base font-medium">{title}</Text>
            </View>
            <Switch
                trackColor={{ false: '#334155', true: '#4F46E5' }}
                thumbColor={'#fff'}
                ios_backgroundColor="#334155"
                onValueChange={onValueChange}
                value={value}
            />
        </View>
    );
}
