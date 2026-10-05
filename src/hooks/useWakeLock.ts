/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

/**
 * Requests a screen Wake Lock while `active` is true and releases it on
 * stop/unmount. Re-acquires automatically when the tab becomes visible again
 * (browsers release the lock when the page is hidden). Fails gracefully on
 * unsupported browsers or when the permission is denied.
 */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let cancelled = false;

    const requestLock = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // Wake Lock unavailable or permission denied — non-critical, fail silently.
      }
    };

    requestLock();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !sentinelRef.current) {
        requestLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [active]);
}
