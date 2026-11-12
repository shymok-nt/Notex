import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import { useNotesStore } from '@/store/notesStore';
import type { Note } from '@/types/note';
export function NoteActions({note,onClose}:{note:Note|null;onClose:()=>void}){
 const [renaming,setRenaming]=useState(false);const [title,setTitle]=useState('');const rename=useNotesStore(s=>s.renameNote);const remove=useNotesStore(s=>s.deleteNote);const toggle=useNotesStore(s=>s.toggleFavorite);
 const close=()=>{setRenaming(false);onClose()};
 return <Modal transparent animationType="fade" visible={!!note} onRequestClose={close}><Pressable style={styles.overlay} onPress={close}><Pressable style={styles.panel} onPress={()=>{}}>
 <Text style={styles.heading}>{note?.title}</Text>
 {renaming?<><TextInput accessibilityLabel="Yeni not adı" autoFocus value={title} onChangeText={setTitle} style={styles.input}/><Pressable accessibilityRole="button" accessibilityLabel="Adı kaydet" style={styles.action} onPress={()=>{if(note&&title.trim())rename(note.id,title.trim());close()}}><Text style={styles.actionText}>Kaydet</Text></Pressable></>:<>
 <Pressable accessibilityRole="button" accessibilityLabel="Yeniden adlandır" style={styles.action} onPress={()=>{setTitle(note?.title??'');setRenaming(true)}}><Text style={styles.actionText}>Yeniden adlandır</Text></Pressable>
 <Pressable accessibilityRole="button" accessibilityLabel={note?.favorite?'Favoriden çıkar':'Favorilere ekle'} style={styles.action} onPress={()=>{if(note)toggle(note.id);close()}}><Text style={styles.actionText}>{note?.favorite?'Favoriden çıkar':'Favorilere ekle'}</Text></Pressable>
 <Pressable accessibilityRole="button" accessibilityLabel="Notu sil" style={styles.action} onPress={()=>{const id=note?.id;close();if(id)Alert.alert('Not silinsin mi?','Bu işlem geri alınamaz.',[{text:'Vazgeç',style:'cancel'},{text:'Sil',style:'destructive',onPress:()=>remove(id)}])}}><Text style={[styles.actionText,{color:colors.coral}]}>Sil</Text></Pressable></>}
 <Pressable accessibilityRole="button" accessibilityLabel="Kapat" style={styles.action} onPress={close}><Text style={styles.cancel}>Vazgeç</Text></Pressable>
 </Pressable></Pressable></Modal>
}
const styles=StyleSheet.create({overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'#0007'},panel:{backgroundColor:colors.surface,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,paddingBottom:44},heading:{fontFamily:fonts.heading,fontSize:20,color:colors.ink,marginBottom:12},action:{minHeight:48,justifyContent:'center',borderBottomWidth:1,borderBottomColor:colors.divider},actionText:{fontFamily:fonts.medium,fontSize:16,color:colors.ink},cancel:{fontFamily:fonts.medium,color:colors.muted,fontSize:16},input:{borderWidth:1,borderColor:colors.border,borderRadius:12,padding:12,fontFamily:fonts.body,fontSize:16,color:colors.ink}});
