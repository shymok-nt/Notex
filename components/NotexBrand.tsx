import { useId, useMemo } from 'react';
import { SvgXml } from 'react-native-svg';
import { notexIconSvg, notexWordmarkSvg } from '@/components/notexBrandAssets';

/**
 * React Navigation keeps screens mounted during transitions. SVG paint-server
 * ids live in the document namespace on web; reusing the same ids across
 * mounted screens can resolve gradients and clip paths against the wrong SVG.
 */
function scopeSvgIds(xml:string,prefix:string):string {
 const ids=[...xml.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
 return ids.reduce((result,id)=>{
  const scoped=prefix+'-'+id;
  return result
   .replaceAll('id="'+id+'"','id="'+scoped+'"')
   .replaceAll('url(#'+id+')','url(#'+scoped+')')
   .replaceAll('href="#'+id+'"','href="#'+scoped+'"');
 },xml);
}

export function NotexIcon({compact}:{compact:boolean}){
 const size=compact?62:72;
 const reactId=useId();
 const xml=useMemo(()=>{
  const source=notexIconSvg.replace('viewBox="0 0 580 560"','viewBox="72 64 472 438"');
  return scopeSvgIds(source,'notex-icon-'+reactId.replace(/[^a-zA-Z0-9_-]/g,''));
 },[reactId]);
 return <SvgXml xml={xml} width={size} height={size*438/472} accessibilityLabel="Notex logosu"/>;
}

export function NotexWordmark({compact,dark=false}:{compact:boolean;dark?:boolean}){
 const width=compact?145:166;
 const reactId=useId();
 const xml=useMemo(()=>{
  const themedSvg=dark?notexWordmarkSvg.replace('fill="#1E293B"','fill="#FFFFFF"').replace('fill="url(#notex2dGrad)"','fill="#FFFFFF"'):notexWordmarkSvg;
  const source=themedSvg.replace('viewBox="0 0 560 200"','viewBox="12 0 536 200"');
  return scopeSvgIds(source,'notex-wordmark-'+reactId.replace(/[^a-zA-Z0-9_-]/g,''));
 },[dark,reactId]);
 return <SvgXml xml={xml} width={width} height={width*200/536} accessibilityLabel="Notex yazı logosu"/>;
}
