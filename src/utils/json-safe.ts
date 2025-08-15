// utils/json-safe.ts
export function jsonPrismaSafe(v: any): any {
  // For JSON columns: remove bigint & wrapper objects
  if (v === null || v === undefined) return v;
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(jsonPrismaSafe);
  if (typeof v === 'object') {
    // unwrap { $type: "BigInt", value: "..." }
    if (v.$type === 'BigInt' && typeof v.value === 'string') return v.value;
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, jsonPrismaSafe(val)]));
  }
  return v;
}

export const toDbBigInt = (v: string | number | bigint | null | undefined) =>
  v == null ? null : BigInt(String(v));

