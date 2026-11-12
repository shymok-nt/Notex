import { Pressable, StyleSheet, Text, View } from 'react-native';

export type NoteListItemProps = {
  title: string;
  subtitle?: string;
  onPress: () => void;
};

export function NoteListItem({ title, subtitle, onPress }: NoteListItemProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <View style={styles.icon}><Text style={styles.iconText}>✎</Text></View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', marginBottom: 12 },
  pressed: { opacity: 0.7 },
  icon: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#EEF0FF', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 26, color: '#5659D8' },
  content: { flex: 1, marginLeft: 14 },
  title: { fontSize: 16, fontWeight: '600', color: '#202238' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#777C90' },
  chevron: { fontSize: 28, color: '#9DA1B4' },
});
