import {StyleSheet,Text,View} from 'react-native';
import { LibraryDashboard } from '@/components/LibraryDashboard';

export default function Home() {
  return <View style={styles.container}>
    <LibraryDashboard/>
    <View pointerEvents="none" style={styles.overlay}>
      <Text style={styles.hello}>HELLO</Text>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  container:{flex:1},
  overlay:{position:'absolute',top:0,right:0,bottom:0,left:0,alignItems:'center',justifyContent:'center'},
  hello:{fontSize:100,fontWeight:'900',color:'#FF3B30',textAlign:'center'},
});
