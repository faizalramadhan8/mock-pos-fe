import { describe, it, expect } from "vitest";
import { formatCurrency, genId, genBatchNumber, calcDueDate } from "../index";

describe("formatCurrency", () => {
  it("formats positive number", () => {
    expect(formatCurrency(15000)).toBe("Rp 15.000");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("Rp 0");
  });

  it("formats large number with dots", () => {
    const result = formatCurrency(1500000);
    expect(result).toBe("Rp 1.500.000");
  });
});

describe("genId", () => {
  it("returns a non-empty string", () => {
    const id = genId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 50 }, () => genId()));
    expect(ids.size).toBe(50);
  });
});

describe("genBatchNumber", () => {
  it("matches format B-YYYYMMDD-NNN", () => {
    const batch = genBatchNumber();
    expect(batch).toMatch(/^B-\d{8}-\d{3}$/);
  });

  it("starts with today's date", () => {
    const batch = genBatchNumber();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    expect(batch).toContain(`B-${y}${m}${d}-`);
  });
});

describe("calcDueDate", () => {
  const base = "2026-01-15T00:00:00.000Z";

  it("returns baseDate for COD", () => {
    expect(calcDueDate(base, "COD")).toBe(base);
  });

  it("adds 30 days for NET30", () => {
    const result = new Date(calcDueDate(base, "NET30"));
    expect(result.getDate()).toBe(14); // Jan 15 + 30 = Feb 14
    expect(result.getMonth()).toBe(1); // February
  });

  it("adds 60 days for NET60", () => {
    const result = new Date(calcDueDate(base, "NET60"));
    // Jan 15 + 60 = Mar 16
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(16);
  });

  it("adds 90 days for NET90", () => {
    const result = new Date(calcDueDate(base, "NET90"));
    // Jan 15 + 90 = Apr 15
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(15);
  });
});
