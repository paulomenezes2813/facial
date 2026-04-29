'use client';

import { useCallback, useEffect, useState } from 'react';

/** Hook simples para Fullscreen API (com fallback silencioso). */
export function useFullscreen() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    function onChange() {
      setIsFs(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const enter = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* alguns browsers/contextos não permitem */
    }
  }, []);

  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => (isFs ? exit() : enter()), [isFs, enter, exit]);

  return { isFs, enter, exit, toggle };
}
