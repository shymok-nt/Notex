import { Tabs } from 'expo-router';
import { BookOpen, Home, Search } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/fonts';

export default function TabLayout() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: scheme === 'light' ? '#2F4BFF' : colors.accent,
    tabBarInactiveTintColor: scheme === 'light' ? '#9AA0B6' : colors.muted,
    tabBarStyle: { height: 58 + insets.bottom, backgroundColor: scheme === 'light' ? '#F4F5F9' : colors.surfaceRaised, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: scheme === 'light' ? '#E3E5EE' : colors.divider, paddingTop: 5, paddingBottom: Math.max(insets.bottom, 5) },
    tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, marginTop: 1 },
    tabBarItemStyle: { flex: 1 },
    tabBarButton: ({ ref: _ref, ...props }) => <Pressable {...props} android_ripple={{ color: 'transparent' }} />,
  }}>
    <Tabs.Screen name="index" options={{ title: 'Ana sayfa', tabBarIcon: ({ color }) => <Home size={21} color={color}/> }}/>
    <Tabs.Screen name="notebooks" options={{ title: 'Defterler', tabBarIcon: ({ color }) => <BookOpen size={21} color={color}/> }}/>
    <Tabs.Screen name="search" options={{ title: 'Ara', tabBarIcon: ({ color }) => <Search size={21} color={color}/> }}/>
    <Tabs.Screen name="folders" options={{ href: null }}/>
    <Tabs.Screen name="favorites" options={{ href: null }}/>
  </Tabs>;
}
