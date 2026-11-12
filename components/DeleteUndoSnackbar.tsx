import { useEffect } from 'react';
import { Pressable,Text,View } from 'react-native';
import { useNotebookStore } from '@/store/notebookStore';
import { useTheme } from '@/theme/ThemeProvider';

export function DeleteUndoSnackbar(){
 const {colors}=useTheme();
 const id=useNotebookStore(s=>s.lastDeletedId);
 const clear=useNotebookStore(s=>s.clearUndo);
 const restore=useNotebookStore(s=>s.restoreNotebook);
 useEffect(()=>{if(!id)return;const timer=setTimeout(clear,5500);return()=>clearTimeout(timer)},[id,clear]);
 if(!id)return null;
 return <View pointerEvents="box-none" style={{position:'absolute',bottom:100,left:20,right:20,alignItems:'center'}}>
  <View style={{width:'100%',maxWidth:440,minHeight:54,borderRadius:14,backgroundColor:colors.ink,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
   <Text style={{color:colors.surface,flex:1}}>Defter Silinenler'e taşındı</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="Silmeyi geri al" onPress={()=>{clear();void restore(id).catch(console.error)}} style={{padding:10}}><Text style={{color:colors.highlight,fontWeight:'700'}}>Geri al</Text></Pressable>
  </View>
 </View>;
}
