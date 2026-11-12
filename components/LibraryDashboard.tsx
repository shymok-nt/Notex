import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LayoutGrid, List, Pencil, Settings2, ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotebookCover } from '@/components/NotebookCover';
import { PagePreview } from '@/components/PagePreview';
import { NotexIcon, NotexWordmark } from '@/components/NotexBrand';
import { libraryColors } from '@/components/libraryTheme';
import { parseContent } from '@/features/canvas/engine/content';
import { pageRepository } from '@/db/repositories/pageRepository';
import { useNotebookStore } from '@/store/notebookStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import type { Page } from '@/types/page';
import { dateLabel, sortNotebooks } from '@/utils/notebook';
import { resolveCoverUri } from '@/utils/files';
import { markNotebookNavigationStart } from '@/utils/notebookOpenPerformance';

type RecentPage = { page: Page; notebookTitle: string };

function firstTextTitle(content: string) {
  const element = parseContent(content).elements.find(item => item.type === 'text' && item.text.trim().length > 0);
  return element?.type === 'text' ? element.text.trim().replace(/\s+/g, ' ').slice(0, 120) : null;
}

export function LibraryDashboard() {
  const { colors: themeColors, scheme } = useTheme();
  const colors = libraryColors(themeColors, scheme);
  const styles = makeStyles(colors);
  const { width } = useWindowDimensions();
  const notebooks = useNotebookStore(state => state.notebooks);
  const viewMode = useNotebookStore(state => state.viewMode);
  const setViewMode = useNotebookStore(state => state.setViewMode);
  const recentNotebooks = useMemo(() => sortNotebooks(notebooks, 'updated').slice(0, 8), [notebooks]);
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setPagesLoading(true);
    void Promise.all(notebooks.map(async notebook => {
      const pages = await pageRepository.getByNotebook(notebook.id);
      return pages.map(page => ({ page, notebookTitle: notebook.title }));
    })).then(groups => {
      if (!active) return;
      setRecentPages(groups.flat().sort((a, b) => b.page.updatedAt.localeCompare(a.page.updatedAt)).slice(0, 5));
    }).catch(error => {
      console.warn('[Notex home] Recent pages could not be loaded', error);
      if (active) setRecentPages([]);
    }).finally(() => { if (active) setPagesLoading(false); });
    return () => { active = false; };
  }, [notebooks]);

  const openNotebook = (id: string) => { markNotebookNavigationStart(id); router.push({ pathname: '/note/[id]', params: { id } }); };
  const openPage = (item: RecentPage) => { markNotebookNavigationStart(item.page.notebookId); router.push({ pathname: '/note/[id]', params: { id: item.page.notebookId, pageId: item.page.id } }); };
  const coverWidth = Math.min(120, Math.max(96, (width - 84) / 2.45));

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.brand}><NotexIcon compact/><NotexWordmark compact/></View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={viewMode === 'grid' ? 'Liste g\u00f6r\u00fcn\u00fcm\u00fcne ge\u00e7' : '\u0130zgara g\u00f6r\u00fcn\u00fcm\u00fcne ge\u00e7'} onPress={() => void setViewMode(viewMode === 'grid' ? 'list' : 'grid')} style={styles.iconButton}>
            {viewMode === 'grid' ? <List size={21} color={colors.ink}/> : <LayoutGrid size={20} color={colors.ink}/>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Ayarlar" onPress={() => router.push('/settings')} style={styles.iconButton}><Settings2 size={21} color={colors.ink}/></Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.headingBlock}>
          <Text style={styles.pageTitle}>Ana sayfa</Text>
          <Text style={styles.subtitle}>Notların ve defterlerin, tek bir yerde.</Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Defterlerim</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Tüm defterleri gör" onPress={() => router.navigate('/(tabs)/notebooks' as never)} style={styles.seeAll}>
            <Text style={styles.seeAllText}>Tümü</Text><ChevronRight size={17} color={colors.accent}/>
          </Pressable>
        </View>
        {recentNotebooks.length > 0 ? viewMode === 'grid' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.notebookRow}>
          {recentNotebooks.map(notebook => <Pressable key={notebook.id} accessibilityRole="button" accessibilityLabel={`${notebook.title} defterini a\u00e7`} onPress={() => openNotebook(notebook.id)} style={[styles.notebookItem, { width: coverWidth }]}>
            <NotebookCover notebook={notebook} width={coverWidth} showTitle={false} colorsOverride={colors}/>
            <Text numberOfLines={1} style={styles.notebookTitle}>{notebook.title}</Text>
            <Text style={styles.notebookMeta}>{notebook.pageCount} sayfa</Text>
          </Pressable>)}
        </ScrollView> : <View style={styles.notebookList}>
          {recentNotebooks.map((notebook, index) => <Pressable key={notebook.id} accessibilityRole="button" accessibilityLabel={`${notebook.title} defterini a\u00e7`} onPress={() => openNotebook(notebook.id)} style={[styles.notebookListRow, index < recentNotebooks.length - 1 && styles.notebookListDivider]}>
            <NotebookCover notebook={notebook} width={48} showTitle={false} colorsOverride={colors}/>
            <View style={styles.notebookListText}><Text numberOfLines={1} style={styles.notebookTitle}>{notebook.title}</Text><Text style={styles.notebookMeta}>{notebook.pageCount} sayfa · {dateLabel(notebook.updatedAt)}</Text></View>
            <ChevronRight size={18} color={colors.muted}/>
          </Pressable>)}
        </View> : <View style={styles.emptyNotebooks}>
          <Text style={styles.emptyTitle}>Henüz defter yok</Text>
          <Text style={styles.emptyCopy}>Yeni bir defter oluşturarak başlayabilirsin.</Text>
        </View>}

        <View style={styles.notesHeading}><Text style={styles.sectionTitle}>Son notlar</Text></View>
        {pagesLoading ? <View style={styles.loading}><ActivityIndicator size="small" color={colors.accent}/></View> : recentPages.length > 0 ? <View style={styles.notesCard}>
          {recentPages.map(({ page, notebookTitle }, index) => <Pressable key={page.id} accessibilityRole="button" accessibilityLabel={`${notebookTitle}, Sayfa ${page.position + 1}`} onPress={() => openPage({ page, notebookTitle })} style={[styles.noteRow, index < recentPages.length - 1 && styles.noteDivider]}>
            <View style={styles.pageThumb}>{page.thumbnailPath ? <Image source={{ uri: resolveCoverUri(page.thumbnailPath) ?? undefined }} resizeMode="cover" style={StyleSheet.absoluteFill}/> : <PagePreview template={page.template} paperColor={page.paperColor} width={44} height={56}/>}</View>
            <View style={styles.noteText}>
              <Text numberOfLines={1} style={styles.noteTitle}>{firstTextTitle(page.content) ?? notebookTitle}</Text>
              <Text numberOfLines={1} style={styles.noteSubtitle}>Sayfa {page.position + 1}</Text>
            </View>
            <Text style={styles.noteTime}>{dateLabel(page.updatedAt)}</Text>
          </Pressable>)}
        </View> : <View style={styles.emptyNotes}><Text style={styles.emptyCopy}>Henüz düzenlenmiş sayfa yok.</Text></View>}
      </ScrollView>

      <Pressable accessibilityRole="button" accessibilityLabel="Yeni defter olu\u015ftur" onPress={() => router.push('/notebook-editor')} style={styles.fab}><Pencil size={21} color="#FFFFFF" strokeWidth={2.3}/></Pressable>
    </View>
  </SafeAreaView>;
}

function makeStyles(colors: ThemeColors) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, root: { flex: 1, backgroundColor: colors.background },
  topBar: { height: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  brand: { flexDirection: 'row', alignItems: 'center', marginLeft: -5 }, actions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  content: { paddingHorizontal: 20, paddingBottom: 108 }, headingBlock: { paddingTop: 25, paddingBottom: 24 },
  pageTitle: { fontFamily: fonts.heading, fontSize: 31, lineHeight: 37, letterSpacing: -0.5, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 23, letterSpacing: -0.35, color: colors.ink },
  seeAll: { minHeight: 44, paddingLeft: 10, flexDirection: 'row', alignItems: 'center', gap: 1 }, seeAllText: { fontFamily: fonts.medium, fontSize: 14, color: colors.accent },
  notebookRow: { gap: 15, paddingRight: 4, paddingBottom: 19 }, notebookItem: { minWidth: 96 },
  notebookList: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 12, marginBottom: 12 }, notebookListRow: { minHeight: 73, flexDirection: 'row', alignItems: 'center', gap: 12 }, notebookListDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }, notebookListText: { flex: 1, minWidth: 0 },
  notebookTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, marginTop: 10 }, notebookMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 3 },
  emptyNotebooks: { paddingVertical: 22, paddingHorizontal: 18, backgroundColor: colors.surface, borderRadius: 16, marginBottom: 12 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }, emptyCopy: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 4 },
  notesHeading: { marginTop: 4, marginBottom: 13 }, notesCard: { backgroundColor: colors.surface, borderRadius: 19, paddingHorizontal: 14, paddingVertical: 3, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.045, shadowRadius: 8, elevation: 1 },
  noteRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }, noteDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  pageThumb: { width: 44, height: 56, borderRadius: 7, overflow: 'hidden', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  noteText: { flex: 1, minWidth: 0 }, noteTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }, noteSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 4 }, noteTime: { maxWidth: 56, fontFamily: fonts.body, fontSize: 11, color: colors.muted, textAlign: 'right' },
  loading: { minHeight: 90, justifyContent: 'center', alignItems: 'center' }, emptyNotes: { backgroundColor: colors.surface, borderRadius: 16, padding: 18 },
  fab: { position: 'absolute', right: 20, bottom: 17, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.25, shadowRadius: 9, elevation: 5 },
}); }
