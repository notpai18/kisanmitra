import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { TrendingUp, TrendingDown, Loader2, AlertCircle } from 'lucide-react';
import { formatRupee } from '../lib/formatters';

interface CommodityPrice {
  name: string;
  nameHi: string;
  price: number;
  unit: string;
  lastUpdated: string;
  trend?: 'up' | 'down';
}

interface PriceApiResponse {
  success: boolean;
  data: CommodityPrice[];
  source?: string;
  fetchedAt?: string;
  error?: string;
}

export default function MandiTicker() {
  const { language } = useLanguage();
  const [crops, setCrops] = useState<CommodityPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch('/api/mandi-prices', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: PriceApiResponse = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to fetch prices');
      }

      setCrops(prevCrops => {
        return data.data.map(crop => {
          const prevCrop = prevCrops.find(p => p.name === crop.name);
          return {
            ...crop,
            trend: prevCrop ? (crop.price >= prevCrop.price ? 'up' : 'down') : 'up',
          };
        });
      });
      setError(null);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Failed to fetch mandi prices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();

    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  if (isLoading) {
    return (
      <div className="w-full bg-[#1B4332] text-white overflow-hidden py-3 border-y border-[#064e3b]">
        <div className="flex items-center justify-center gap-2 h-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading market prices...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-[#1B4332] text-white overflow-hidden py-3 border-y border-[#064e3b]">
        <div className="flex items-center justify-center gap-2 h-6">
          <AlertCircle className="w-4 h-4 text-[#EF4444]" />
          <span className="text-sm text-[#EF4444]">Unable to load prices</span>
        </div>
      </div>
    );
  }

  if (crops.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-[#1B4332] text-white overflow-hidden py-2 border-y border-[#064e3b]">
      <div className="flex whitespace-nowrap ticker-scroll items-center h-6">
        {[...crops, ...crops].map((crop, i) => (
          <div key={`${crop.name}-${i}`} className="inline-flex items-center gap-2 mx-6 px-4 border-r border-[#064e3b] last:border-r-0">
            <span className="font-bold font-devanagari">
              {language === 'hi' ? crop.nameHi : crop.name}
            </span>
            <span className="font-medium text-gold-400">
              {formatRupee(crop.price)}/q
            </span>
            {crop.trend === 'up' ? (
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
            ) : (
              <TrendingDown className="w-4 h-4 text-[#EF4444]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}