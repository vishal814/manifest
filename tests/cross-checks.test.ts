import { describe, expect, it } from "vitest";
import { compareGrossWeights, grossWeightKg } from "../src/lib/cross-checks";

describe("shipment gross weight check", () => {
  it("reports the 45 kg difference across the sample documents", () => {
    expect(compareGrossWeights(["3120", "3,165 kg", "3120.00"].map(grossWeightKg)))
      .toEqual({ status: "mismatch", difference: 45 });
  });

  it("accepts equivalent weight formats", () => {
    expect(compareGrossWeights(["3,120 kg", "3.12 tonnes", "3120000 g"].map(grossWeightKg)).status)
      .toBe("match");
  });

  it("keeps equal but incomplete documents pending", () => {
    expect(compareGrossWeights([3120, 3120, null]).status).toBe("pending");
  });

  it("does not mistake blank values, malformed weights or other units for kg", () => {
    expect(["", "3,12", "3120 oz", "-4"].map(grossWeightKg)).toEqual([null, null, null, null]);
  });
});
