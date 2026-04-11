import { describe, it, expect } from "vitest";
import { calcItemDiscount, calcOrderTotal } from "../calc";
import type { CartItem } from "@/types";

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "t1", productId: "p1", name: "Test", category: "flour",
    image: "", quantity: 2, unitType: "individual", unitPrice: 10000,
    qtyPerBox: 12, unit: "kg",
    ...overrides,
  };
}

describe("calcItemDiscount", () => {
  it("returns 0 when no discount", () => {
    expect(calcItemDiscount(makeItem())).toBe(0);
  });

  it("calculates percent discount", () => {
    const item = makeItem({ discountType: "percent", discountValue: 10 });
    // gross = 10000 * 2 = 20000, 10% = 2000
    expect(calcItemDiscount(item)).toBe(2000);
  });

  it("calculates fixed discount", () => {
    const item = makeItem({ discountType: "fixed", discountValue: 3000 });
    expect(calcItemDiscount(item)).toBe(3000);
  });

  it("caps fixed discount at gross amount", () => {
    const item = makeItem({ discountType: "fixed", discountValue: 999999 });
    // gross = 20000, discount capped
    expect(calcItemDiscount(item)).toBe(20000);
  });

  it("returns 0 when discountValue is 0", () => {
    const item = makeItem({ discountType: "percent", discountValue: 0 });
    expect(calcItemDiscount(item)).toBe(0);
  });

  it("handles quantity of 1", () => {
    const item = makeItem({ quantity: 1, discountType: "percent", discountValue: 50 });
    // gross = 10000 * 1 = 10000, 50% = 5000
    expect(calcItemDiscount(item)).toBe(5000);
  });
});

describe("calcOrderTotal", () => {
  it("calculates with no discounts", () => {
    const result = calcOrderTotal({
      items: [makeItem()],
      orderDiscountType: null,
      orderDiscountValue: 0,
      ppnRate: 0,
    });
    expect(result.cartSubtotal).toBe(20000);
    expect(result.itemDiscountsTotal).toBe(0);
    expect(result.orderDiscAmount).toBe(0);
    expect(result.cartTotal).toBe(20000);
  });

  it("calculates with item discount only", () => {
    const result = calcOrderTotal({
      items: [makeItem({ discountType: "percent", discountValue: 10 })],
      orderDiscountType: null,
      orderDiscountValue: 0,
      ppnRate: 0,
    });
    expect(result.cartSubtotal).toBe(20000);
    expect(result.itemDiscountsTotal).toBe(2000);
    expect(result.cartTotal).toBe(18000);
  });

  it("calculates with order percent discount", () => {
    const result = calcOrderTotal({
      items: [makeItem()],
      orderDiscountType: "percent",
      orderDiscountValue: 5,
      ppnRate: 0,
    });
    expect(result.orderDiscAmount).toBe(1000); // 5% of 20000
    expect(result.cartTotal).toBe(19000);
  });

  it("calculates with order fixed discount", () => {
    const result = calcOrderTotal({
      items: [makeItem()],
      orderDiscountType: "fixed",
      orderDiscountValue: 5000,
      ppnRate: 0,
    });
    expect(result.orderDiscAmount).toBe(5000);
    expect(result.cartTotal).toBe(15000);
  });

  it("calculates combined item + order discounts", () => {
    const result = calcOrderTotal({
      items: [makeItem({ discountType: "fixed", discountValue: 2000 })],
      orderDiscountType: "percent",
      orderDiscountValue: 10,
      ppnRate: 0,
    });
    // subtotal=20000, itemDisc=2000, after=18000, orderDisc=10%=1800
    expect(result.itemDiscountsTotal).toBe(2000);
    expect(result.orderDiscAmount).toBe(1800);
    expect(result.cartTotal).toBe(16200);
  });

  it("calculates PPN correctly", () => {
    const result = calcOrderTotal({
      items: [makeItem()],
      orderDiscountType: null,
      orderDiscountValue: 0,
      ppnRate: 11,
    });
    // 20000 * 11% = 2200
    expect(result.ppnAmount).toBe(2200);
    expect(result.cartTotal).toBe(22200);
  });

  it("applies PPN after all discounts", () => {
    const result = calcOrderTotal({
      items: [makeItem({ discountType: "percent", discountValue: 50 })],
      orderDiscountType: null,
      orderDiscountValue: 0,
      ppnRate: 10,
    });
    // subtotal=20000, itemDisc=10000, after=10000, ppn=1000
    expect(result.discountedSubtotal).toBe(10000);
    expect(result.ppnAmount).toBe(1000);
    expect(result.cartTotal).toBe(11000);
  });

  it("handles multiple items", () => {
    const result = calcOrderTotal({
      items: [makeItem(), makeItem({ unitPrice: 5000, quantity: 4 })],
      orderDiscountType: null,
      orderDiscountValue: 0,
      ppnRate: 0,
    });
    // 20000 + 20000 = 40000
    expect(result.cartSubtotal).toBe(40000);
    expect(result.cartTotal).toBe(40000);
  });

  it("handles empty items", () => {
    const result = calcOrderTotal({
      items: [],
      orderDiscountType: null,
      orderDiscountValue: 0,
      ppnRate: 11,
    });
    expect(result.cartTotal).toBe(0);
  });
});
