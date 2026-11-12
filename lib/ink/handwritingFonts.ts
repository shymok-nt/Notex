import {useFonts} from '@shopify/react-native-skia';

export const HANDWRITING_FONT_FILES={
 Caveat:require('../../assets/fonts/Caveat-VariableFont_wght.ttf'),
 PatrickHand:require('../../assets/fonts/PatrickHand-Regular.ttf'),
 DancingScript:require('../../assets/fonts/DancingScript-VariableFont_wght.ttf'),
} as const;
export const AVAILABLE_HANDWRITING_FONTS=['Caveat','PatrickHand','DancingScript'] as const;
/** Lightweight font-manager hook for legacy beautified words. */
export function useHandwritingFontFamilies(){
 return useFonts({
  Caveat:[HANDWRITING_FONT_FILES.Caveat],
  PatrickHand:[HANDWRITING_FONT_FILES.PatrickHand],
  DancingScript:[HANDWRITING_FONT_FILES.DancingScript],
 });
}
