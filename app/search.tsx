import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Keyboard, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { FolderChips } from '@/components/FolderChips';
import { NotebookCard } from '@/components/NotebookCard';
import { NotexIcon, NotexWordmark } from '@/components/NotexBrand';
import { libraryColors } from '@/components/libraryTheme';
import { pageRepository } from '@/db/repositories/pageRepository';
import { parseContent } from '@/features/canvas/engine/content';
import { useNotebookStore } from '@/store/notebookStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import type { Page } from '@/types/page';
import { fonts } from '@/theme/fonts';
import { matchesSearch } from '@/utils/search';
import { sortNotebooks, dateLabel } from '@/utils/notebook';
import { recordRecentNotebook } from '@/utils/recentNotebooks';
import { markNotebookNavigationStart } from '@/utils/notebookOpenPerformance';

type PageSearchEntry = { page: Page; notebookId: string; notebookTitle: string; notebookFolder: string };

export default function SearchScreen() {
  const { colors: themeColors, scheme } = useTheme();
  const colors = libraryColors(themeColors, scheme);
  const styles = makeStyles(colors);
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [folder, setFolder] = useState('Tümü');
  const [pages, setPages] = useState<PageSearchEntry[]>([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const notebooks = useNotebookStore(state => state.notebooks);
  const viewMode = useNotebookStore(state => state.viewMode);
  const sortBy = useNotebookStore(state => state.sortBy);
  const toggleFavorite = useNotebookStore(state => state.toggleFavorite);
  const duplicateNotebook = useNotebookStore(state => state.duplicateNotebook);
  const deleteNotebook = useNotebookStore(state => state.deleteNotebook);
  const moveNotebook = useNotebookStore(state => state.moveNotebook);
  const folders = useNotebookStore(state => state.folders);
  const recentSearches = useSettingsStore(state => state.recentSearches);
  const addSearch = useSettingsStore(state => state.addSearch);
  const clearSearches = useSettingsStore(state => state.clearSearches);
  const columns = viewMode === 'grid' ? Math.max(2, Math.min(4, Math.floor((width - 40 + 20) / 170))) : 1;
  const cardWidth = (width - 40 - (columns - 1) * 20) / columns;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setPagesLoading(true);
    void Promise.all(notebooks.map(async notebook => {
      const notebookPages = await pageRepository.getByNotebook(notebook.id);
      return notebookPages.map(page => ({ page, notebookId: notebook.id, notebookTitle: notebook.title, notebookFolder: notebook.folder }));
    })).then(groups => {
      if (active) setPages(groups.flat());
    }).catch(error => {
      console.warn('[Notex search] Note pages could not be loaded', error);
      if (active) setPages([]);
    }).finally(() => { if (active) setPagesLoading(false); });
    return () => { active = false; };
  }, [notebooks]);

  const notebookResults = useMemo(() => sortNotebooks(
    notebooks.filter(notebook => matchesSearch(notebook.title, debounced) && (folder === 'Tümü' || notebook.folder === folder)),
    sortBy,
  ), [notebooks, debounced, folder, sortBy]);

  const pageResults = useMemo(() => {
    if (!debounced) return [];
    return pages.filter(entry => (folder === 'Tümü' || entry.notebookFolder === folder)
      && parseContent(entry.page.content).elements.some(element => element.type === 'text' && matchesSearch(element.text, debounced)))
      .sort((a, b) => b.page.updatedAt.localeCompare(a.page.updatedAt));
  }, [pages, debounced, folder]);

  const openNotebook = (id: string) => {
    Keyboard.dismiss();
    markNotebookNavigationStart(id);
    router.push({ pathname: '/note/[id]', params: { id } });
    void Promise.all([addSearch(query), recordRecentNotebook(id)]).catch(error => {
      if (__DEV__) console.warn('[Notex search] Recent search could not be saved', error);
    });
  };

  const openPage = (entry: PageSearchEntry) => {
    Keyboard.dismiss();
    markNotebookNavigationStart(entry.notebookId);
    router.push({ pathname: '/note/[id]', params: { id: entry.notebookId, pageId: entry.page.id } });
    void Promise.all([addSearch(query), recordRecentNotebook(entry.notebookId)]).catch(error => {
      if (__DEV__) console.warn('[Notex search] Recent search could not be saved', error);
    });
  };

  const showNotebookActions = (id: string) => {
    const notebook = notebooks.find(item => item.id === id);
    if (!notebook) return;
    Alert.alert(notebook.title, 'Defter işlemleri', [
      { text: 'Düzenle', onPress: () => router.push({ pathname: '/notebook-editor', params: { id } }) },
      { text: notebook.favorite ? 'Favorilerden çıkar' : 'Favorilere ekle', onPress: () => void toggleFavorite(id) },
      { text: 'Klasöre taşı', onPress: () => Alert.alert('Klasöre taşı', 'Hedef klasör', [
        { text: 'Klasörsüz', onPress: () => void moveNotebook(id, null) },
        ...folders.map(target => ({ text: target.name, onPress: () => void moveNotebook(id, target.id) })),
        { text: 'Vazgeç', style: 'cancel' as const },
      ]) },
      { text: 'Çoğalt', onPress: () => void duplicateNotebook(id) },
      { text: 'Sil', style: 'destructive', onPress: () => Alert.alert('Defteri sil', "Bu defter Silinenler'e taşınacak ve 30 gün sonra kalıcı olarak silinecek.", [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: () => void deleteNotebook(id) },
      ]) },
      { text: 'Kapat', style: 'cancel' },
    ]);
  };

  const hasResults = notebookResults.length > 0 || pageResults.length > 0;

  return <SafeAreaView style={styles.safe}>
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.brand}><NotexIcon compact /><NotexWordmark compact /></View>
        <Text style={styles.topLabel}>Ara</Text>
      </View>
      <View style={styles.searchBox}>
        <Search size={19} color={colors.muted} />
        <TextInput autoFocus accessibilityLabel="Defter ve notlarda ara" placeholder="Defter veya notlarda ara" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} returnKeyType="search" style={styles.input} />
        {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={() => setQuery('')} style={styles.clearButton}><X size={18} color={colors.ink} /></Pressable>}
      </View>
      <View style={styles.filters}><FolderChips value={folder} onChange={setFolder} colorsOverride={colors} /></View>

      {!query.trim() ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.recentContent}>
        {recentSearches.length > 0 ? <>
          <View style={styles.recentHeading}><Text style={styles.sectionTitle}>Son aramalar</Text><Pressable accessibilityRole="button" accessibilityLabel="Son aramaları temizle" onPress={() => void clearSearches()} style={styles.clearRecent}><Text style={styles.clearRecentText}>Temizle</Text></Pressable></View>
          {recentSearches.map(item => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`${item} aramasını yeniden yap`} onPress={() => setQuery(item)} style={styles.recentRow}><Text style={styles.recentText}>{item}</Text></Pressable>)}
        </> : <View style={styles.emptySearch}><Text style={styles.emptyTitle}>Defterlerinde ara</Text><Text style={styles.emptyCopy}>Defter adlarını ve desteklenen dijital metinleri bul.</Text></View>}
      </ScrollView> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.resultsContent}>
        <Text style={styles.resultCount}>{notebookResults.length + pageResults.length} sonuç</Text>
        {notebookResults.length > 0 && <>
          <Text style={styles.sectionTitle}>Defterler</Text>
          <View style={[styles.notebookResults, viewMode === 'grid' && styles.gridResults]}>{notebookResults.map(notebook => <View key={notebook.id} style={viewMode === 'grid' ? { width: cardWidth } : styles.listResult}>
            <NotebookCard notebook={notebook} width={cardWidth} viewMode={viewMode} onOpen={() => void openNotebook(notebook.id)} onOptions={() => showNotebookActions(notebook.id)} onMenu={() => showNotebookActions(notebook.id)} highlight={debounced} colorsOverride={colors} />
          </View>)}</View>
        </>}
        {pageResults.length > 0 && <>
          <Text style={[styles.sectionTitle, styles.pageHeading]}>Notlar</Text>
          <View style={styles.pageResultCard}>{pageResults.map((entry, index) => <Pressable key={entry.page.id} accessibilityRole="button" accessibilityLabel={`${entry.notebookTitle}, sayfa ${entry.page.position + 1}`} onPress={() => void openPage(entry)} style={[styles.pageRow, index < pageResults.length - 1 && styles.pageDivider]}>
            <View style={styles.pageIcon}><Text style={styles.pageNumber}>{entry.page.position + 1}</Text></View>
            <View style={styles.pageText}><Text numberOfLines={1} style={styles.pageTitle}>{entry.notebookTitle} · Sayfa {entry.page.position + 1}</Text><Text numberOfLines={1} style={styles.pageMeta}>Düzenlendi: {dateLabel(entry.page.updatedAt)}</Text></View>
          </Pressable>)}</View>
        </>}
        {!hasResults && !pagesLoading && <Text style={styles.noResults}>“{debounced}” için sonuç bulunamadı.</Text>}
        {pagesLoading && <Text style={styles.loadingText}>Notlar aranıyor…</Text>}
      </ScrollView>}
    </View>
  </SafeAreaView>;
}

function makeStyles(colors: ThemeColors) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, root: { flex: 1, backgroundColor: colors.background },
  topBar: { minHeight: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }, brand: { flexDirection: 'row', alignItems: 'center', marginLeft: -5 }, topLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  searchBox: { minHeight: 48, marginHorizontal: 20, marginTop: 16, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface }, input: { flex: 1, minWidth: 0, paddingVertical: 10, fontFamily: fonts.body, fontSize: 15, color: colors.ink }, clearButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  filters: { paddingTop: 13, paddingBottom: 12 }, recentContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 48, flexGrow: 1 }, recentHeading: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink }, clearRecent: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 8 }, clearRecentText: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent }, recentRow: { minHeight: 50, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }, recentText: { fontFamily: fonts.body, fontSize: 15, color: colors.ink }, emptySearch: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 90 }, emptyTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink }, emptyCopy: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: 7 },
  resultsContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 60 }, resultCount: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginBottom: 16 }, notebookResults: { marginTop: 10 }, gridResults: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 }, listResult: { width: '100%' }, pageHeading: { marginTop: 24, marginBottom: 10 }, pageResultCard: { paddingHorizontal: 13, backgroundColor: colors.surface, borderRadius: 16 }, pageRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 }, pageDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }, pageIcon: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }, pageNumber: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted }, pageText: { flex: 1, minWidth: 0 }, pageTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }, pageMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 4 }, noResults: { paddingTop: 70, textAlign: 'center', fontFamily: fonts.body, fontSize: 14, color: colors.muted }, loadingText: { paddingTop: 22, textAlign: 'center', fontFamily: fonts.body, fontSize: 13, color: colors.muted },
}); }
