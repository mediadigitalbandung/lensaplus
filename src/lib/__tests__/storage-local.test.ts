import { describe, it, expect, beforeEach, vi } from "vitest";

const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();

vi.mock("fs/promises", () => ({
  default: {
    mkdir: (...a: unknown[]) => mockMkdir(...a),
    writeFile: (...a: unknown[]) => mockWriteFile(...a),
  },
  mkdir: (...a: unknown[]) => mockMkdir(...a),
  writeFile: (...a: unknown[]) => mockWriteFile(...a),
}));

import { localFsDriver } from "../storage/local-fs";
import { getStorageDriver } from "../storage";

describe("localFsDriver.put", () => {
  beforeEach(() => {
    mockMkdir.mockReset();
    mockWriteFile.mockReset();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("writes bytes under public/uploads and returns a /uploads/<key> URL", async () => {
    const result = await localFsDriver.put({
      key: "image.jpg",
      contentType: "image/jpeg",
      bytes: Buffer.from([1, 2, 3]),
    });
    expect(result.url).toBe("/uploads/image.jpg");
    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockMkdir.mock.calls[0][1]).toEqual({ recursive: true });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    // Path argument should end with the key.
    const writePath = String(mockWriteFile.mock.calls[0][0]);
    expect(writePath.endsWith("image.jpg")).toBe(true);
  });

  it("propagates errors from the filesystem layer", async () => {
    mockWriteFile.mockRejectedValueOnce(new Error("EACCES"));
    await expect(
      localFsDriver.put({
        key: "denied.bin",
        contentType: "application/octet-stream",
        bytes: Buffer.alloc(0),
      }),
    ).rejects.toThrow("EACCES");
  });

  it("driver name is 'local-fs' (used by audit logs)", () => {
    expect(localFsDriver.name).toBe("local-fs");
  });
});

describe("getStorageDriver", () => {
  it("returns the local FS driver by default", () => {
    expect(getStorageDriver()).toBe(localFsDriver);
  });
});
