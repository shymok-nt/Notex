import { FlatList, StyleSheet, Text, View } from 'react-native';
import { NoteCard } from '@/components/NoteCard';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import type { Note } from '@/types/note';
export function NoteGrid({notes,onOpen,onOptions}:{notes:Note[];onOpen:(id:string)=>void;onOptions:(note:Note)=>void}){
 return <FlatList data={notes} keyExtractor={n=>n.id} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={notes.length?styles.content:styles.emptyContent} renderItem={({item})=><View style={styles.cell}><NoteCard note={item} onPress={()=>onOpen(item.id)} onLongPress={()=>onOptions(item)}/></View>} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Burada henüz not yok</Text><Text style={styles.emptyText}>Yeni not oluşturmak için + butonuna dokun</Text></View>}/>;
}
const styles=StyleSheet.create({row:{gap:14,marginBottom:16},cell:{flex:1,minWidth:0},content:{paddingBottom:120},emptyContent:{flexGrow:1,paddingBottom:120,justifyContent:'center'},empty:{alignItems:'center',paddingHorizontal:12},emptyTitle:{fontFamily:fonts.heading,fontSize:20,color:colors.ink,textAlign:'center'},emptyText:{fontFamily:fonts.body,fontSize:14,color:colors.muted,textAlign:'center',marginTop:10}});
