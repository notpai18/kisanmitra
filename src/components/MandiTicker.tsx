import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';
import { formatRupee } from '../lib/formatters';

const initialCrops = [
  { name: "Wheat", nameHi: "गेहूं", price: 2100 },
  { name: "Rice", nameHi: "चावल", price: 1950 },
  { name: "Potato", nameHi: "आलू", price: 800 },
  { name: "Tomato", nameHi: "टमाटर", price: 1200 },
  { name: "Onion", nameHi: "प्याज", price: 1500 },
  { name: "Sugarcane", nameHi: "गन्ना", price: 350 },
  { name: "Maize", nameHi: "मक्का", price: 1750 },
  { name: "Cotton", nameHi: "कपास", price: 6500 },
  { name: "Soybean", nameHi: "सोयाबीन", price: 4200 },
  { name: "Mustard", nameHi: "सरसों", price: 5100 },
  { name: "Groundnut", nameHi: "मूंगफली", price: 5800 },
  { name: "Turmeric", nameHi: "हल्दी", price: 12000 },
];

export default function MandiTicker() {
  const { language } = useLanguage();
  const [crops, setCrops] = useState(initialCrops.map(c => ({...c, trend: 'up'})));

  useEffect(() => {
    const interval = setInterval(() => {
      setCrops(currentCrops => 
        currentCrops.map(crop => {
          // +/- 2% random variation
          const variation = (Math.random() * 0.04 - 0.02);
          const newPrice = Math.round(crop.price * (1 + variation));
          return {
            ...crop,
            price: newPrice,
            trend: newPrice >= crop.price ? 'up' : 'down'
          };
        })
      );
    }, 30000); // every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#1B4332] text-white overflow-hidden py-2 border-y border-[#064e3b]">
      <div className="flex whitespace-nowrap ticker-scroll items-center h-6">
        {/* We duplicate the array to achieve seamless infinite scrolling */}
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
