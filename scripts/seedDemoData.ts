const UP_DEMO_DISTRICTS = ['Varanasi', 'Gorakhpur', 'Lucknow', 'Kanpur', 'Allahabad', 'Meerut', 'Agra', 'Bareilly'];

export const DEMO_LISTINGS = [
  { crop: 'Wheat', district: 'Varanasi', state: 'Uttar Pradesh', quantity: 20, unit: 'quintal', price: 2150 },
  { crop: 'Rice', district: 'Gorakhpur', state: 'Uttar Pradesh', quantity: 18, unit: 'quintal', price: 1980 },
  { crop: 'Potato', district: 'Lucknow', state: 'Uttar Pradesh', quantity: 25, unit: 'quintal', price: 900 },
  { crop: 'Tomato', district: 'Kanpur', state: 'Uttar Pradesh', quantity: 12, unit: 'quintal', price: 1300 },
  { crop: 'Sugarcane', district: 'Allahabad', state: 'Uttar Pradesh', quantity: 40, unit: 'quintal', price: 360 },
  { crop: 'Maize', district: 'Meerut', state: 'Uttar Pradesh', quantity: 16, unit: 'quintal', price: 1760 },
  { crop: 'Mustard', district: 'Agra', state: 'Uttar Pradesh', quantity: 10, unit: 'quintal', price: 5400 },
  { crop: 'Wheat', district: 'Bareilly', state: 'Uttar Pradesh', quantity: 14, unit: 'quintal', price: 2130 },
];

export function getRandomUpDistrict(): string {
  return UP_DEMO_DISTRICTS[Math.floor(Math.random() * UP_DEMO_DISTRICTS.length)];
}
