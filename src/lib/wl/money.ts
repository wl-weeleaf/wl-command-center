export function formatDkk(ore: number | null | undefined) {
  if (ore == null) return "—";
  const kr = ore / 100;
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0,
  }).format(kr);
}

/** 10–20–30: 30 % rabat = 20 % til medlem + 10 % provision til WL. */
export function split103020(originalOre: number) {
  const memberSavingsOre = Math.round(originalOre * 0.2);
  const wlCommissionOre = Math.round(originalOre * 0.1);
  const paidOre = originalOre - memberSavingsOre - wlCommissionOre;
  return { originalOre, paidOre, memberSavingsOre, wlCommissionOre };
}
