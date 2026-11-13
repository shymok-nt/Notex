import { useRef } from 'react';
import { Pressable,Text,View,StyleSheet } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { NotebookCover } from '@/components/NotebookCover';
import { NotebookSelectionMark } from '@/components/NotebookSelectionMark';
import { dateLabel } from '@/utils/notebook';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import type { Notebook,ViewMode } from '@/types/notebook';
export function NotebookCard({notebook,width,viewMode,onOpen,onOptions,onMenu,highlight,selected=false,colorsOverride}:{notebook:Notebook;width:number;viewMode:ViewMode;onOpen:()=>void;onOptions:()=>void;onMenu?:()=>void;highlight?:string;selected?:boolean;colorsOverride?:ThemeColors}){
 const {colors:themeColors}=useTheme();const colors=colorsOverride??themeColors;const styles=makeStyles(colors);
 const longPressed=useRef(false);
 const coverWidth=viewMode==='list'?48:width;
 const query=highlight?.trim()??'';const match=query?notebook.title.toLocaleLowerCase('tr-TR').indexOf(query.toLocaleLowerCase('tr-TR')):-1;
 const label=match<0?notebook.title:<>{notebook.title.slice(0,match)}<Text style={{backgroundColor:colors.highlight,color:'#1B1B2F'}}>{notebook.title.slice(match,match+query.length)}</Text>{notebook.title.slice(match+query.length)}</>;
 return <View style={{position:'relative',minWidth:0}}><Pressable accessibilityRole="button" accessibilityLabel={`${notebook.title} defterini aç`} onPress={()=>{if(longPressed.current){longPressed.current=false;return;}onOpen()}} onPressIn={()=>{longPressed.current=false}} onLongPress={()=>{longPressed.current=true;onOptions()}} delayLongPress={380} style={viewMode==='list'?styles.list:styles.grid}>
 <View style={{width:coverWidth,height:coverWidth*4/3}}><NotebookCover notebook={notebook} width={coverWidth} showTitle={viewMode==='grid'&&notebook.coverType==='preset'&&notebook.showTitleOnCover} colorsOverride={colors}/>{selected&&<NotebookSelectionMark/>}</View><View style={viewMode==='list'?styles.listText:styles.gridText}><Text numberOfLines={1} style={styles.title}>{label}</Text><Text style={styles.meta}>{dateLabel(notebook.updatedAt)} · {notebook.pageCount} sayfa</Text></View>
  </Pressable>
 {!selected&&<Pressable accessibilityRole="button" accessibilityLabel={`${notebook.title} seçenekleri`} onPress={onMenu??onOptions} style={styles.more}><MoreHorizontal size={20} color={colors.ink}/></Pressable>}</View>
}
 const makeStyles=(colors:ThemeColors)=>StyleSheet.create({grid:{minWidth:0},gridText:{paddingTop:11},list:{minHeight:88,flexDirection:'row',alignItems:'center',gap:14,borderBottomWidth:1,borderBottomColor:colors.divider,paddingVertical:10},listText:{flex:1,minWidth:0},title:{fontFamily:fonts.semibold,fontSize:15,color:colors.ink},meta:{fontFamily:fonts.body,fontSize:12,color:colors.muted,marginTop:5},more:{position:'absolute',right:6,top:6,width:40,height:40,borderRadius:20,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',zIndex:8,borderWidth:1,borderColor:colors.divider}});
