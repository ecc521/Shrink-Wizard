import { describe, it, expect } from "vitest";
import { formatBytes, formatCompactNumber } from "./formatters";

describe("formatBytes", () => {
  it("formats exactly 0 megabytes properly", () => {
    expect(formatBytes(0)).toBe("0 MB");
  });

  it("correctly handles negative values resulting from space restoration", () => {
    expect(formatBytes(-1)).toBe("-1 MB");
    expect(formatBytes(-1024)).toBe("-1.07 GB");
  });

  it("converts correctly across scale boundaries", () => {
    expect(formatBytes(0.001)).toBe("1 KB");
    expect(formatBytes(1)).toBe("1 MB");
    expect(formatBytes(1024)).toBe("1.07 GB");
  });
});

describe("formatCompactNumber", () => {
  it("truncates large integers into human readable strings", () => {
    expect(formatCompactNumber(999)).toBe("999");
    expect(formatCompactNumber(1000)).toBe("1K");
    expect(formatCompactNumber(1500)).toBe("1.5K");
    expect(formatCompactNumber(1000000)).toBe("1M");
  });
});
