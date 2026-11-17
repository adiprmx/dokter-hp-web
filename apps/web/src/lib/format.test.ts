import { describe, expect, it } from "vitest";
import { formatBytes } from "./format";

describe("formatBytes", () => {
  it("memformat byte kecil", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("memformat kilobyte dan megabyte", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
  });

  it("menangani nilai tidak valid", () => {
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});
