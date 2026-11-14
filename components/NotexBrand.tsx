import { SvgXml } from 'react-native-svg';
import { notexIconSvg, notexWordmarkSvg } from '@/components/notexBrandAssets';

export function NotexIcon({compact}:{compact:boolean}){
 const size=compact?48:58;
 return <SvgXml xml={notexIconSvg} width={size} height={size} accessibilityLabel="Notex logosu"/>;
}

export function NotexWordmark({compact,dark=false}:{compact:boolean;dark?:boolean}){
 const width=compact?103:121;
 // Keep the supplied wordmark intact; its original dark ink and gradient x are intentional.
 void dark;
 return <SvgXml xml={notexWordmarkSvg} width={width} height={width*200/560} accessibilityLabel="Notex yazı logosu"/>;
}
