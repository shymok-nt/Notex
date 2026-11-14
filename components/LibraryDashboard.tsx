import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LayoutGrid, List, Settings2, ChevronRight, Trash2, X, FileUp } from 'lucide-react-native';
import {CreateNotebookIcon} from '@/components/CreateNotebookIcon';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotebookCover } from '@/components/NotebookCover';
import { NotebookSelectionMark } from '@/components/NotebookSelectionMark';
import { SelectionActionBar } from '@/components/SelectionActionBar';
import type { SelectionAction } from '@/components/SelectionActionBar';
import { NotexIcon, NotexWordmark } from '@/components/NotexBrand';
import { libraryColors } from '@/components/libraryTheme';
import { useNotebookStore } from '@/store/notebookStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import { dateLabel, sortNotebooks } from '@/utils/notebook';
import { markNotebookNavigationStart } from '@/utils/notebookOpenPerformance';
import { getRecentNotebookActivity } from '@/utils/recentNotebooks';
import type { RecentNotebookActivity } from '@/utils/recentNotebookActivity';
import { isTauriDesktop } from '@/utils/tauriFiles';
import { notebookRepository } from '@/db/repositories/notebookRepository';
import { cleanupPreparedPdfImport, preparePdfImport, type PreparedPdfImport } from '@/utils/pdfImport';

export function LibraryDashboard() {
  const { colors: themeColors, scheme } = useTheme();
  const colors = libraryColors(themeColors, scheme);
  const styles = makeStyles(colors);
  const { width } = useWindowDimensions();
  const notebooks = useNotebookStore(state => state.notebooks);
  const deleteNotebooks = useNotebookStore(state => state.deleteNotebooks);
  const viewMode = useNotebookStore(state => state.viewMode);
  const setViewMode = useNotebookStore(state => state.setViewMode);
  const recentNotebooks = useMemo(() => sortNotebooks(notebooks, 'updated').slice(0, 8), [notebooks]);
  const [recentActivity, setRecentActivity] = useState<RecentNotebookActivity[]>([]);
  const [recentActivityLoading, setRecentActivityLoading] = useState(true);
  const [selectionKind, setSelectionKind] = useState<'notebooks' | null>(null);
  const [selectedNotebookIds, setSelectedNotebookIds] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{completed:number;total:number;label:string}|null>(null);
  const pdfImporting = useRef(false);
  const [confirmNotebookDeleteVisible, setConfirmNotebookDeleteVisible] = useState(false);
  const longPressHandled = useRef(false);
  const recentOpenedNotebooks = useMemo(() => {
    const byId = new Map(notebooks.map(notebook => [notebook.id, notebook]));
    return recentActivity.flatMap(activity => {
      const notebook = byId.get(activity.id);
      return notebook ? [{ notebook, openedAt: activity.openedAt }] : [];
    }).slice(0, 5);
  }, [notebooks, recentActivity]);

  useEffect(() => {
    const valid = new Set(notebooks.map(notebook => notebook.id));
    setSelectedNotebookIds(current => current.filter(id => valid.has(id)));
  }, [notebooks]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (working) return true;
      if (!selectionKind) return false;
      setSelectionKind(null);
      setSelectedNotebookIds([]);
      return true;
    });
    return () => subscription.remove();
  }, [selectionKind]);

  useFocusEffect(useCallback(() => () => {
    setSelectionKind(null);
    setSelectedNotebookIds([]);
  }, []));

  useFocusEffect(useCallback(() => {
    let active = true;
    setRecentActivityLoading(true);
    void getRecentNotebookActivity().then(activity => {
      if (!active) return;
      setRecentActivity(activity);
    }).catch(error => {
      console.warn('[Notex home] Recent notebooks could not be loaded', error);
      if (active) setRecentActivity([]);
    }).finally(() => { if (active) setRecentActivityLoading(false); });
    return () => { active = false; };
  }, []));

  const openNotebook = (id: string) => { markNotebookNavigationStart(id); router.push({ pathname: '/note/[id]', params: { id } }); };
  const importPdf = async () => {
    if (!isTauriDesktop() || pdfImporting.current) return;
    pdfImporting.current = true;
    let prepared: PreparedPdfImport | null = null;
    try {
      prepared = await preparePdfImport((completed,total,label) => setPdfProgress({completed,total,label}));
      if (!prepared.pages.length) return;
      setPdfProgress({completed:prepared.pages.length,total:prepared.pages.length,label:'PDF defteri kaydediliyor…'});
      const notebookId = await notebookRepository.createFromPdf(prepared.title,prepared.pages);
      const firstPageId = prepared.pages[0].id;
      prepared = null;
      await useNotebookStore.getState().refresh();
      markNotebookNavigationStart(notebookId);
      router.push({pathname:'/note/[id]',params:{id:notebookId,pageId:firstPageId}});
    } catch (error) {
      if (prepared) await cleanupPreparedPdfImport(prepared).catch(cleanupError => console.error('[Notex PDF] Geçici dosyalar temizlenemedi',cleanupError));
      console.error('[Notex PDF] İçe aktarma başarısız',error);
      const message=error instanceof Error?error.message:'PDF defteri oluşturulamadı.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
      else Alert.alert('PDF içe aktarılamadı',message);
    } finally {
      pdfImporting.current = false;
      setPdfProgress(null);
    }
  };
  const toggleNotebook = (id: string) => setSelectedNotebookIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const notebookPress = (id: string) => {
    if (longPressHandled.current) { longPressHandled.current = false; return; }
    if (selectionKind === 'notebooks') { toggleNotebook(id); return; }
    openNotebook(id);
  };
  const notebookLongPress = (id: string) => {
    longPressHandled.current = true;
    if (selectionKind === 'notebooks') toggleNotebook(id);
    else { setSelectionKind('notebooks'); setSelectedNotebookIds([id]); }
  };
  const performNotebookDelete = async () => {
    if (working) return;
    const validIds = [...new Set(selectedNotebookIds.filter(id => notebooks.some(notebook => notebook.id === id)))];
    if (!validIds.length) return;
    setWorking(true);
    try {
      const moved = await deleteNotebooks(validIds);
      if (!moved?.length) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert('Defterler silinemedi. Lütfen tekrar dene.');
        else Alert.alert('Defterler silinemedi', 'Lütfen tekrar dene.');
        return;
      }
      if (moved.length < validIds.length) {
        const movedIds = new Set(moved);
        setSelectedNotebookIds(validIds.filter(id => !movedIds.has(id)));
        setConfirmNotebookDeleteVisible(false);
        const message = `${moved.length} defter taşındı; kalan ${validIds.length - moved.length} defter için işlem tamamlanamadı.`;
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
        else Alert.alert('Kısmi silme', message);
        return;
      }
      setSelectedNotebookIds([]);
      setSelectionKind(null);
      setConfirmNotebookDeleteVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lütfen Silinenler bölümünü kontrol et.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Defterler silinemedi', message);
    } finally { setWorking(false); }
  };
  const confirmNotebookDelete = () => setConfirmNotebookDeleteVisible(true);

  const selectionActions: SelectionAction[] = [
    { key: 'delete', label: 'Sil', icon: Trash2, danger: true, disabled: working || selectedNotebookIds.length === 0, onPress: confirmNotebookDelete },
    { key: 'all', label: 'Tümünü seç', icon: List, disabled: working, onPress: () => setSelectedNotebookIds(notebooks.map(notebook => notebook.id)) },
    { key: 'clear', label: 'Temizle', icon: X, disabled: working || selectedNotebookIds.length === 0, onPress: () => setSelectedNotebookIds([]) },
    { key: 'exit', label: 'Çıkış', icon: X, disabled: working, onPress: () => { setSelectionKind(null); setSelectedNotebookIds([]); } },
  ];
  const coverWidth = Math.min(120, Math.max(96, (width - 84) / 2.45));

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.brand}><NotexIcon compact/><NotexWordmark compact dark={scheme==='dark'}/></View>
        <View style={styles.actions}>
          {isTauriDesktop() && <Pressable accessibilityRole="button" accessibilityLabel="PDF içe aktar" disabled={pdfImporting.current} onPress={() => void importPdf()} style={styles.iconButton}><FileUp size={21} color={colors.ink}/></Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel={viewMode === 'grid' ? 'Liste g\u00f6r\u00fcn\u00fcm\u00fcne ge\u00e7' : '\u0130zgara g\u00f6r\u00fcn\u00fcm\u00fcne ge\u00e7'} onPress={() => void setViewMode(viewMode === 'grid' ? 'list' : 'grid')} style={styles.iconButton}>
            {viewMode === 'grid' ? <List size={21} color={colors.ink}/> : <LayoutGrid size={20} color={colors.ink}/>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Ayarlar" onPress={() => router.push('/settings')} style={styles.iconButton}><Settings2 size={21} color={colors.ink}/></Pressable>
        </View>
      </View>

      <Modal visible={pdfProgress!==null} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:24,backgroundColor:colors.overlay}}>
          <View style={{width:'100%',maxWidth:380,gap:14,padding:22,borderRadius:18,backgroundColor:colors.surfaceRaised}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:12}}><ActivityIndicator color={colors.accent}/><Text style={{flex:1,color:colors.ink,fontFamily:fonts.semibold,fontSize:15}}>{pdfProgress?.label??'PDF hazırlanıyor…'}</Text></View>
            {pdfProgress&&pdfProgress.total>1&&<View style={{height:6,borderRadius:4,overflow:'hidden',backgroundColor:colors.divider}}><View style={{height:6,width:`${Math.min(100,Math.round(pdfProgress.completed/pdfProgress.total*100))}%`,backgroundColor:colors.accent}}/></View>}
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.headingBlock}>
          <Text style={styles.pageTitle}>Ana sayfa</Text>
          <Text style={styles.subtitle}>Notların ve defterlerin, tek bir yerde.</Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Defterlerim</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Tüm defterleri gör" onPress={() => router.navigate('/notebooks')} style={styles.seeAll}>
            <Text style={styles.seeAllText}>Tümü</Text><ChevronRight size={17} color={colors.accent}/>
          </Pressable>
        </View>
        {recentNotebooks.length > 0 ? viewMode === 'grid' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.notebookRow}>
          {recentNotebooks.map(notebook => <Pressable key={notebook.id} accessibilityRole="button" accessibilityLabel={`${notebook.title} defterini a\u00e7`} onPressIn={() => { longPressHandled.current = false; }} onPress={() => notebookPress(notebook.id)} onLongPress={() => notebookLongPress(notebook.id)} delayLongPress={380} accessibilityState={{ selected: selectionKind === 'notebooks' && selectedNotebookIds.includes(notebook.id) }} style={[styles.notebookItem, { width: coverWidth }]}>
            <View style={{width:coverWidth,height:coverWidth*4/3}}><NotebookCover notebook={notebook} width={coverWidth} showTitle={notebook.coverType==='preset'&&notebook.showTitleOnCover} colorsOverride={colors}/>{selectionKind === 'notebooks' && selectedNotebookIds.includes(notebook.id) && <NotebookSelectionMark/>}</View>
            <Text numberOfLines={1} style={styles.notebookTitle}>{notebook.title}</Text>
            <Text style={styles.notebookMeta}>{notebook.pageCount} sayfa</Text>
          </Pressable>)}
        </ScrollView> : <View style={styles.notebookList}>
          {recentNotebooks.map((notebook, index) => <Pressable key={notebook.id} accessibilityRole="button" accessibilityLabel={`${notebook.title} defterini a\u00e7`} onPressIn={() => { longPressHandled.current = false; }} onPress={() => notebookPress(notebook.id)} onLongPress={() => notebookLongPress(notebook.id)} delayLongPress={380} accessibilityState={{ selected: selectionKind === 'notebooks' && selectedNotebookIds.includes(notebook.id) }} style={[styles.notebookListRow, index < recentNotebooks.length - 1 && styles.notebookListDivider]}>
            <View style={{width:48,height:64}}><NotebookCover notebook={notebook} width={48} showTitle={false} colorsOverride={colors}/>{selectionKind === 'notebooks' && selectedNotebookIds.includes(notebook.id) && <NotebookSelectionMark/>}</View>
            <View style={styles.notebookListText}><Text numberOfLines={1} style={styles.notebookTitle}>{notebook.title}</Text><Text style={styles.notebookMeta}>{notebook.pageCount} sayfa · {dateLabel(notebook.updatedAt)}</Text></View>
            <ChevronRight size={18} color={colors.muted}/>
          </Pressable>)}
        </View> : <View style={styles.emptyNotebooks}>
          <Text style={styles.emptyTitle}>Henüz defter yok</Text>
          <Text style={styles.emptyCopy}>Yeni bir defter oluşturarak başlayabilirsin.</Text>
        </View>}

        <View style={styles.notesHeading}><Text style={styles.sectionTitle}>Son açılan defterler</Text></View>
        {recentActivityLoading ? <View style={styles.loading}><ActivityIndicator size="small" color={colors.accent}/></View> : recentOpenedNotebooks.length > 0 ? <View style={styles.notesCard}>
          {recentOpenedNotebooks.map(({ notebook, openedAt }, index) => {
            const selected = selectionKind === 'notebooks' && selectedNotebookIds.includes(notebook.id);
            const openedLabel = openedAt ? dateLabel(openedAt) + ' ' + new Date(openedAt).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : 'Daha önce açıldı';
            return <Pressable key={notebook.id} accessibilityRole="button" accessibilityLabel={notebook.title + ' defterini aç, son açılma ' + openedLabel} onPressIn={() => { longPressHandled.current = false; }} onPress={() => notebookPress(notebook.id)} onLongPress={() => notebookLongPress(notebook.id)} delayLongPress={380} accessibilityState={{ selected }} style={[styles.noteRow, index < recentOpenedNotebooks.length - 1 && styles.noteDivider]}>
              <View style={styles.recentNotebookCover}><NotebookCover notebook={notebook} width={48} showTitle={false} colorsOverride={colors}/>{selected&&<NotebookSelectionMark/>}</View>
              <View style={styles.noteText}>
                <Text numberOfLines={1} style={styles.noteTitle}>{notebook.title}</Text>
                <Text numberOfLines={1} style={styles.noteSubtitle}>{notebook.pageCount} sayfa · Son açılma {openedLabel}</Text>
              </View>
              <ChevronRight size={18} color={colors.muted}/>
            </Pressable>;
          })}
        </View> : <View style={styles.emptyNotes}><Text style={styles.emptyCopy}>Henüz açılmış defter yok. Bir defter açtığında burada görünecek.</Text></View>}
        </ScrollView>

      <Pressable accessibilityRole="button" accessibilityLabel="Yeni defter oluştur" onPress={() => router.push('/notebook-editor')} style={[styles.fab, selectionKind !== null && { display: 'none' }]}><CreateNotebookIcon/></Pressable>
      <SelectionActionBar visible={selectionKind !== null} selectedCount={selectedNotebookIds.length} actions={selectionActions} />
      <Modal visible={confirmNotebookDeleteVisible} transparent animationType="fade" onRequestClose={() => { if (!working) setConfirmNotebookDeleteVisible(false); }}>
        <View style={styles.deleteBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!working) setConfirmNotebookDeleteVisible(false); }}/>
          <View style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>Defterleri sil</Text>
            <Text style={styles.deleteMessage}>{selectedNotebookIds.length} defter Silinenler’e taşınacak ve 30 gün sonra kalıcı olarak silinecek.</Text>
            <View style={styles.deleteActions}>
              <Pressable disabled={working} accessibilityRole="button" onPress={() => setConfirmNotebookDeleteVisible(false)} style={styles.deleteButton}><Text style={styles.deleteCancel}>Vazgeç</Text></Pressable>
              <Pressable disabled={working || selectedNotebookIds.length === 0} accessibilityRole="button" onPress={() => void performNotebookDelete()} style={styles.deleteButton}><Text style={styles.deleteConfirm}>{working ? 'Siliniyor' : 'Sil'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  notebookRow: { gap: 15, paddingRight: 4, paddingBottom: 19 }, notebookItem: { minWidth: 96, position: 'relative' },
  notebookList: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 12, marginBottom: 12 }, notebookListRow: { minHeight: 73, flexDirection: 'row', alignItems: 'center', gap: 12, position: 'relative' }, notebookListDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }, notebookListText: { flex: 1, minWidth: 0 },
  notebookTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, marginTop: 10 }, notebookMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 3 },
  emptyNotebooks: { paddingVertical: 22, paddingHorizontal: 18, backgroundColor: colors.surface, borderRadius: 16, marginBottom: 12 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }, emptyCopy: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 4 },
  notesHeading: { marginTop: 4, marginBottom: 13 }, notesCard: { backgroundColor: colors.surface, borderRadius: 19, paddingHorizontal: 14, paddingVertical: 3, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.045, shadowRadius: 8, elevation: 1 },
  noteRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, position: 'relative' }, noteDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }, recentNotebookCover: { width: 48, height: 64, position: 'relative' },
  pageThumb: { width: 44, height: 56, borderRadius: 7, overflow: 'hidden', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  noteText: { flex: 1, minWidth: 0 }, noteTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }, noteSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 4 }, noteTime: { maxWidth: 56, fontFamily: fonts.body, fontSize: 11, color: colors.muted, textAlign: 'right' },
  loading: { minHeight: 90, justifyContent: 'center', alignItems: 'center' }, emptyNotes: { backgroundColor: colors.surface, borderRadius: 16, padding: 18 },
  selectionOutline: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 1.5, borderColor: '#2F4BFF', borderRadius: 12 }, selectionMark: { position: 'absolute', left: 6, top: 6, width: 21, height: 21, borderRadius: 11, backgroundColor: '#2F4BFF', alignItems: 'center', justifyContent: 'center', zIndex: 4 }, noteSelectionMark: { left: undefined, right: 6 }, selectionCheck: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF', lineHeight: 17 },
  deleteBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.overlay },
  deleteCard: { padding: 22, gap: 14, borderRadius: 20, backgroundColor: colors.surface },
  deleteTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink },
  deleteMessage: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink },
  deleteActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18 },
  deleteButton: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  deleteCancel: { fontFamily: fonts.medium, color: colors.ink },
  deleteConfirm: { fontFamily: fonts.semibold, color: colors.coral },
  undoBanner: { position: 'absolute', bottom: 9, left: 20, right: 20, minHeight: 48, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 4, shadowColor: colors.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8 }, undoBannerAboveToolbar: { bottom: 80 }, undoText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink }, undoAction: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accent },
  fab: { position: 'absolute', right: 16, bottom: 13, width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
}); }
