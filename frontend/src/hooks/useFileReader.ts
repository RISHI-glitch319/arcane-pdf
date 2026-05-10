/**
 * Hook for optimized FileReader operations
 * Provides clean, reusable FileReader patterns with proper cleanup
 */

import { useCallback, useRef } from "react";
import { readFileAsArrayBuffer, toUint8Array } from "@/utils/binaryHandling";

interface UseFileReaderOptions {
  onSuccess?: (data: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for reading files as ArrayBuffer
 */
export function useFileReader(options: UseFileReaderOptions = {}) {
  const readerRef = useRef<FileReader | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const readAsArrayBuffer = useCallback(
    async (file: File | Blob): Promise<ArrayBuffer> => {
      try {
        const result = await readFileAsArrayBuffer(file);
        options.onSuccess?.(result);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        options.onError?.(err);
        throw err;
      }
    },
    [options]
  );

  const readAsUint8Array = useCallback(
    async (file: File | Blob): Promise<Uint8Array> => {
      try {
        const buffer = await readFileAsArrayBuffer(file);
        const result = await toUint8Array(buffer);
        options.onSuccess?.(buffer);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        options.onError?.(err);
        throw err;
      }
    },
    [options]
  );

  return {
    readAsArrayBuffer,
    readAsUint8Array,
  };
}

/**
 * Hook for reading multiple files
 */
export function useMultipleFileReader(options: UseFileReaderOptions = {}) {
  const fileReaderRef = useRef<FileReader | null>(null);

  const readFiles = useCallback(
    async (files: File[] | FileList): Promise<ArrayBuffer[]> => {
      try {
        const results = await Promise.all(
          Array.from(files).map((file) => readFileAsArrayBuffer(file))
        );
        return results;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        options.onError?.(err);
        throw err;
      }
    },
    [options]
  );

  return { readFiles };
}

/**
 * Hook for streaming file data (chunked reading)
 */
export function useChunkedFileReader(options: UseFileReaderOptions = {}) {
  const readChunked = useCallback(
    async (file: File, chunkSize: number = 1024 * 1024): Promise<ArrayBuffer[]> => {
      const chunks: ArrayBuffer[] = [];
      const totalChunks = Math.ceil(file.size / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        try {
          const buffer = await readFileAsArrayBuffer(chunk);
          chunks.push(buffer);
        } catch (error) {
          const err = error instanceof Error ? error : new Error("Unknown error");
          options.onError?.(err);
          throw err;
        }
      }

      return chunks;
    },
    [options]
  );

  return { readChunked };
}
