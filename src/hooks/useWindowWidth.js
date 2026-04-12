import { useState, useEffect } from 'react';

/**
 * Returns the current window width, updating on resize.
 * Used to switch between mobile cards and desktop table layouts.
 */
export function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    function onResize() { setWidth(window.innerWidth); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return width;
}

/** Convenience: returns true when screen is "mobile" (≤ 768px) */
export function useIsMobile() {
  return useWindowWidth() <= 768;
}
