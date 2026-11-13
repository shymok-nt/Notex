import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Copy, Heart, LayoutGrid, List, MoreHorizontal, Pencil, Search, Settings2, Trash2, X } from 'lucide-react-native';
import { BackupReminder } from '@/components/BackupReminder';
import { EmptyState } from '@/components/EmptyState';
import { FolderChips } from '@/components/FolderChips';
import { NotebookCard } from '@/components/NotebookCard';
import { SelectionActionBar } from '@/components/SelectionActionBar';
import { NotexIcon, NotexWordmark } from '@/components/NotexBrand';
import { libraryColors } from '@/components/libraryTheme';
import { useNotebookStore } from '@/store/notebookStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import type { Notebook, SortBy, ViewMode } from '@/types/notebook';
import { sortNotebooks } from '@/utils/notebook';
import { markNotebookNavigationStart } from '@/utils/notebookOpenPerformance';

const sortOptions: { value: SortBy; label: string }[] = [
  { value: 'updated', label: 'Son düzenlenen' },
  { value: 'title', label: 'Ada göre' },
  { value: 'created', label: 'Oluşturma tarihi' },
];

export function NotebookLibrary({ favorites = false }: { favorites?: boolean }) {
  const { colors: themeColors, scheme } = useTheme();
  const colors = libraryColors(themeColors, scheme);
  const styles = makeStyles(colors, scheme);
  const { width } = useWindowDimensions();
  const all = useNotebookStore(state => state.notebooks);
  const folder = useNotebookStore(state => state.selectedFolder);
  const setFolder = useNotebookStore(state => state.setSelectedFolder);
  const sortBy = useNotebookStore(state => state.sortBy);
  const setSortBy = useNotebookStore(state => state.setSortBy);
  const viewMode = useNotebookStore(state => state.viewMode);
  const setViewMode = useNotebookStore(state => state.setViewMode);
  const toggleFavorite = useNotebookStore(state => state.toggleFavorite);
  const duplicateNotebook = useNotebookStore(state => state.duplicateNotebook);
  const deleteNotebooks = useNotebookStore(state => state.deleteNotebooks);
  const folders = useNotebookStore(state => state.folders);
  const moveNotebook = useNotebookStore(state => state.moveNotebook);

  const [checked, setChecked] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [working, setWorking] = useState(false);
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState<Notebook | null>(null);
  const [moveTarget, setMoveTarget] = useState<Notebook | null>(null);

  const columns = viewMode === 'grid' ? Math.max(2, Math.floor((width - 40 + 20) / 190)) : 1;
  const cardWidth = viewMode === 'grid'
    ? Math.min(170, (width - 40 - (columns - 1) * 20) / columns)
    : Math.max(0, width - 40);
  const data = useMemo(() => sortNotebooks(
    all.filter(notebook => (!favorites || notebook.favorite) && (favorites || folder === 'Tümü' || notebook.folder === folder)),
    sortBy,
  ), [all, favorites, folder, sortBy]);

  useEffect(() => {
    const available = new Set(data.map(notebook => notebook.id));
    setChecked(current => current.filter(id => available.has(id)));
  }, [data]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirmDelete || menu || selected || moveTarget) return false;
      if (working) return true;
      if (!multiSelect) return false;
      setChecked([]);
      setMultiSelect(false);
      return true;
    });
    return () => subscription.remove();
  }, [confirmDelete, menu, selected, moveTarget, multiSelect]);

  useFocusEffect(useCallback(() => () => {
    setChecked([]);
    setMultiSelect(false);
  }, []));

  const toggleChecked = (id: string) => setChecked(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const beginSelection = (id: string) => { setMultiSelect(true); setChecked(current => current.includes(id) ? current : [...current, id]); };
  const openNotebook = (id: string) => {
    if (multiSelect) {
      toggleChecked(id);
      return;
    }
    markNotebookNavigationStart(id);
    router.push({ pathname: '/note/[id]', params: { id } });
  };
  const openEditor = (id?: string) => router.push({ pathname: '/notebook-editor', params: id ? { id } : {} });

  const confirmBulkDelete = async () => {
    if (working) return;
    setWorking(true);
    try {
      const validIds = [...new Set(checked.filter(id => data.some(notebook => notebook.id === id)))];
      if (!validIds.length) return;
      const removed = await deleteNotebooks(validIds);
      if (!removed?.length) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert('Defterler silinemedi. Lütfen tekrar dene.');
        else Alert.alert('Defterler silinemedi', 'Lütfen tekrar dene.');
        return;
      }
      if (removed.length < validIds.length) {
        const movedIds = new Set(removed);
        setChecked(validIds.filter(id => !movedIds.has(id)));
        setConfirmDelete(false);
        const message = `${removed.length} defter taşındı; kalan ${validIds.length - removed.length} defter için işlem tamamlanamadı.`;
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
        else Alert.alert('Kısmi silme', message);
        return;
      }
      setChecked([]);
      setMultiSelect(false);
      setConfirmDelete(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tekrar dene.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Defterler silinemedi', message);
    } finally {
      setWorking(false);
    }
  };

  const selectionActions = [
    { key: 'delete', label: 'Sil', icon: Trash2, danger: true, disabled: working || checked.length === 0, onPress: () => setConfirmDelete(true) },
    { key: 'all', label: 'Tümünü seç', icon: List, disabled: working, onPress: () => { setMultiSelect(true); setChecked(data.map(notebook => notebook.id)); } },
    { key: 'duplicate', label: 'Çoğalt', icon: Copy, disabled: working || checked.length === 0, onPress: async () => { setWorking(true); try { const failed: string[] = []; for (const id of checked) if (!(await duplicateNotebook(id))) failed.push(id); setChecked(failed); if (!failed.length) setMultiSelect(false); } finally { setWorking(false); } } },
    { key: 'favorite', label: 'Favori', icon: Heart, disabled: working || checked.length === 0, onPress: async () => { setWorking(true); try { const failed: string[] = []; for (const id of checked) if (!(await toggleFavorite(id))) failed.push(id); setChecked(failed); if (!failed.length) setMultiSelect(false); } finally { setWorking(false); } } },
    { key: 'clear', label: 'Temizle', icon: X, disabled: working || checked.length === 0, onPress: () => setChecked([]) },
    ...(checked.length === 1 ? [{ key: 'more', label: 'Diğer', icon: MoreHorizontal, disabled: working, onPress: () => setSelected(data.find(notebook => notebook.id === checked[0]) ?? null) }] : []),
    { key: 'exit', label: 'Çıkış', icon: X, disabled: working, onPress: () => { setChecked([]); setMultiSelect(false); } },
  ];

  const listHeader = <View>
    <View style={styles.hero}>
      <Text style={styles.heroTitle}>{favorites ? 'Favoriler' : 'Defterler'}</Text>
      <Text style={styles.heroSubtitle}>{favorites ? 'Sık kullandığın defterler.' : 'Tüm defterlerin, tek bir yerde.'}</Text>
    </View>
    {!favorites && <BackupReminder />}
    <View style={styles.section}>
      {checked.length > 0 ? <View style={[styles.selectionBar, { display: 'none' }]}>
        <Text numberOfLines={1} style={styles.selectedCount}>{checked.length} seçili</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectionActions}>
          <Pressable disabled={working} accessibilityRole="button" accessibilityLabel="Seçilen defterleri çoğalt" onPress={async () => { setWorking(true); try { for (const id of checked) await duplicateNotebook(id); setChecked([]); } finally { setWorking(false); } }} style={styles.slimAction}><Copy size={17} color={colors.accent} /><Text style={[styles.slimText, styles.accentText]}>Çoğalt</Text></Pressable>
          <Pressable disabled={working} accessibilityRole="button" accessibilityLabel="Seçilen defterleri favorilere ekle veya çıkar" onPress={async () => { setWorking(true); try { for (const id of checked) await toggleFavorite(id); setChecked([]); } finally { setWorking(false); } }} style={styles.slimAction}><Heart size={17} color={colors.ink} /><Text style={styles.slimText}>Favori</Text></Pressable>
          <Pressable disabled={working} accessibilityRole="button" accessibilityLabel="Seçilen defterleri sil" onPress={() => setConfirmDelete(true)} style={styles.slimAction}><Trash2 size={17} color={colors.coral} /><Text style={[styles.slimText, styles.dangerText]}>Sil</Text></Pressable>
          {checked.length === 1 && <Pressable accessibilityRole="button" accessibilityLabel="Defter işlemleri" onPress={() => setSelected(all.find(notebook => notebook.id === checked[0]) ?? null)} style={styles.slimAction}><MoreHorizontal size={17} color={colors.ink} /><Text style={styles.slimText}>Diğer</Text></Pressable>}
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Seçimi temizle" onPress={() => setChecked([])} style={styles.clearSelection}><X size={19} color={colors.ink} /></Pressable>
      </View> : <>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{favorites ? 'Favori defterler' : 'Tüm defterler'}</Text><Text style={styles.count}>{data.length}</Text></View>
        <View style={styles.sectionTools}>
          <Text style={styles.resultLabel}>{data.length} defter</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Sıralama ve görünüm seçenekleri" onPress={() => setMenu(true)} style={styles.sortButton}><MoreHorizontal size={17} color={colors.accent} /><Text style={styles.sortText}>Sırala</Text></Pressable>
        </View>
      </>}
    </View>
  </View>;

  return <SafeAreaView style={styles.safe}>
    <View style={styles.body}>
      <View style={styles.topBar}>
        <View style={styles.brand}><NotexIcon compact /><NotexWordmark compact dark={scheme==='dark'} /></View>
        <View style={styles.topActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={viewMode === 'grid' ? 'Liste görünümüne geç' : 'Izgara görünümüne geç'} onPress={() => void setViewMode(viewMode === 'grid' ? 'list' : 'grid')} style={styles.iconButton}>
            {viewMode === 'grid' ? <List size={20} color={colors.ink} /> : <LayoutGrid size={20} color={colors.ink} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Defterlerde ara" onPress={() => router.navigate('/(tabs)/search' as never)} style={styles.iconButton}><Search size={20} color={colors.ink} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Ayarlar" onPress={() => router.push('/settings')} style={styles.iconButton}><Settings2 size={20} color={colors.ink} /></Pressable>
        </View>
      </View>
      <View style={styles.headerDivider} />
      {!favorites && <View style={styles.filters}><FolderChips value={folder} onChange={setFolder} colorsOverride={colors} /></View>}

      <FlatList
        key={`${columns}-${viewMode}`}
        style={styles.list}
        data={data}
        numColumns={columns}
        keyExtractor={notebook => notebook.id}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        contentContainerStyle={data.length > 0 ? styles.listContent : styles.emptyContent}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => <View style={columns > 1 ? { width: cardWidth, marginBottom: 22 } : styles.listItem}>
          <NotebookCard notebook={item} width={cardWidth} viewMode={viewMode} onOpen={() => openNotebook(item.id)} onOptions={() => multiSelect ? toggleChecked(item.id) : beginSelection(item.id)} onMenu={() => setSelected(item)} selected={checked.includes(item.id)} colorsOverride={colors} />
        </View>}
        ListEmptyComponent={<EmptyState colorsOverride={colors} />}
      />

      {!favorites && !multiSelect && <Pressable accessibilityRole="button" accessibilityLabel="Yeni defter oluştur" onPress={() => openEditor()} style={styles.fab}><Pencil size={21} strokeWidth={2.3} color={colors.onAccent} /></Pressable>}
    </View>

    <SelectionActionBar visible={multiSelect} selectedCount={checked.length} actions={selectionActions} />
    <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
      <View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirmDelete(false)} /><View style={styles.confirmCard}>
        <Text style={styles.modalTitle}>Defterleri sil</Text>
        <Text style={styles.modalCopy}>{checked.length} defter Silinenler'e taşınacak ve 30 gün sonra kalıcı olarak silinecek.</Text>
        <View style={styles.confirmActions}><Pressable disabled={working} onPress={() => setConfirmDelete(false)} style={styles.confirmButton}><Text style={styles.slimText}>Vazgeç</Text></Pressable><Pressable disabled={working} onPress={() => void confirmBulkDelete()} style={styles.confirmButton}>{working?<View style={{flexDirection:'row',alignItems:'center',gap:8}}><ActivityIndicator size="small" color={colors.coral}/><Text style={styles.dangerText}>Siliniyor</Text></View>:<Text style={styles.dangerText}>Sil</Text>}</Pressable></View>
      </View></View>
    </Modal>

    <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
      <View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} /><View style={styles.sheet}>
        <Text style={styles.modalTitle}>Sıralama ve görünüm</Text>
        {sortOptions.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: sortBy === option.value }} style={styles.option} onPress={() => { void setSortBy(option.value); setMenu(false); }}><Text style={[styles.optionText, sortBy === option.value && styles.activeText]}>{option.label}{sortBy === option.value ? '  ✓' : ''}</Text></Pressable>)}
        <Text style={styles.sheetSubheading}>Görünüm</Text>
        {(['grid', 'list'] as ViewMode[]).map(mode => <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected: viewMode === mode }} style={styles.option} onPress={() => { void setViewMode(mode); setMenu(false); }}><Text style={[styles.optionText, viewMode === mode && styles.activeText]}>{mode === 'grid' ? 'Izgara' : 'Liste'}{viewMode === mode ? '  ✓' : ''}</Text></Pressable>)}
        <Pressable accessibilityRole="button" style={styles.option} onPress={() => { setMenu(false); router.push('/(tabs)/folders'); }}><Text style={styles.optionText}>Klasörleri yönet</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.option} onPress={() => { setMenu(false); router.navigate('/(tabs)/favorites'); }}><Text style={styles.optionText}>Favorileri aç</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.option} onPress={() => setMenu(false)}><Text style={styles.optionText}>Kapat</Text></Pressable>
      </View></View>
    </Modal>

    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
      <View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} /><View style={styles.sheet}>
        <Text numberOfLines={1} style={styles.modalTitle}>{selected?.title}</Text>
        <Pressable accessibilityRole="button" style={styles.option} onPress={() => { const id = selected?.id; setSelected(null); setChecked([]); if (id) openEditor(id); }}><Text style={styles.optionText}>Defteri düzenle</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.option} onPress={() => { if (selected) void toggleFavorite(selected.id); setSelected(null); setChecked([]); }}><Text style={styles.optionText}>{selected?.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.option} onPress={() => { setMoveTarget(selected); setSelected(null); setChecked([]); }}><Text style={styles.optionText}>Klasöre taşı</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.option} onPress={() => { if (selected) void duplicateNotebook(selected.id); setSelected(null); setChecked([]); }}><Text style={styles.optionText}>Çoğalt</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.option} onPress={() => { if (selected) { setConfirmDelete(true); setChecked([selected.id]); setSelected(null); } }}><Text style={styles.dangerText}>Sil</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.option} onPress={() => setSelected(null)}><Text style={styles.optionText}>Vazgeç</Text></Pressable>
      </View></View>
    </Modal>

    <Modal visible={!!moveTarget} transparent animationType="slide" onRequestClose={() => setMoveTarget(null)}>
      <View style={styles.modalBackdrop}><View style={styles.sheet}><Text style={styles.modalTitle}>Klasöre taşı</Text>
        {[{ id: null, name: 'Klasörsüz' }, ...folders].map(target => <Pressable key={target.id ?? 'none'} accessibilityRole="button" style={styles.option} onPress={() => { if (moveTarget) void moveNotebook(moveTarget.id, target.id); setMoveTarget(null); }}><Text style={styles.optionText}>{target.name}</Text></Pressable>)}
        <Pressable accessibilityRole="button" style={styles.option} onPress={() => setMoveTarget(null)}><Text style={styles.optionText}>Vazgeç</Text></Pressable>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

function makeStyles(colors: ThemeColors, scheme: 'light' | 'dark') { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, body: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { flexDirection: 'row', alignItems: 'center', marginLeft: -5 }, topActions: { flexDirection: 'row', gap: 6 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: scheme === 'light' ? colors.surface : colors.surfaceRaised },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginHorizontal: -20 }, filters: { marginHorizontal: -20, paddingTop: 10, paddingBottom: 3 }, list: { flex: 1 },
  hero: { paddingTop: 24, paddingBottom: 17 }, heroTitle: { fontFamily: fonts.heading, fontSize: 31, lineHeight: 37, letterSpacing: -0.5, color: colors.ink }, heroSubtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 4 },
  section: { marginTop: 3, marginBottom: 12 }, sectionHeading: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { fontFamily: fonts.heading, fontSize: 21, letterSpacing: -0.3, color: colors.ink }, count: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  sectionTools: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, resultLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.muted }, sortButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 5 }, sortText: { fontFamily: fonts.medium, fontSize: 14, color: colors.accent },
  selectionBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 5 }, selectedCount: { maxWidth: 68, fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }, selectionActions: { alignItems: 'center', gap: 2 }, slimAction: { minHeight: 42, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, slimText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink }, accentText: { color: colors.accent }, dangerText: { fontFamily: fonts.medium, color: colors.coral }, clearSelection: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  gridRow: { gap: 20 }, listItem: { flex: 1 }, listContent: { paddingBottom: 108 }, emptyContent: { flexGrow: 1, justifyContent: 'center', paddingBottom: 100 }, fab: { position: 'absolute', bottom: 18, right: 18, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 30 }, modalTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink, marginBottom: 8 }, modalCopy: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink }, confirmCard: { margin: 20, padding: 22, gap: 12, backgroundColor: colors.surface, borderRadius: 20 }, confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 4 }, confirmButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }, option: { minHeight: 48, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }, optionText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink }, sheetSubheading: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 2 }, activeText: { color: colors.accent, fontFamily: fonts.semibold },
}); }
