"use client";

import { useCallback, useState } from "react";
import { CloudinaryUploadError, uploadToCloudinary, validateImageFile, type CloudinaryUploadResult } from "@/lib/cloudinary";

interface UseCloudinaryUploadOptions {
  folder?: string;
  onError?: (message: string) => void;
}

export function useCloudinaryUpload({ folder, onError }: UseCloudinaryUploadOptions = {}) {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (file: File): Promise<CloudinaryUploadResult | null> => {
      const invalidReason = validateImageFile(file);
      if (invalidReason) {
        onError?.(invalidReason);
        return null;
      }
      setUploading(true);
      try {
        return await uploadToCloudinary(file, folder);
      } catch (err) {
        const message = err instanceof CloudinaryUploadError ? err.message : "Falha ao enviar imagem. Tente de novo.";
        onError?.(message);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [folder, onError]
  );

  const uploadMany = useCallback(
    async (files: File[]): Promise<CloudinaryUploadResult[]> => {
      const results = await Promise.all(files.map((file) => upload(file)));
      return results.filter((r): r is CloudinaryUploadResult => r !== null);
    },
    [upload]
  );

  return { upload, uploadMany, uploading };
}
