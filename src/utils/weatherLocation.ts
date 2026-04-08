export async function resolveWeatherCoords(
  state: string,
  district: string
): Promise<{ lat: number; lon: number; name: string }> {
  if (district && state) {
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(district)}&count=1&language=en&format=json`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        return { 
          lat: result.latitude, 
          lon: result.longitude, 
          name: `${result.name}, ${result.admin1 || state}`
        };
      }
    } catch (e) {
      console.error('Geocoding error:', e);
    }
  }
  
  // Fallbacks if geocoding fails or no location provided
  if (district && state) {
    return { lat: 26.8467, lon: 80.9462, name: `${district}, ${state}` };
  }
  return { lat: 28.6139, lon: 77.2090, name: 'New Delhi, Delhi' };
}
