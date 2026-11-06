import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkUsage } from "../src/lib/request-limits";
import type { SupabaseClient } from "@supabase/supabase-js";
const client = (count = 0, error: unknown = null) => ({ from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ count, error }) }) }) }) }) as unknown as SupabaseClient;
beforeEach(() => { vi.useRealTimers(); });
describe("evaluation usage limits", () => {
  it("rejects an exhausted daily extraction allowance", async () => { expect(await checkUsage(client(50), "daily", "extraction")).toContain("daily"); });
  it("fails closed when usage cannot be read", async () => { expect(await checkUsage(client(0, {}), "error", "upload")).toContain("could not be verified"); });
  it("limits bursts and allows requests after the minute expires", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-06T00:00:00Z"));
    for (let i = 0; i < 10; i++) expect(await checkUsage(client(), "burst", "extraction")).toBeNull();
    expect(await checkUsage(client(), "burst", "extraction")).toContain("Too many");
    vi.advanceTimersByTime(60_001); expect(await checkUsage(client(), "burst", "extraction")).toBeNull();
  });
});
