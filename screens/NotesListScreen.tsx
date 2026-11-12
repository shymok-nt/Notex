import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MoreHorizontal, Plus, Search } from 'lucide-react-native';
import { NoteGrid } from '@/components/NoteGrid';
import { NoteActions } from '@/components/NoteActions';
import { CreateNoteSheet } from '@/components/CreateNoteSheet';
import { useNotesStore } from '@/store/notesStore';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import type { FolderFilter, Note } from '@/types/note';
const folders:FolderFilter[]=['Tümü','Ders','İş','Kişisel'];
export default function NotesListScreen(){
 const notes=useNotesStore(s=>s.notes);const selectedFolder=useNotesStore(s=>s.selectedFolder);const setSelectedFolder=useNotesStore(s=>s.setSelectedFolder);const addNote=useNotesStore(s=>s.addNote);
 const [creating,setCreating]=useState(false);const [selected,setSelected]=useState<Note|null>(null);
 const visible=useMemo(()=>notes.filter(n=>selectedFolder==='Tümü'||n.folder===selectedFolder).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[notes,selectedFolder]);
 return <SafeAreaView style={styles.safe}><View style={styles.body}>
 <View style={styles.top}><Text style={styles.brand}>Notex</Text><View style={styles.topActions}><Pressable accessibilityRole="button" accessibilityLabel="Ara" style={styles.round}><Search size={22} color={colors.ink}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Menü" style={styles.round}><MoreHorizontal size={22} color={colors.ink}/></Pressable></View></View>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{folders.map(folder=><Pressable key={folder} accessibilityRole="button" accessibilityLabel={`${folder} notlarını göster`} accessibilityState={{selected:folder===selectedFolder}} onPress={()=>setSelectedFolder(folder)} style={[styles.chip,folder===selectedFolder&&styles.selectedChip]}><Text style={[styles.chipText,folder===selectedFolder&&styles.selectedChipText]}>{folder}</Text></Pressable>)}</ScrollView>
 <View style={styles.section}><Text style={styles.sectionTitle}>Son notlar</Text><Text style={styles.count}>{visible.length} not</Text></View>
 <View style={styles.list}><NoteGrid notes={visible} onOpen={id=>router.push({pathname:'/note/[id]',params:{id}})} onOptions={setSelected}/></View>
 <Pressable accessibilityRole="button" accessibilityLabel="Yeni not" style={styles.fab} onPress={()=>setCreating(true)}><Plus size={28} strokeWidth={3} color={colors.surface}/></Pressable>
 </View><CreateNoteSheet visible={creating} onClose={()=>setCreating(false)} onCreate={input=>{const id=addNote(input);setCreating(false);router.push({pathname:'/note/[id]',params:{id}})}}/><NoteActions note={selected} onClose={()=>setSelected(null)}/></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},body:{flex:1,paddingHorizontal:20},top:{marginTop:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{fontFamily:fonts.heading,fontSize:32,letterSpacing:-0.64,color:colors.ink},topActions:{flexDirection:'row',gap:10},round:{width:44,height:44,borderRadius:22,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',shadowColor:colors.ink,shadowOpacity:0.06,shadowRadius:6,shadowOffset:{width:0,height:2},elevation:2},filters:{gap:8,alignItems:'center',paddingRight:20},chip:{height:44,paddingHorizontal:18,borderRadius:24,borderWidth:1.5,borderColor:colors.border,alignItems:'center',justifyContent:'center'},selectedChip:{backgroundColor:colors.ink,borderColor:colors.ink},chipText:{fontFamily:fonts.medium,fontSize:14,color:colors.ink},selectedChipText:{fontFamily:fonts.semibold,color:colors.surface},section:{marginTop:24,marginBottom:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sectionTitle:{fontFamily:fonts.heading,fontSize:20,color:colors.ink},count:{fontFamily:fonts.body,fontSize:13,color:colors.muted},list:{flex:1},fab:{position:'absolute',bottom:20,right:20,width:60,height:60,borderRadius:20,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center',shadowColor:colors.accent,shadowOffset:{width:0,height:5},shadowOpacity:0.28,shadowRadius:10,elevation:7}});
