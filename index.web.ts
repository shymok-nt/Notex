import '@expo/metro-runtime';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// Keep Expo Router modules statically registered with Metro. Dynamic import()
// here causes "Requiring unknown module <id>" in the development bundle.
// Rendering is deferred until CanvasKit has finished initializing.
LoadSkiaWeb({ locateFile: (file: string) => `/${file}` })
  .then(() => {
    renderRootComponent(App);
  })
  .catch((error: unknown) => {
    console.error('CanvasKit web initialization failed:', error);
    const root = document.getElementById('root');
    if (root) {
      const detail = error instanceof Error ? error.message : String(error);
      root.textContent = `Çizim motoru başlatılamadı: ${detail}`;
    }
  });
