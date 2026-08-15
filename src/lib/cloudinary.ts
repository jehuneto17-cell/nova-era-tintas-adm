import imageCompression from "browser-image-compression";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export class CloudinaryUploadError extends Error {}

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Formato não aceito. Envie JPG, PNG ou WEBP.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Arquivo maior que 10MB.";
  }
  return null;
}

async function compressImage(file: File): Promise<File> {
  if (file.size <= 1.5 * 1024 * 1024) return file;
  try {
    return await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
      fileType: file.type,
    });
  } catch {
    return file;
  }
}

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export async function uploadToCloudinary(file: File, folder?: string): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new CloudinaryUploadError("Cloudinary não configurado. Defina NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME e NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.");
  }

  const invalidReason = validateImageFile(file);
  if (invalidReason) {
    throw new CloudinaryUploadError(invalidReason);
  }

  const compressed = await compressImage(file);

  const formData = new FormData();
  formData.append("file", compressed);
  formData.append("upload_preset", uploadPreset);
  if (folder) formData.append("folder", folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new CloudinaryUploadError("Falha ao enviar imagem. Tente de novo.");
  }

  const data = await response.json();
  return { url: data.secure_url as string, publicId: data.public_id as string, width: data.width as number, height: data.height as number };
}
