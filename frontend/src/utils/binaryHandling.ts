/**
 * Binary Data Handling Utilities
 * Provides type-safe operations for ArrayBuffer, Blob, and binary data conversions
 * Ensures compatibility with browser APIs and prevents type errors
 */

export type BinaryData = ArrayBuffer | Blob | Uint8Array | File;

/**
 * Normalizes any binary data type to ArrayBuffer
 * @param data - Binary data to normalize
 * @returns Promise resolving to ArrayBuffer
 */
export async function normalizeToArrayBuffer(data: BinaryData): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) {
    return data;
  }

  if (data instanceof Uint8Array) {
    // Handle both ArrayBuffer and SharedArrayBuffer
    const buffer = data.buffer;
    if (buffer instanceof SharedArrayBuffer) {
      // Convert SharedArrayBuffer to ArrayBuffer
      return new Uint8Array(data).buffer as ArrayBuffer;
    }
    return buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }

  if (data instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          reject(new Error("FileReader did not return ArrayBuffer"));
        }
      };
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsArrayBuffer(data);
    });
  }

  throw new Error(`Unsupported binary data type: ${typeof data}`);
}

/**
 * Converts binary data to Uint8Array
 * @param data - Binary data to convert
 * @returns Promise resolving to Uint8Array
 */
export async function toUint8Array(data: BinaryData): Promise<Uint8Array> {
  const buffer = await normalizeToArrayBuffer(data);
  return new Uint8Array(buffer);
}

/**
 * Converts binary data to Blob
 * @param data - Binary data to convert
 * @param mimeType - MIME type for the blob
 * @returns Promise resolving to Blob
 */
export async function toBlob(data: BinaryData, mimeType: string = "application/octet-stream"): Promise<Blob> {
  if (data instanceof Blob) {
    return mimeType && data.type !== mimeType ? new Blob([data], { type: mimeType }) : data;
  }

  const buffer = await normalizeToArrayBuffer(data);
  return new Blob([buffer], { type: mimeType });
}

/**
 * Type guard for ArrayBuffer
 */
export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

/**
 * Type guard for Blob
 */
export function isBlob(value: unknown): value is Blob {
  return value instanceof Blob;
}

/**
 * Type guard for Uint8Array
 */
export function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

/**
 * Type guard for File
 */
export function isFile(value: unknown): value is File {
  return value instanceof File;
}

/**
 * Validates FileReader result and returns ArrayBuffer
 * @throws Error if result is not an ArrayBuffer
 */
export function validateFileReaderResult(result: string | ArrayBuffer | null): ArrayBuffer {
  if (result === null) {
    throw new Error("FileReader result is null");
  }

  if (typeof result === "string") {
    throw new Error("FileReader returned string instead of ArrayBuffer");
  }

  if (!isArrayBuffer(result)) {
    throw new Error("FileReader result is not an ArrayBuffer");
  }

  return result;
}

/**
 * Safe FileReader wrapper with proper error handling
 */
export function readFileAsArrayBuffer(file: Blob | File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const result = validateFileReaderResult(e.target?.result ?? null);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("FileReader encountered an error"));
    };

    reader.onabort = () => {
      reject(new Error("FileReader was aborted"));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Downloads binary data as a file
 * @param data - Binary data to download
 * @param filename - Name for the downloaded file
 * @param mimeType - MIME type for the blob
 */
export async function downloadBinaryData(
  data: BinaryData,
  filename: string,
  mimeType: string = "application/octet-stream"
): Promise<void> {
  const blob = await toBlob(data, mimeType);
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Always revoke the URL to prevent memory leaks
    URL.revokeObjectURL(url);
  }
}

/**
 * Creates a reusable ObjectURL with automatic cleanup
 * Usage: const cleanup = createManagedObjectUrl(blob); ... cleanup();
 */
export function createManagedObjectUrl(blob: Blob): { url: string; cleanup: () => void } {
  const url = URL.createObjectURL(blob);
  return {
    url,
    cleanup: () => URL.revokeObjectURL(url),
  };
}

/**
 * Base64 encoding/decoding for binary data
 */
export const Base64 = {
  encode(data: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(data)));
  },

  decode(str: string): Uint8Array {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  },
};
