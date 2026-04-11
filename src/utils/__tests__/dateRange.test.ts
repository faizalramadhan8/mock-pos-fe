import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getDateRange } from "../dateRange";

describe("getDateRange", () => {
  beforeEach(() => {
    // Fix "now" to 2026-02-23 14:30:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 23, 14, 30, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for 'all'", () => {
    expect(getDateRange("all")).toBeNull();
  });

  it("returns today's start and end", () => {
    const result = getDateRange("today")!;
    expect(result.start.getFullYear()).toBe(2026);
    expect(result.start.getMonth()).toBe(1);
    expect(result.start.getDate()).toBe(23);
    expect(result.start.getHours()).toBe(0);
    expect(result.end.getDate()).toBe(23);
    expect(result.end.getHours()).toBe(23);
    expect(result.end.getMinutes()).toBe(59);
  });

  it("returns yesterday's start and end", () => {
    const result = getDateRange("yesterday")!;
    expect(result.start.getDate()).toBe(22);
    expect(result.start.getHours()).toBe(0);
    expect(result.end.getDate()).toBe(22);
    expect(result.end.getHours()).toBe(23);
  });

  it("returns start of week (Sunday) to now", () => {
    // Feb 23, 2026 is a Monday, so start of week = Sunday Feb 22
    const result = getDateRange("week")!;
    expect(result.start.getDate()).toBe(22);
    expect(result.start.getDay()).toBe(0); // Sunday
    expect(result.end.getDate()).toBe(23);
  });

  it("returns start of month to now", () => {
    const result = getDateRange("month")!;
    expect(result.start.getDate()).toBe(1);
    expect(result.start.getMonth()).toBe(1); // February
    expect(result.end.getDate()).toBe(23);
  });
});
