import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ButtonText } from '@/components/ui/button';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
    const router = useRouter();

    const handleFinish = () => {
        // Navigate to the main tabs, replacing the current route
        router.replace('/(tabs)');
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-950 px-6 pt-12 pb-6 flex-col">
            <View className="flex-1 justify-center items-center">
                {/* Abstract Premium Graphic Placeholder */}
                <View className="w-64 h-64 rounded-full bg-indigo-500/20 items-center justify-center mb-10 overflow-hidden relative">
                    <View className="w-48 h-48 rounded-full bg-indigo-500/40 blur-3xl absolute top-0 -left-10" />
                    <View className="w-48 h-48 rounded-full bg-purple-500/40 blur-3xl absolute bottom-0 -right-10" />
                    {/* Simple icon representation */}
                    <View className="w-24 h-24 bg-white/10 rounded-2xl border border-white/20 items-center justify-center backdrop-blur-md">
                        <Text className="text-4xl">📁</Text>
                    </View>
                </View>

                <Text className="text-5xl font-extrabold text-white mb-4 text-center tracking-tight">
                    File Storage{'\n'}
                    <Text className="text-indigo-400">Simplified.</Text>
                </Text>

                <Text className="text-lg text-slate-400 text-center px-4 leading-7">
                    Securely store, organize, and share all your important files in one beautiful place.
                </Text>
            </View>

            <View className="w-full pb-8">
                <Button
                    onPress={handleFinish}
                    size="xl"
                    className="w-full bg-indigo-600 rounded-2xl h-16 shadow-lg shadow-indigo-500/30"
                >
                    <ButtonText className="font-bold text-white text-lg">Get Started</ButtonText>
                </Button>
            </View>
        </SafeAreaView>
    );
}
