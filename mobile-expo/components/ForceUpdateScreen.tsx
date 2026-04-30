import { View, Text, TouchableOpacity, Linking, Platform, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ForceUpdateScreenProps {
    minVersion: string;
    currentVersion: string;
    androidStoreUrl: string;
    iosStoreUrl: string;
}

const ForceUpdateScreen: React.FC<ForceUpdateScreenProps> = ({
    minVersion,
    currentVersion,
    androidStoreUrl,
    iosStoreUrl
}) => {
    const handleUpdate = () => {
        const storeUrl = Platform.OS === 'ios' ? iosStoreUrl : androidStoreUrl;
        Linking.openURL(storeUrl).catch(err => console.error("Couldn't load page", err));
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar style="dark" />
            
            <View className="flex-1 px-8 justify-center items-center">
                <Animated.View 
                    entering={FadeInUp.delay(200).duration(1000)}
                    className="items-center w-full"
                >
                    <View style={{ alignItems: 'center', marginBottom: 30 }}>
                        <Image source={require('../assets/images/app-icon.png')} style={{ width: 120, height: 120, marginBottom: 20 }} resizeMode="contain" />
                        <Text style={{ fontSize: 40, color: '#f97316', fontFamily: 'Angelica', fontWeight: 'normal' }}>
                            APEXIS
                            <Text style={{ fontSize: 22, fontFamily: 'Angelica', fontWeight: 'normal' }}>PRO™</Text>
                        </Text>
                    </View>
                    
                    <Text className="text-3xl font-bold text-slate-900 text-center mb-4">
                        Update Required
                    </Text>
                    
                    <Text className="text-slate-500 text-center text-lg leading-6 mb-8">
                        To continue using APEXISpro, please update to the latest version. This ensures you have the latest security fixes and features.
                    </Text>
                </Animated.View>

                <Animated.View 
                    entering={FadeInDown.delay(400).duration(1000)}
                    className="w-full"
                >
                    <TouchableOpacity 
                        onPress={handleUpdate}
                        activeOpacity={0.8}
                        className="w-full bg-[#f97316] py-4 rounded-2xl items-center shadow-lg shadow-orange-200 mb-8"
                    >
                        <Text className="text-white text-xl font-bold">Update Now</Text>
                    </TouchableOpacity>

                    <View className="flex-row justify-between px-6">
                        <View className="items-center">
                            <Text className="text-slate-400 text-xs uppercase tracking-widest mb-1">Current</Text>
                            <Text className="text-slate-600 font-semibold">{currentVersion}</Text>
                        </View>
                        <View className="items-center">
                            <Text className="text-slate-400 text-xs uppercase tracking-widest mb-1">Required</Text>
                            <Text className="text-[#f97316] font-semibold">{minVersion}</Text>
                        </View>
                    </View>
                </Animated.View>
            </View>

            <View className="items-center pb-4">
                <Text className="text-slate-400 text-xs tracking-wider">
                    Apexis Systems Pvt Ltd &copy; {new Date().getFullYear()}
                </Text>
            </View>
        </SafeAreaView>
    );
};

export default ForceUpdateScreen;
