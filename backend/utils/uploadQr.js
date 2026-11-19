import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

// Generate unique filename
const generateFileName = (extension = "png") => {
  return `${crypto.randomUUID()}.${extension}`;
};

// Save a generated file (Buffer or file-generation callback)
export const saveGeneratedFile = async ({
  folder,
  fileName,
  buffer,
}) => {
  const uploadDir = path.join(UPLOAD_ROOT, folder);

  await fs.mkdir(uploadDir, { recursive: true });

  const finalFileName = fileName || generateFileName();

  const absolutePath = path.join(uploadDir, finalFileName);

  await fs.writeFile(absolutePath, buffer);

  return {
    fileName: finalFileName,
    absolutePath,
    filePath: `uploads/${folder}/${finalFileName}`.replace(/\\/g, "/"),
  };
};

// Save a file received through Multer
export const saveMulterFile = async ({
  file,
  folder,
  extension,
}) => {
  if (!file) {
    throw new Error("File is required");
  }

  const ext = extension || path.extname(file.originalname).slice(1) || "jpg";

  return saveGeneratedFile({
    folder,
    fileName: generateFileName(ext),
    buffer: file.buffer,
  });
};

// Delete a saved file
export const deleteUploadedFile = async (filePath) => {
  if (!filePath) return;

  const absolutePath = path.join(process.cwd(), filePath);

  await fs.unlink(absolutePath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
};