// Static category → festival/season mapping for Trend & Forecasting.
// Keep small and honest; surfaced as "upcoming season reminder" only.

export type SeasonalOccasion = {
  occasion: string;
  // Inclusive month numbers (1-12) when demand peaks.
  peakMonths: number[];
  note: string;
};

// Keep keys aligned with `categories` in packages/shared (minus "Other").
export const seasonalMap: Record<string, SeasonalOccasion[]> = {
  'Pottery & Terracotta': [
    { occasion: 'Diwali — diyas & festive decor', peakMonths: [10, 11], note: 'Diyas and festive pottery peak around Diwali.' },
    { occasion: 'Summer — matkas & coolers', peakMonths: [4, 5, 6], note: 'Earthen matkas and coolers in hot months.' },
  ],
  'Handloom & Weaving': [
    { occasion: 'Wedding season', peakMonths: [10, 11, 12, 1, 2], note: 'Sarees and yardage for weddings.' },
    { occasion: 'Diwali gifting', peakMonths: [10, 11], note: 'Festive gifting uptick.' },
  ],
  'Embroidery & Textile Art': [
    { occasion: 'Wedding & festive season', peakMonths: [9, 10, 11, 12, 1, 2], note: 'Embroidered wear for celebrations.' },
  ],
  'Wood Carving & Woodwork': [
    { occasion: 'Housewarming & Diwali', peakMonths: [9, 10, 11], note: 'Decor pieces for new homes and festivals.' },
  ],
  'Metal & Brass Craft': [
    { occasion: 'Diwali & wedding gifts', peakMonths: [10, 11, 12, 1], note: 'Brassware gifting season.' },
  ],
  'Jewelry & Beadwork': [
    { occasion: 'Wedding & festive season', peakMonths: [9, 10, 11, 12, 1, 2], note: 'Bridal and festive jewelry demand.' },
  ],
  'Bamboo & Cane Craft': [
    { occasion: 'Monsoon & harvest decor', peakMonths: [7, 8, 9], note: 'Light, airy pieces for the season.' },
  ],
  'Stone & Marble Craft': [
    { occasion: 'Housewarming & Diwali', peakMonths: [10, 11], note: 'Decor and gift pieces.' },
  ],
  'Folk Painting & Art': [
    { occasion: 'Diwali & cultural fairs', peakMonths: [10, 11, 12, 2, 3], note: 'Art fairs and festive decor.' },
  ],
  'Leather Craft': [
    { occasion: 'Winter & gifting season', peakMonths: [10, 11, 12, 1], note: 'Bags and accessories for travel and gifts.' },
  ],
};

/** Return occasions relevant to seller's categories that start within next 6 weeks (42 days). */
export function upcomingSeasonReminders(categories: string[], now = new Date()): Array<{ category: string; occasion: string; note: string; monthsUntilPeak: number }> {
  const nowMonth = now.getMonth() + 1;
  const out: Array<{ category: string; occasion: string; note: string; monthsUntilPeak: number }> = [];
  const uniq = [...new Set(categories.filter(c => c && c !== 'Other'))];
  for (const cat of uniq) {
    const occasions = seasonalMap[cat];
    if (!occasions) continue;
    for (const oc of occasions) {
      // Distance to next occurrence of any peak month.
      let best = 12;
      for (const m of oc.peakMonths) {
        let delta = m - nowMonth;
        if (delta < 0) delta += 12;
        // If currently in peak month, count as 0 weeks away (show it).
        // For "within 6 weeks" we allow delta 0 or 1 (next month).
        if (delta < best) best = delta;
      }
      // Show if peak is this month or next month (~ within 6 weeks).
      if (best <= 1) {
        out.push({ category: cat, occasion: oc.occasion, note: oc.note, monthsUntilPeak: best });
      }
    }
  }
  // Deterministic order
  out.sort((a, b) => a.monthsUntilPeak - b.monthsUntilPeak || a.category.localeCompare(b.category));
  return out;
}
