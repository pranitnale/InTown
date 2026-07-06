import { useSyncExternalStore } from 'react';

/**
 * PWA install flow (AC #7).
 *
 * Two distinct install paths, unified behind {@link usePwaInstall}:
 *   1. Chromium/Android — the browser fires `beforeinstallprompt`. We capture &
 *      defer that event so the app can trigger the native install sheet on
 *      demand via {@link promptInstall} (instead of the browser's own timing).
 *   2. iOS Safari — has NO `beforeinstallprompt`. The only install path is the
 *      manual "Add to Home Screen" gesture, so we detect iOS + not-already
 *      installed and surface a text nudge (`showIosHint`).
 *
 * The service worker itself is registered by `vite-plugin-pwa` (generateSW,
 * `registerType: 'autoUpdate'`); this module only owns the *install* (A2HS)
 * affordance, which is orthogonal to SW update strategy.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Suppress the browser's mini-infobar; keep the event so we can prompt later.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
  });
}

/** Rough iOS (iPhone/iPad/iPod) detection, excluding IE-mobile false positives. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac but is touch-capable.
  const iPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  const notMSStream = !('MSStream' in window);
  return (iOSDevice || iPadOS) && notMSStream;
}

/** True when running as an installed standalone app (any platform). */
export function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return displayStandalone || iosStandalone;
}

/** Trigger the captured native install prompt. Returns the user's choice. */
export async function promptInstall(): Promise<InstallOutcome> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit();
  return outcome;
}

export interface PwaInstall {
  /** A native install prompt is captured and ready to fire. */
  canInstall: boolean;
  /** Fire the captured native prompt (no-op → 'unavailable' if none). */
  promptInstall: () => Promise<InstallOutcome>;
  isIOS: boolean;
  isStandalone: boolean;
  /** iOS + not installed + no native prompt → show the manual A2HS hint. */
  showIosHint: boolean;
}

export function usePwaInstall(): PwaInstall {
  const canInstall = useSyncExternalStore(
    subscribe,
    () => deferredPrompt !== null,
    () => false,
  );
  const ios = isIOS();
  const standalone = isInStandaloneMode();
  return {
    canInstall,
    promptInstall,
    isIOS: ios,
    isStandalone: standalone,
    showIosHint: ios && !standalone && !canInstall,
  };
}
