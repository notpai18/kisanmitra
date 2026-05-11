import React, { useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Sparkles, Calendar, Droplets, Map, Award, Sprout } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { formatRupee } from '../lib/formatters';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { db, isMockConfig } from '../lib/firebase';
import { collection, getDocs } from '../lib/firebase';
import { FarmProfileData } from '../components/FarmFormModal';
import { geminiClient } from '../lib/geminiClient';

const CROP_TYPES = ['Wheat', 'Rice', 'Potato', 'Tomato', 'Sugarcane', 'Maize'];
const CROP_NAMES_HI: Record<string, string> = {
  Wheat: 'गेहूं', Rice: 'चावल', Potato: 'आलू', Tomato: 'टमाटर', Sugarcane: 'गन्ना', Maize: 'मक्का'
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const generateHistoricalData = (basePrice: number) => {
  const data = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const fluctuation = (Math.random() - 0.5) * (basePrice * 0.15);
    data.push({ month: d.toLocaleString('default', { month: 'short' }), price: Math.round(basePrice + fluctuation) });
  }
  return data;
};

const BASE_PRICES: Record<string, number> = {
  'Wheat': 2100, 'Rice': 1950, 'Potato': 800, 'Tomato': 1200, 'Sugarcane': 350, 'Maize': 1750
};

const UP_MANDI_PRICES = [
  { mandi: 'Varanasi', mandiHi: 'वाराणसी', price: 2150, change: +1.2 },
  { mandi: 'Lucknow', mandiHi: 'लखनऊ', price: 2180, change: +0.8 },
  { mandi: 'Gorakhpur', mandiHi: 'गोरखपुर', price: 2120, change: -0.5 },
  { mandi: 'Agra', mandiHi: 'आगरा', price: 2200, change: +2.1 },
  { mandi: 'Kanpur', mandiHi: 'कानपुर', price: 2160, change: +1.5 },
  { mandi: 'Allahabad', mandiHi: 'इलाहाबाद', price: 2140, change: -0.3 },
  { mandi: 'Meerut', mandiHi: 'मेरठ', price: 2190, change: +1.8 },
  { mandi: 'Bareilly', mandiHi: 'बरेली', price: 2130, change: +0.6 },
];

interface PricePrediction {
  predicted_price: number;
  trend: 'up' | 'down' | 'stable';
  trend_percent?: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning_hindi: string;
  reasoning_english?: string;
  best_time_to_sell: string;
  market_factors?: string[];
  market_factors_hindi?: string[];
  market_factors_english?: string[];
}

interface CropPlan {
  crop_name: string;
  estimated_yield_per_acre: string;
  market_price_range: string;
  input_cost_estimate: string;
  profit_estimate: string;
  risk_level: 'Low' | 'Medium' | 'High';
  reasoning_hindi: string;
}

export default function Insights() {
  const { t, language } = useLanguage();
  const { user, userData } = useAuth();
  const isFarmer = userData?.role === 'farmer';
  const [farmerLoc, setFarmerLoc] = useState<{ state: string; district: string }>({ state: '', district: '' });
  const [selectedCrop, setSelectedCrop] = useState('Wheat');
  const [historicalData, setHistoricalData] = useState(generateHistoricalData(BASE_PRICES['Wheat']));
  
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<PricePrediction | null>(null);
  const [predictError, setPredictError] = useState<string | null>(null);

  useEffect(() => {
    setHistoricalData(generateHistoricalData(BASE_PRICES[selectedCrop]));
    setPrediction(null);
  }, [selectedCrop]);

  useEffect(() => {
    const load = async () => {
      if (!user || !isFarmer || isMockConfig) {
        setFarmerLoc({ state: '', district: '' });
        return;
      }
      try {
        const snap = await getDocs(collection(db, `users/${user.uid}/farms`));
        const first = snap.docs[0]?.data() as FarmProfileData | undefined;
        if (first) setFarmerLoc({ state: first.state || '', district: first.district || '' });
      } catch {
        setFarmerLoc({ state: '', district: '' });
      }
    };
    load();
  }, [user, isFarmer]);

  const currentPrice = historicalData[historicalData.length - 1].price;
  const avgPrice = Math.round(historicalData.reduce((acc, curr) => acc + curr.price, 0) / historicalData.length);
  const highestPrice = Math.max(...historicalData.map(d => d.price));
  const lowestPrice = Math.min(...historicalData.map(d => d.price));

  const handlePredictPrice = async () => {
    setPredicting(true);
    setPredictError(null);
    try {
      const data = await geminiClient.predictPrice({
        crop: selectedCrop,
        currentPrice: currentPrice,
        month: new Date().toLocaleString('default', { month: 'long' }),
        language,
        state: farmerLoc.state,
        district: farmerLoc.district,
      });
      setPrediction(data);
    } catch (err) {
      console.error(err);
      setPredictError(t('ins_predict_error'));
      toast.error(t('ins_predict_error'));
    } finally {
      setPredicting(false);
    }
  };

  const mandiTableData = UP_MANDI_PRICES.map((mandi) => ({
    name: language === 'hi' ? mandi.mandiHi : mandi.mandi,
    price: mandi.price,
    change: mandi.change,
  }));

  const getCropLabel = (crop: string) => language === 'hi' ? `${CROP_NAMES_HI[crop] || crop}` : crop;

  // Determine market factors to display
  const getMarketFactors = (p: PricePrediction): string[] => {
    if (language === 'hi' && p.market_factors_hindi?.length) return p.market_factors_hindi;
    if (language === 'en' && p.market_factors_english?.length) return p.market_factors_english;
    return p.market_factors || p.market_factors_hindi || p.market_factors_english || [];
  };

  const getReasoning = (p: PricePrediction): string => {
    if (language === 'hi') return p.reasoning_hindi;
    return p.reasoning_english || p.reasoning_hindi;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="w-14 h-14 bg-forest-100 text-forest-600 rounded-2xl flex items-center justify-center shrink-0">
          <TrendingUp className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-forest-900 flex items-center gap-2 font-devanagari">
            {t('ins_title')}
          </h1>
          <p className="text-gray-500 mt-1 font-devanagari">{t('ins_subtitle')}</p>
        </div>
      </div>

      {/* Top Section: Chart & Prediction */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 font-devanagari">{t('ins_history')}</h2>
            <select 
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 font-medium text-forest-900 focus:ring-forest-500 focus:border-forest-500 outline-none"
            >
              {CROP_TYPES.map(c => <option key={c} value={c}>{getCropLabel(c)}</option>)}
            </select>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(val) => formatRupee(val)} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${formatRupee(value)}/q`, 'Price']}
                />
                <Area type="monotone" dataKey="price" stroke="#166534" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1 font-devanagari">{t('ins_avg')}</p>
              <p className="text-lg font-bold text-gray-900">{formatRupee(avgPrice)}</p>
            </div>
            <div className="text-center border-l border-r border-gray-100">
              <p className="text-sm text-gray-500 mb-1 font-devanagari">{t('ins_highest')}</p>
              <p className="text-lg font-bold text-green-600">{formatRupee(highestPrice)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1 font-devanagari">{t('ins_lowest')}</p>
              <p className="text-lg font-bold text-red-600">{formatRupee(lowestPrice)}</p>
            </div>
          </div>
        </div>

        {/* Prediction Card */}
        <div className="bg-gradient-to-br from-gold-500 to-gold-600 rounded-2xl shadow-md p-6 text-white relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-6 h-6 text-gold-100" />
              <h2 className="text-xl font-bold font-devanagari">{t('ins_forecast')}</h2>
            </div>

            {predicting ? (
              /* Skeleton loading */
              <div className="flex-1 flex flex-col gap-4 animate-pulse">
                <div className="h-8 bg-white/20 rounded-lg w-3/4"></div>
                <div className="h-12 bg-white/20 rounded-lg w-1/2"></div>
                <div className="h-20 bg-white/10 rounded-xl w-full"></div>
                <div className="h-6 bg-white/20 rounded-lg w-2/3"></div>
                <div className="flex gap-2 mt-auto">
                  <div className="h-8 bg-white/10 rounded-full flex-1"></div>
                  <div className="h-8 bg-white/10 rounded-full flex-1"></div>
                  <div className="h-8 bg-white/10 rounded-full flex-1"></div>
                </div>
              </div>
            ) : !prediction ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <p className="text-gold-100 mb-6 font-devanagari">{t('ins_forecast_desc')}</p>
                <button 
                  onClick={handlePredictPrice}
                  disabled={predicting}
                  className="bg-forest-600 text-white hover:bg-forest-700 w-full py-3.5 rounded-xl font-bold transition-colors shadow-md disabled:opacity-80 flex items-center justify-center gap-2 font-devanagari"
                >
                  {t('ins_predict_btn')}
                </button>
                {predictError && (
                  <div className="mt-4 text-center">
                    <p className="text-red-200 text-sm mb-2 font-devanagari">{predictError}</p>
                    <button
                      onClick={handlePredictPrice}
                      className="text-sm text-white underline font-devanagari"
                    >
                      {t('retry')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-gold-100 text-sm mb-1 font-devanagari">{t('ins_predicted_price')}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-4xl font-bold">{formatRupee(prediction.predicted_price)}</span>
                      {prediction.trend === 'up' && <TrendingUp className="w-6 h-6 text-green-300" />}
                      {prediction.trend === 'down' && <TrendingDown className="w-6 h-6 text-red-300" />}
                      {prediction.trend === 'stable' && <Minus className="w-6 h-6 text-gray-200" />}
                      {prediction.trend_percent != null && (
                        <span className={clsx(
                          "text-sm font-bold",
                          prediction.trend === 'up' ? 'text-green-300' : prediction.trend === 'down' ? 'text-red-300' : 'text-gray-200'
                        )}>
                          {prediction.trend === 'up' ? '+' : prediction.trend === 'down' ? '-' : ''}{prediction.trend_percent}%
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-bold uppercase",
                    prediction.confidence === 'high' ? "bg-green-500/20 text-green-100 border border-green-400/30" :
                    prediction.confidence === 'medium' ? "bg-yellow-500/20 text-yellow-100 border border-yellow-400/30" :
                    "bg-red-500/20 text-red-100 border border-red-400/30"
                  )}>
                    {prediction.confidence} {t('ins_confidence')}
                  </span>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200 shadow-inner">
                  <p className="text-sm leading-relaxed text-gray-900 font-devanagari font-medium">"{getReasoning(prediction)}"</p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-800 uppercase tracking-wider font-bold mb-2 font-devanagari bg-white/80 inline-block px-2.5 py-0.5 rounded shadow-sm">{t('ins_best_time')}</p>
                  <p className="font-bold text-gray-900 bg-white px-3 py-2 rounded-lg border border-gray-100 inline-block font-devanagari shadow-sm">
                    {prediction.best_time_to_sell}
                  </p>
                </div>

                <div className="mt-auto">
                  <p className="text-xs text-gray-800 uppercase tracking-wider font-bold mb-2 font-devanagari bg-white/80 inline-block px-2.5 py-0.5 rounded shadow-sm">{t('ins_key_factors')}</p>
                  <div className="flex flex-wrap gap-2">
                    {getMarketFactors(prediction).map((factor, i) => (
                      <span key={i} className="text-xs bg-green-500/20 text-green-100 px-2.5 py-1 rounded-full border border-green-400/20 font-devanagari">
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>
                
                <button 
                  onClick={() => setPrediction(null)}
                  className="mt-6 text-sm text-gold-200 hover:text-white underline text-center font-devanagari"
                >
                  {t('ins_reset')}
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>



      {/* Mandi Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 font-devanagari">{t('ins_mandi')} — {getCropLabel(selectedCrop)}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                <th className="p-4 font-medium font-devanagari">{t('ins_mandi_name')}</th>
                <th className="p-4 font-medium font-devanagari">{t('ins_price_q')}</th>
                <th className="p-4 font-medium font-devanagari">{t('ins_change')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mandiTableData.map((mandi, index) => (
                <tr key={mandi.name} className={index % 2 === 0 ? 'bg-white' : 'bg-forest-50/30'}>
                  <td className="p-4 font-medium text-gray-900">{mandi.name}</td>
                  <td className="p-4 font-bold text-gray-900">{formatRupee(mandi.price)}</td>
                  <td className="p-4">
                    <span className={clsx(
                      "flex items-center gap-1 text-sm font-medium",
                      mandi.change > 0 ? "text-green-600" : mandi.change < 0 ? "text-red-600" : "text-gray-500"
                    )}>
                      {mandi.change > 0 ? <TrendingUp className="w-4 h-4" /> : mandi.change < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                      {Math.abs(mandi.change)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
