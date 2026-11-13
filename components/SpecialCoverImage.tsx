import {Image,View} from 'react-native';
import type {SpecialCoverId} from '@/theme/covers';
import {fitSpecialCoverImage} from '@/components/specialCoverLayout';

const images={
 aurora:require('../assets/covers/6-aurora-bulanik.png'),
 'art-deco-emerald':require('../assets/covers/7-art-deco-zumrut.png'),
 'y2k-holographic':require('../assets/covers/8-y2k-holografik.png'),
 'lofi-sunset':require('../assets/covers/9-lofi-gunbatimi.png')
} as const;
export function SpecialCoverImage({id,width,height,backgroundColor}:{id:SpecialCoverId;width:number;height:number;backgroundColor:string}){
 const image=fitSpecialCoverImage(width,height);
 return <View pointerEvents="none" style={{position:'absolute',left:0,top:0,width,height,overflow:'hidden',backgroundColor,alignItems:'center',justifyContent:'center'}}>
  <Image source={images[id]} resizeMode="contain" style={{width:image.width,height:image.height}} accessibilityIgnoresInvertColors/>
 </View>;
}
