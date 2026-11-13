import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/fonts';

export type SelectionAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export function SelectionActionBar({ visible, selectedCount, actions }: {
  visible: boolean;
  selectedCount: number;
  actions: SelectionAction[];
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: visible ? 160 : 110, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: visible ? 0 : 9, duration: visible ? 160 : 110, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, visible]);

  return <Animated.View pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible}
    style={[styles.position, { width: Math.min(width - 32, 760), opacity, transform: [{ translateY }] }]}>
    <View style={[styles.bar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, shadowColor: colors.ink }]}>
      <View style={[styles.count, { borderRightColor: colors.divider }]}>
        <Text numberOfLines={1} style={[styles.countText, { color: colors.ink }]}>{selectedCount} seçili</Text>
      </View>
      <ScrollView style={styles.actionsScroll} horizontal showsHorizontalScrollIndicator={width < 500} contentContainerStyle={[styles.actions, { minWidth: Math.min(width - 32, 760) - 116 }]}>
        {actions.map(action => {
          const Icon = action.icon;
          const tint = action.disabled ? colors.muted : action.danger ? '#D94B52' : colors.accent;
          return <Pressable key={action.key} accessibilityRole="button" accessibilityLabel={action.label}
            disabled={action.disabled} onPress={action.onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed, action.disabled && styles.disabled]}>
            <Icon size={22} color={tint} strokeWidth={2} />
            <Text numberOfLines={1} style={[styles.label, { color: action.danger ? '#D94B52' : colors.ink }]}>{action.label}</Text>
          </Pressable>;
        })}
      </ScrollView>
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  position: { position: 'absolute', zIndex: 30, bottom: 9, alignSelf: 'center' },
  bar: { minHeight: 80, flexDirection: 'row', alignItems: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 9, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.13, shadowRadius: 14, elevation: 8 },
  count: { width: 94, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRightWidth: StyleSheet.hairlineWidth },
  countText: { fontFamily: fonts.semibold, fontSize: 13 },
  actionsScroll: { flex: 1 },
  actions: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', gap: 8, paddingHorizontal: 10 },
  action: { minWidth: 92, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 14 },
  label: { fontFamily: fonts.medium, fontSize: 12 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
});
