/**
 * Hook for managing Object URLs with automatic cleanup
 * Prevents memory leaks from URL.createObjectURL / URL.revokeObjectURL
 */

import { useEffect, useRef } from "react";

interface UseObjectURLOptions {
  blob?: Blob | null;
  enabled?: boolean;
}

/**
 * Hook that automatically manages Object URL lifecycle
 * @param blob - Blob to create Object URL from
 * @param enabled - Whether to create the URL (default: true)
 * @returns Object URL string or null
 */
export function useObjectURL(blob?: Blob | null, enabled: boolean = true): string | null {
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!blob || !enabled) {
      // Clean up existing URL if disabling
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      return;
    }

    // Create new URL
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }
    urlRef.current = URL.createObjectURL(blob);

    // Cleanup on unmount or when blob changes
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [blob, enabled]);

  return urlRef.current;
}

/**
 * Hook for managing multiple Object URLs
 * @param blobs - Map of name -> blob
 * @returns Map of name -> URL
 */
export function useObjectURLs(blobs: Record<string, Blob | null>): Record<string, string | null> {
  const urlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const newUrls: Record<string, string | null> = {};

    // Revoke old URLs
    for (const [key, url] of Object.entries(urlsRef.current)) {
      if (!blobs[key]) {
        URL.revokeObjectURL(url);
        delete urlsRef.current[key];
      }
    }

    // Create new URLs
    for (const [key, blob] of Object.entries(blobs)) {
      if (blob && !urlsRef.current[key]) {
        urlsRef.current[key] = URL.createObjectURL(blob);
      } else if (!blob && urlsRef.current[key]) {
        URL.revokeObjectURL(urlsRef.current[key]);
        delete urlsRef.current[key];
      }
      newUrls[key] = urlsRef.current[key] || null;
    }

    return () => {
      for (const url of Object.values(urlsRef.current)) {
        URL.revokeObjectURL(url);
      }
      urlsRef.current = {};
    };
  }, [blobs]);

  return urlsRef.current as Record<string, string | null>;
}

/**
 * Utility function to safely create and manage a single Object URL
 * Usage: const cleanup = createManagedObjectUrl(blob); ... cleanup();
 */
export function createManagedObjectUrl(blob: Blob): { url: string; cleanup: () => void } {
  const url = URL.createObjectURL(blob);
  return {
    url,
    cleanup: () => URL.revokeObjectURL(url),
  };
}
