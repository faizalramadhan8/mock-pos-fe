import { describe, it, expect } from "vitest";
import { kelasMember } from "@/types";
import { tierBerlaku } from "@/utils";
import type { ProductPriceTier } from "@/types";

describe("kelasMember", () => {
  it("ikut patokan poin kalau tidak dikunci", () => {
    expect(kelasMember({ points: 0 })).toBeNull();
    expect(kelasMember({ points: 4 })).toBeNull();
    expect(kelasMember({ points: 5 })).toBe("silver");
    expect(kelasMember({ points: 9 })).toBe("silver");
    expect(kelasMember({ points: 10 })).toBe("gold");
    expect(kelasMember({ points: 19 })).toBe("gold");
    expect(kelasMember({ points: 20 })).toBe("platinum");
  });

  it("kunci manual menang atas poin", () => {
    expect(kelasMember({ memberClass: "silver", points: 30 })).toBe("silver");
    expect(kelasMember({ memberClass: "platinum", points: 0 })).toBe("platinum");
  });

  it("tier kelas berlaku untuk member otomatis", () => {
    const tier = { id: "t", minQty: 1, price: 1, target: "class_gold" } as unknown as ProductPriceTier;
    expect(tierBerlaku(tier, { id: "m", points: 12 }, 1)).toBe(true);
    expect(tierBerlaku(tier, { id: "m", points: 25 }, 1)).toBe(false);
    expect(tierBerlaku(tier, { id: "m", points: 25, memberClass: "gold" }, 1)).toBe(true);
  });
});
