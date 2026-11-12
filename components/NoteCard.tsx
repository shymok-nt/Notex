import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { NotePreview } from '@/components/NotePreview';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import type { Note } from '@/types/note';

const weekdays=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
const months=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
function dateLabel(iso:string){const d=new Date(iso); const now=new Date();const day=new Date(now.getFullYear(),now.getMonth(),now.getDate());const noteDay=new Date(d.getFullYear(),d.getMonth(),d.getDate());const diff=Math.round((day.getTime()-noteDay.getTime())/86400000);if(diff===0)return 'Bugün';if(diff===1)return 'Dün';if(diff>=2&&diff<7)return weekdays[d.getDay()];return `${d.getDate()} ${months[d.getMonth()]}`;}
export function NoteCard({note,onPress,onLongPress}:{note:Note;onPress:()=>void;onLongPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityLabel={`${note.title}, ${note.folder}; seçenekler için uzun bas`} onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={styles.card}>
 <NotePreview template={note.template}/><View style={styles.titleRow}><Text numberOfLines={1} style={styles.title}>{note.title}</Text>{note.favorite&&<Star size={14} color={colors.accent} fill={colors.highlight}/>}</View><Text style={styles.meta}>{dateLabel(note.updatedAt)} · {note.pageCount} sayfa</Text>
 </Pressable>}
const styles=StyleSheet.create({card:{flex:1,minWidth:0},titleRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:8},title:{flex:1,fontFamily:fonts.semibold,fontSize:15,color:colors.ink},meta:{fontFamily:fonts.body,fontSize:12,color:colors.muted,marginTop:4}});
