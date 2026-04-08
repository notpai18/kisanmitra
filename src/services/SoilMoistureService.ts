export const generateSoilMoisture = (
  weatherCondition: string,
  recentRainfall: boolean,
  season: string,
  soilType: string
): {
  moisture: number;
  status: 'Dry' | 'Optimal' | 'Wet';
  recommendation: string;
} => {
  // Base moisture by season
  let base = 40;
  if (season === 'Kharif') base = 55;
  if (season === 'Rabi') base = 45;
  if (season === 'Zaid') base = 35;

  // Adjust for rainfall
  if (recentRainfall) base += 20;

  // Adjust for soil type
  if (soilType === 'Sandy') base -= 10;
  if (soilType === 'Clay') base += 10;
  if (soilType === 'Loamy') base += 5;

  // Small adjustment for coarse weather condition
  if (weatherCondition === 'Rainy') base += 5;
  if (weatherCondition === 'Hot') base -= 5;

  // Add small random variation ±5%
  const moisture = Math.min(100, Math.max(0, base + (Math.random() * 10 - 5)));
  const rounded = Math.round(moisture);

  const status = rounded < 30 ? 'Dry' : rounded > 65 ? 'Wet' : 'Optimal';

  const recommendation =
    status === 'Dry'
      ? 'Irrigation recommended within 24 hours.'
      : status === 'Wet'
        ? 'Avoid irrigation. Allow soil to drain.'
        : 'Soil moisture is ideal for crop growth.';

  return { moisture: rounded, status, recommendation };
};

