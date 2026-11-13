import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';

export function NotebookSelectionMark() {
  return <View pointerEvents="none" style={styles.mark}><Check size={15} color="#FFFFFF" strokeWidth={2} /></View>;
}

const styles = StyleSheet.create({
  mark: {
    position: 'absolute', top: 8, right: 8, width: 24, height: 24,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1B1B2F', shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18,
    shadowRadius: 3, elevation: 2,
  },
});
