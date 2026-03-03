import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const ACCENT = '#f97316';
const INACTIVE = '#666666';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();

  // The RootLayoutNav handles redirection. We allow Tabs to render with empty or default placeholders momentarily.

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: INACTIVE,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          // Use safe area insets to sit above the Android system nav bar
          paddingBottom: Platform.OS === 'android' ? insets.bottom + 4 : 20,
          paddingTop: 8,
          height: Platform.OS === 'android' ? 60 + insets.bottom : 82,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          href: user?.role === 'client' ? null : '/(tabs)/scan',
          title: t('tabs.scan'),
          tabBarIcon: ({ color }) => <Feather name="maximize" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          href: user?.role === 'client' ? null : '/(tabs)/upload',
          title: t('tabs.upload'),
          tabBarIcon: () => <Feather name="plus" size={24} color="#fff" />,
          tabBarItemStyle: {
            marginTop: -12,
          },
          tabBarIconStyle: {
            backgroundColor: ACCENT,
            borderRadius: 28,
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '500',
            color: ACCENT,
            marginTop: 14,
          },
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: t('tabs.activity'),
          tabBarIcon: ({ color }) => <Feather name="clock" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
