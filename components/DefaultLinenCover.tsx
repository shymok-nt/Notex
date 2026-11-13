import { Image, View } from 'react-native';

const linenImages: Record<string, number> = {
  '#1B1B2F': require('../assets/covers/default-linen/linen-1b1b2f.png'),
  '#3347D9': require('../assets/covers/default-linen/linen-3347d9.png'),
  '#1C9A8E': require('../assets/covers/default-linen/linen-1c9a8e.png'),
  '#3E8E5A': require('../assets/covers/default-linen/linen-3e8e5a.png'),
  '#F2B632': require('../assets/covers/default-linen/linen-f2b632.png'),
  '#F28C38': require('../assets/covers/default-linen/linen-f28c38.png'),
  '#FF6B5A': require('../assets/covers/default-linen/linen-ff6b5a.png'),
  '#E58FB0': require('../assets/covers/default-linen/linen-e58fb0.png'),
  '#7B5CD6': require('../assets/covers/default-linen/linen-7b5cd6.png'),
  '#6B6A78': require('../assets/covers/default-linen/linen-6b6a78.png'),
  '#E9DFC9': require('../assets/covers/default-linen/linen-e9dfc9.png'),
  '#111111': require('../assets/covers/default-linen/linen-111111.png'),
};

export function DefaultLinenCover({ color, width, height }: { color: string; width: number; height: number }) {
  const image = linenImages[color.toUpperCase()];
  if (!image) return null;
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
    <Image source={image} resizeMode="contain" style={{ width, height }} accessibilityIgnoresInvertColors />
  </View>;
}
