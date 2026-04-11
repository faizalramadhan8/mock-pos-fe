import type { CartItem, DiscountType } from "@/types";

export function calcItemDiscount(ci: CartItem): number {
  if (!ci.discountType || !ci.discountValue) return 0;
  const gross = ci.unitPrice * ci.quantity;
  return ci.discountType === "percent"
    ? Math.round(gross * ci.discountValue / 100)
    : Math.min(ci.discountValue, gross);
}

export function calcOrderTotal(params: {
  items: CartItem[];
  orderDiscountType: DiscountType | null;
  orderDiscountValue: number;
  ppnRate: number;
}) {
  const { items, orderDiscountType, orderDiscountValue, ppnRate } = params;
  const cartSubtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const itemDiscountsTotal = items.reduce((s, i) => s + calcItemDiscount(i), 0);
  const cartSubtotalAfterItemDisc = cartSubtotal - itemDiscountsTotal;
  const orderDiscAmount = !orderDiscountType || !orderDiscountValue ? 0
    : orderDiscountType === "percent"
      ? Math.round(cartSubtotalAfterItemDisc * orderDiscountValue / 100)
      : Math.min(orderDiscountValue, cartSubtotalAfterItemDisc);
  const discountedSubtotal = cartSubtotalAfterItemDisc - orderDiscAmount;
  const ppnAmount = Math.round(discountedSubtotal * ppnRate / 100);
  const cartTotal = discountedSubtotal + ppnAmount;
  return { cartSubtotal, itemDiscountsTotal, orderDiscAmount, discountedSubtotal, ppnAmount, cartTotal };
}
