/** True when `discounted` is below `price` by no more than `capPct` percent. Both are in the same minor units. */
export function discountAllowed(price: number, discounted: number, capPct: number): boolean {
  if (discounted >= price) return true; // not a discount: the pricing engine ignores it
  return (price - discounted) * 100 <= price * capPct;
}
