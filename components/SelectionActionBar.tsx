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
    style={[styles.position, { width: Math.min(width - 24, 610), opacity, transform: [{ translateY }] }]}>
    <View style={[styles.bar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, shadowColor: colors.ink }]}>
      <View style={[styles.count, { borderRightColor: colors.divider }]}>
        <Text numberOfLines={1} style={[styles.countText, { color: colors.ink }]}>{selectedCount} seçili</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={width < 500} contentContainerStyle={styles.actions}>
        {actions.map(action => {
          const Icon = action.icon;
          const tint = action.disabled ? colors.muted : action.danger ? '#D94B52' : colors.accent;
          return <Pressable key={action.key} accessibilityRole="button" accessibilityLabel={action.label}
            disabled={action.disabled} onPress={action.onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed, action.disabled && styles.disabled]}>
            <Icon size={18} color={tint} strokeWidth={2} />
            <Text numberOfLines={1} style={[styles.label, { color: action.danger ? '#D94B52' : colors.ink }]}>{action.label}</Text>
          </Pressable>;
        })}
      </ScrollView>
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  position: { position: 'absolute', zIndex: 30, bottom: 9, alignSelf: 'center' },
  bar: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 7, paddingVertical: 6, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.13, shadowRadius: 14, elevation: 8 },
  count: { minWidth: 60, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderRightWidth: StyleSheet.hairlineWidth },
  countText: { fontFamily: fonts.semibold, fontSize: 10.5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  action: { minWidth: 54, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 5, borderRadius: 12 },
  label: { fontFamily: fonts.medium, fontSize: 9.5 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
});
