import { useEffect } from 'react';
import { Pressable,Text,View } from 'react-native';
import { useNotebookStore } from '@/store/notebookStore';
import { useTheme } from '@/theme/ThemeProvider';

export function DeleteUndoSnackbar(){
 const {colors}=useTheme();
 const ids=useNotebookStore(s=>s.lastDeletedIds);
 const clear=useNotebookStore(s=>s.clearUndo);
 const restoreMany=useNotebookStore(s=>s.restoreNotebooks);
 useEffect(()=>{if(!ids.length)return;const timer=setTimeout(clear,5500);return()=>clearTimeout(timer)},[ids,clear]);
 if(!ids.length)return null;
 return <View pointerEvents="box-none" style={{position:'absolute',bottom:100,left:20,right:20,alignItems:'center'}}>
  <View style={{width:'100%',maxWidth:440,minHeight:54,borderRadius:14,backgroundColor:colors.ink,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
   <Text style={{color:colors.surface,flex:1}}>{ids.length===1?"Defter Silinenler'e ta\u015f\u0131nd\u0131":`${ids.length} defter Silinenler'e ta\u015f\u0131nd\u0131`}</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="Silinen defterleri geri al" onPress={()=>{void restoreMany(ids)}} style={{padding:10}}><Text style={{color:colors.highlight,fontWeight:'700'}}>Geri al</Text></Pressable>
  </View>
 </View>;
}
