import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { StorageDriver, PutObjectInput, PutObjectResult } from "./types";

export const localFsDriver: StorageDriver = {
  name: "local-fs",

  async put({ key, bytes }: PutObjectInput): Promise<PutObjectResult> {
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, key), bytes);
    return { url: `/uploads/${key}` };
  },
};
