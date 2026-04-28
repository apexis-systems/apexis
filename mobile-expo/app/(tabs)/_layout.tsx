import { Tabs } from 'expo-router';
import { Platform, View, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocket } from '@/contexts/SocketContext';
import { useTranslation } from 'react-i18next';
import { useTour } from '@/contexts/TourContext';
import { useRef, useEffect } from 'react';

const INACTIVE = '#666666';

// Component to handle tab bar icon spotlights
const TabBarIcon = ({ name, color, spotlightId, size = 22 }: any) => {
  const { registerSpotlight, isTourActive } = useTour();
  const ref = useRef<View>(null);

  useEffect(() => {
    if (isTourActive) {
      const timer = setTimeout(() => {
        ref.current?.measureInWindow((x, y, w, h) => {
          if (w > 0) {
            const androidStatusBarOffset = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
            registerSpotlight(spotlightId, { x: x + w / 2, y: y + h / 2 + androidStatusBarOffset, r: 40 });
          }
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isTourActive, spotlightId, registerSpotlight]);

  return (
    <View ref={ref}>
      <Feather name={name} size={size} color={color} />
    </View>
  );
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { unreadNotificationCount, unreadChatCount } = useSocket();
  const { t } = useTranslation();

  // Redirection is handled by RootLayoutNav. We safely render Tabs if user exists,
  // or a fallback to avoid hook count mismatch.
  if (!user) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
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
          fontFamily: 'Montserrat', // or Montserrat-Medium if they prefer
          fontSize: 9,
          // Removed fontWeight: '500' to prevent Android fallback
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
        name="activity"
        options={{
          title: t('tabs.activity') || 'Activity',
          tabBarIcon: ({ color }) => <TabBarIcon name="clock" color={color} spotlightId="activityTab" />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          href: user?.role === 'client' ? null : '/(tabs)/upload',
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => <Feather name="plus" size={24} color="#fff" />,
          tabBarItemStyle: {
            // Remove margin here to handle it in icon style
          },
          tabBarIconStyle: {
            backgroundColor: colors.primary,
            borderRadius: 28,
            width: 56,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -30, // Float upwards
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
            elevation: 5,
          },
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: user?.role === 'superadmin' ? null : '/(tabs)/chat',
          title: t('tabs.chat'),
          tabBarIcon: ({ color }) => <TabBarIcon name="message-circle" color={color} spotlightId="chatTab" />,
          tabBarBadge: unreadChatCount > 0 ? unreadChatCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: 'Notifications',
          tabBarIcon: ({ color }) => <Feather name="bell" size={22} color={color} />,
          tabBarBadge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => <TabBarIcon name="settings" color={color} spotlightId="settingsTab" />,
        }}
      />
      <Tabs.Screen
        name="project/[id]"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="project/snag-create"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="linked-devices"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="change-password"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="company-settings"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="trash"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
