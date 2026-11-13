import { describe, expect, it } from "vitest";
import { tamanoLegible } from "../../lib/tamano-legible";

describe("tamanoLegible", () => {
  it("enseña megas con un decimal y coma en español", () => {
    expect(tamanoLegible(2_000_000)).toBe("2,0 MB");
    expect(tamanoLegible(2_400_000, "es")).toBe("2,4 MB");
  });
  it("usa punto en inglés", () => {
    expect(tamanoLegible(2_400_000, "en")).toBe("2.4 MB");
  });
  it("KB y B sin decimales", () => {
    expect(tamanoLegible(850_000)).toBe("850 KB");
    expect(tamanoLegible(512)).toBe("512 B");
  });
  it("GB y valores raros", () => {
    expect(tamanoLegible(1_250_000_000)).toBe("1,3 GB");
    expect(tamanoLegible(0)).toBe("0 B");
    expect(tamanoLegible(NaN)).toBe("0 B");
    expect(tamanoLegible(-5)).toBe("0 B");
  });
});
