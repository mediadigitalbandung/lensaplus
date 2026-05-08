import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import type { StorageDriver, PutObjectInput, PutObjectResult } from "./types";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

export const localFsDriver: StorageDriver = {
  name: "local-fs",

  async put({ key, bytes }: PutObjectInput): Promise<PutObjectResult> {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, key), bytes);
    return { url: `/uploads/${key}` };
  },

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(UPLOAD_DIR, key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  },
};
