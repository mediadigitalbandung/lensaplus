import { writeFile, mkdir, unlink } from "fs/promises";
import { dirname } from "path";
import type { StorageDriver, PutObjectInput, PutObjectResult } from "./types";
import { resolveUploadKeyPath } from "../safe-path";

export const localFsDriver: StorageDriver = {
  name: "local-fs",

  async put({ key, bytes }: PutObjectInput): Promise<PutObjectResult> {
    const targetPath = resolveUploadKeyPath(key);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, bytes);
    return { url: `/uploads/${key}` };
  },

  async delete(key: string): Promise<void> {
    const targetPath = resolveUploadKeyPath(key);
    try {
      await unlink(targetPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  },
};
