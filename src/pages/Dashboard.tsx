import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, isMockConfig } from '../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, doc } from '../lib/firebase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CloudRain, Droplets, Wind, Sun, TrendingUp, TrendingDown, Minus, Sprout, Lightbulb, Stethoscope, Store, Landmark, ShoppingCart, Map as MapIcon, Wallet, IndianRupee } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { formatRupee } from '../lib/formatters';
import FarmFormModal, { FarmProfileData } from '../components/FarmFormModal';
import { formatLocationLine } from '../utils/formatLocation';
import { resolveWeatherCoords } from '../utils/weatherLocation';
import SoilMoistureCard from '../components/SoilMoistureCard';
import MandiTicker from '../components/MandiTicker';
import SoilTestCard from '../components/SoilTestCard';
import CreditApplyModal from '../components/CreditApplyModal';
import TrustScoreCard from '../components/TrustScoreCard';

export default function Dashboard() {
  const { user, userData } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isFarmer = userData?.role === 'farmer';

  const [weather, setWeather] = useState<{
    temp: number;
    humidity: number;
    rainPct: number;
    wind: number;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [recentAdvisory, setRecentAdvisory] = useState<{ question?: string; response?: string } | null>(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(true);
  const [farms, setFarms] = useState<any[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isFarmFormOpen, setIsFarmFormOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [weatherCaption, setWeatherCaption] = useState('');
  const [userRevenue, setUserRevenue] = useState<number>(0);
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    activeListings: 0,
    totalBidsReceived: 0,
    cropsSold: 0,
    monthlyData: [] as any[]
  });

  const AnimatedCounter = ({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) => {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
      const duration = 1500;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplay(value);
          clearInterval(timer);
        } else {
          setDisplay(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }, [value]);
    return (
      <span className="animate-count-up">
        {prefix}{display.toLocaleString("en-IN")}{suffix}
      </span>
    );
  };

  const fetchMyFarms = async (): Promise<FarmProfileData[]> => {
    if (!user || !isFarmer) return [];
    if (isMockConfig) {
      const mockFarms = [
        {
          id: 'mock-farm-1',
          name: 'Green Valley Farm',
          crops: ['Wheat'],
          area: 5,
          soil: 'Alluvial',
          state: 'Uttar Pradesh',
          district: 'Varanasi',
          irrigation: 'Tubewell',
          season: 'Rabi',
          createdAt: new Date().toISOString()
        }
      ];
      setFarms(mockFarms);
      return mockFarms;
    }
    try {
      setFarmsLoading(true);
      const fQ = query(collection(db, `users/${user.uid}/farms`));
      const fSnap = await getDocs(fQ);
      const list = fSnap.docs.map((d) => ({ id: d.id, ...d.data() } as FarmProfileData));
      setFarms(list);
      return list;
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      setFarmsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setWeatherLoading(true);
      setWeatherError(null);
      setAdvisoryLoading(true);
      try {
        let farmsLoaded: FarmProfileData[] = [];
        if (user && !isMockConfig && isFarmer) {
          farmsLoaded = await fetchMyFarms();
        }
        const first = farmsLoaded[0];
        const { lat, lon, name } = await resolveWeatherCoords(first?.state || '', first?.district || '');
        if (!cancelled) {
          setWeatherCaption(name);
        }
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m&timezone=Asia%2FKolkata`
        );
        const weatherData = await weatherRes.json();
        if (!weatherData?.current) throw new Error('weather');
        if (!cancelled) {
          setWeather({
            temp: Math.round(weatherData.current.temperature_2m),
            humidity: weatherData.current.relative_humidity_2m,
            rainPct: weatherData.current.precipitation_probability ?? 0,
            wind: Math.round(weatherData.current.wind_speed_10m),
          });
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setWeatherError(t('error'));
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }

      try {
        if (user && !isMockConfig && isFarmer) {
          const q = query(collection(db, `users/${user.uid}/advisoryHistory`), orderBy('timestamp', 'desc'), limit(1));
          const snapshot = await getDocs(q);
          if (!snapshot.empty && !cancelled) {
            setRecentAdvisory(snapshot.docs[0].data() as { question?: string; response?: string });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setAdvisoryLoading(false);
      }
      try {
        if (user && !isMockConfig && isFarmer) {
          const activeQ = query(collection(db, "listings"), where("farmerId", "==", user.uid), where("status", "==", "active"));
          const activeSnap = await getDocs(activeQ);
          
          const soldQ = query(collection(db, "listings"), where("farmerId", "==", user.uid), where("status", "==", "sold"));
          const soldSnap = await getDocs(soldQ);
          
          let totalRev = 0;
          const uniqueCrops = new Set<string>();
          const monthMap = new Map<string, number>();

          soldSnap.docs.forEach(doc => {
            const data = doc.data();
            const rev = Number(data.price || 0) * Number(data.quantity || 1);
            totalRev += rev;
            if (data.crop) uniqueCrops.add(data.crop);
            
            let d = data.soldAt?.toDate ? data.soldAt.toDate() : new Date();
            const m = d.toLocaleString('en-US', { month: 'short' });
            monthMap.set(m, (monthMap.get(m) || 0) + rev);
          });

          const monthlyData: any[] = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const m = d.toLocaleString('en-US', { month: 'short' });
            monthlyData.push({ month: m, revenue: monthMap.get(m) || 0 });
          }
          
          const bidsQ = query(collection(db, "bids"), where("farmerId", "==", user.uid));
          const bidsSnap = await getDocs(bidsQ);
          
          if (!cancelled) {
            setAnalytics({
              totalRevenue: totalRev,
              activeListings: activeSnap.docs.length,
              totalBidsReceived: bidsSnap.docs.length,
              cropsSold: uniqueCrops.size,
              monthlyData
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
      
      if (!cancelled) setPageLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user, isFarmer, language]);

  // Real-time listener for user revenue (totalRevenue from Firestore)
  useEffect(() => {
    if (!user || isMockConfig) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const revenue = Number(data.totalRevenue || 0);
        setUserRevenue(revenue);
        // Also update analytics.totalRevenue if it's 0 (first load)
        setAnalytics(prev => ({
          ...prev,
          totalRevenue: revenue || prev.totalRevenue
        }));
      }
    }, (error) => {
      console.error('Error listening to user revenue:', error);
    });

    return () => unsubscribe();
  }, [user]);

  if (pageLoading && weatherLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="skeleton h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="skeleton h-48 lg:col-span-2 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  const firstName = userData?.name?.split(' ')[0] ?? (isFarmer ? t('farmer') : t('buyer'));

  // Role-specific quick actions
  const farmerActions = [
    { icon: Sprout, label: t('dash_get_advice'), path: '/advisory', color: 'bg-forest-50 text-forest-600' },
    { icon: Stethoscope, label: t('dash_crop_doctor'), path: '/crop-doctor', color: 'bg-blue-50 text-blue-600' },
    { icon: Store, label: t('dash_sell_produce'), path: '/market', color: 'bg-gold-500/10 text-gold-600' },
    { icon: Landmark, label: t('dash_govt_schemes'), path: '/schemes', color: 'bg-purple-50 text-purple-600' },
  ];

  const buyerActions = [
    { icon: ShoppingCart, label: t('dash_browse_listings'), path: '/market', color: 'bg-forest-50 text-forest-600' },
    { icon: TrendingUp, label: t('dash_price_insights'), path: '/insights', color: 'bg-blue-50 text-blue-600' },
    { icon: Store, label: t('dash_my_bids'), path: '/market', color: 'bg-gold-500/10 text-gold-600' },
    { icon: Minus, label: t('dash_market_prices'), path: '/insights', color: 'bg-purple-50 text-purple-600' },
  ];

  const quickActions = isFarmer ? farmerActions : buyerActions;

  const weatherCondition = weather?.rainPct != null && weather.rainPct > 60 ? 'Rainy' : weather?.temp != null && weather.temp > 35 ? 'Hot' : 'Clear';
  const recentRainfall = (weather?.rainPct ?? 0) > 50;
  const farmCtx = (farms?.[0] as FarmProfileData | undefined) || undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1B4332] to-[#064e3b] rounded-2xl p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.12)] relative overflow-hidden" style={{ color: '#FFFFFF' }}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 font-devanagari text-white" style={{ color: '#FFFFFF' }}>
            {t('dash_welcome')}, {firstName}!
          </h1>
          <p className="text-white/90 text-base font-devanagari">
            {isFarmer ? t('dash_farmer_subtitle') : t('dash_buyer_subtitle')}
          </p>
        </div>
      </div>

      <MandiTicker />

      {/* Soil Moisture & Soil Test - Side by Side */}
      {isFarmer && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SoilMoistureCard
              soilType={farmCtx?.soil}
              season={farmCtx?.season}
              weatherCondition={weatherCondition}
              recentRainfall={recentRainfall}
            />
          </div>
          <div className="lg:col-span-1">
            <SoilTestCard />
          </div>
        </div>
      )}

      {/* Farm Credit - Premium Banner */}
      {isFarmer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-gradient-to-r from-indigo-950 to-violet-900 rounded-2xl p-6 shadow-xl"
        >
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <Wallet className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Zero-Risk Farm Credit</h3>
                <p className="text-white/70 text-sm">Get instant capital for your farm</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCreditModalOpen(true)}
              className="bg-white text-indigo-950 px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-shadow whitespace-nowrap"
            >
              Apply Now
            </motion.button>
          </div>
        </motion.div>
      )}

      {isFarmer && !farmsLoading && farms.length === 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-forest-50 border-2 border-forest-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-forest-100 text-forest-600 rounded-full flex items-center justify-center shrink-0">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-forest-900 mb-1">{language === 'en' ? 'Welcome! Please set up your Farm Profile to get started.' : 'स्वागत है! शुरू करने के लिए अपना खेत जोड़ें।'}</h2>
              <p className="text-forest-700 text-sm font-devanagari">{language === 'en' ? 'Unlock AI advisory, weather alerts, and more.' : 'अपनी एआई सलाह, मौसम और बाज़ार की जानकारी अनलॉक करें।'}</p>
            </div>
          </div>
          <button onClick={() => setIsFarmFormOpen(true)} className="bg-forest-600 hover:bg-forest-700 text-white font-bold px-6 py-3 rounded-xl whitespace-nowrap transition-colors w-full sm:w-auto">
            {language === 'en' ? 'Add My Farm →' : 'मेरा खेत जोड़ें →'}
          </button>
        </motion.div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {quickActions.map((action, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(action.path)}
            className="ds-card flex flex-col items-center gap-3 p-6 hover:shadow-[0_8px_32px_rgba(0,0,0,0.1)] transition-shadow cursor-pointer"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${action.color}`}>
              <action.icon className="w-7 h-7" />
            </div>
            <span className="font-bold text-sm text-gray-900 text-center font-devanagari">{action.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Farmer Analytics */}
      {isFarmer && !pageLoading && (
        <div className="space-y-6">
          {/* TrustScore + Metrics - 3 Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <TrustScoreCard />
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <div className="ds-card p-4 flex flex-col justify-center border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-sm font-medium text-gray-500 mb-1">Total Revenue</p>
                <h3 className="text-2xl font-bold text-forest-900"><AnimatedCounter value={analytics.totalRevenue} prefix="₹" /></h3>
              </div>
              <div className="ds-card p-4 flex flex-col justify-center border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-sm font-medium text-gray-500 mb-1">Active Listings</p>
                <h3 className="text-2xl font-bold text-forest-900"><AnimatedCounter value={analytics.activeListings} /></h3>
              </div>
              <div className="ds-card p-4 flex flex-col justify-center border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-sm font-medium text-gray-500 mb-1">Bids Received</p>
                <h3 className="text-2xl font-bold text-forest-900"><AnimatedCounter value={analytics.totalBidsReceived} /></h3>
              </div>
              <div className="ds-card p-4 flex flex-col justify-center border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-sm font-medium text-gray-500 mb-1">Crops Sold</p>
                <h3 className="text-2xl font-bold text-forest-900"><AnimatedCounter value={analytics.cropsSold} /></h3>
              </div>
            </div>
          </div>
          
          <div className="ds-card p-6 border border-gray-100">
            <h3 className="text-lg font-bold font-devanagari text-gray-900 mb-4">Revenue Overview</h3>
            {analytics.totalRevenue > 0 ? (
              <div className="h-64 mt-4 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val >= 1000 ? val/1000 + 'k' : val}`} tick={{ fill: '#6B7280' }} width={50} />
                    <Tooltip 
                      formatter={(value: number) => [formatRupee(value), 'Revenue']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 font-devanagari border-2 border-dashed border-gray-100 rounded-xl">
                {language === 'en' ? 'No revenue data yet' : 'अभी तक कोई राजस्व डेटा नहीं'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rain Warning */}
      {weather && weather.rainPct > 60 && !weatherLoading && (
        <div className="rounded-2xl border border-[#F59E0B]/40 bg-[#FEF3C7] px-4 py-3 flex items-center gap-3 text-[#92400e]">
          <span className="text-xl" aria-hidden>⚠️</span>
          <p className="text-sm font-medium font-devanagari">{t('dash_rain_warning')}</p>
        </div>
      )}

      <div className="flex flex-col gap-6 w-full">
        {/* Weather Card */}
        <div className="ds-card w-full !p-5">
          <div className="flex justify-between items-center mb-6">
            <h2 className="ds-section-title flex items-center gap-2 font-devanagari">
              <Sun className="w-6 h-6 text-[#F59E0B]" /> {t('dash_weather')}
            </h2>
            <span className="ds-caption">{weatherCaption || t('weather_location')}</span>
          </div>

          {weatherLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : weatherError ? (
            <div className="rounded-2xl border border-[#EF4444]/20 bg-red-50 p-6 text-center">
              <p className="text-[#EF4444] text-sm mb-2 font-devanagari">⚠️ {t('error')}</p>
              <button type="button" className="btn-primary text-sm py-2" onClick={() => window.location.reload()}>
                {t('retry')}
              </button>
            </div>
          ) : weather ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#FEF3C7]/40 rounded-2xl p-4 border border-[#F59E0B]/20">
                <div className="flex items-center gap-2 text-[#92400e] mb-2">
                  <Sun className="w-5 h-5" />
                  <span className="font-medium text-sm font-devanagari">{t('weather_temp')}</span>
                </div>
                <p className="text-2xl font-bold text-[#111827]">{weather.temp}°C</p>
              </div>
              <div className="bg-[#D1FAE5]/50 rounded-2xl p-4 border border-[#10B981]/20">
                <div className="flex items-center gap-2 text-[#047857] mb-2">
                  <Droplets className="w-5 h-5" />
                  <span className="font-medium text-sm font-devanagari">{t('weather_humidity')}</span>
                </div>
                <p className="text-2xl font-bold text-[#111827]">{weather.humidity}%</p>
              </div>
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <CloudRain className="w-5 h-5" />
                  <span className="font-medium text-sm font-devanagari">{t('weather_rain')}</span>
                </div>
                <p className="text-2xl font-bold text-[#111827]">{weather.rainPct}%</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-[#6B7280] mb-2">
                  <Wind className="w-5 h-5" />
                  <span className="font-medium text-sm font-devanagari">{t('weather_wind')}</span>
                </div>
                <p className="text-2xl font-bold text-[#111827]">{weather.wind} km/h</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Farm Profile */}
        {isFarmer && (
          <div className="ds-card flex flex-col bg-white border border-gray-100 w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="ds-section-title flex items-center gap-2 text-[#1B4332] font-devanagari">
                <MapIcon className="w-6 h-6 text-[#10B981]" /> {language === 'en' ? 'My Farms' : 'मेरे खेत'}
              </h2>
              <button 
                 onClick={() => setIsFarmFormOpen(true)} 
                 className="text-xs font-bold text-[#1B4332] bg-[#D1FAE5] px-3 py-1.5 rounded-lg hover:bg-[#A7F3D0] transition-colors"
              >
                + Add New Farm
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {farmsLoading ? (
                 <>
                   <div className="skeleton h-24 w-full rounded-xl" />
                   <div className="skeleton h-24 w-full rounded-xl" />
                   <div className="skeleton h-24 w-full rounded-xl" />
                 </>
              ) : farms.length > 0 ? (
                 farms.map(f => (
                   <div key={f.id} className="p-4 bg-white border border-gray-100 rounded-xl flex flex-col gap-3 hover:border-forest-300 transition-colors shadow-sm">
                     <div className="flex items-center gap-3">
                       <div className="w-12 h-12 bg-forest-50 text-forest-600 rounded-full flex items-center justify-center shrink-0">
                         <Sprout className="w-6 h-6"/>
                       </div>
                       <div>
                         <p className="font-bold text-base text-gray-900">{f.name}</p>
                         <div className="flex items-center gap-2 mt-0.5">
                           <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md"><MapIcon className="w-3 h-3"/> {formatLocationLine(f.district, f.state)}</span>
                           <span className="text-xs font-bold text-forest-700 bg-forest-50 px-2 py-0.5 rounded-md">{f.area} Acres</span>
                         </div>
                       </div>
                     </div>
                     <div className="bg-gray-50 rounded-lg p-2.5 flex flex-wrap gap-2 items-center">
                       <span className="text-xs text-gray-500 font-medium">Crops:</span>
                       {f.crops?.length > 0 ? f.crops.map((c: string) => (
                         <span key={c} className="text-xs font-bold bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded shadow-sm">{c}</span>
                       )) : (
                         <span className="text-xs font-bold bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded shadow-sm">{f.crop || 'Unknown'}</span>
                       )}
                     </div>
                   </div>
                 ))
              ) : (
                 <div className="text-center p-6 border-2 border-dashed border-gray-100 rounded-xl h-full flex flex-col items-center justify-center text-gray-400">
                   <p className="text-sm font-devanagari">{language === 'en' ? 'No farms registered yet.' : 'अभी तक कोई खेत दर्ज नहीं है।'}</p>
                 </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Advisory — Farmer only */}
        {isFarmer && (
          <div className="ds-card flex flex-col">
            <h2 className="ds-section-title flex items-center gap-2 mb-6 font-devanagari">
              <Sprout className="w-6 h-6 text-[#1B4332]" /> {t('dash_advisory')}
            </h2>

            {advisoryLoading ? (
              <div className="space-y-3">
                <div className="skeleton h-20 w-full" />
                <div className="skeleton h-24 w-full" />
              </div>
            ) : recentAdvisory ? (
              <div className="flex-1 flex flex-col">
                <div className="bg-[#F9FAFB] rounded-2xl p-4 mb-4 border border-gray-100">
                  <p className="ds-caption mb-1 font-devanagari">{t('adv_ask_about')}:</p>
                  <p className="font-medium text-[#111827] line-clamp-2">{recentAdvisory.question}</p>
                </div>
                <div className="bg-[#D1FAE5]/40 rounded-2xl p-4 border border-[#10B981]/20 flex-1">
                  <p className="text-sm text-[#047857] mb-1 font-devanagari">{t('adv_ai_advisor')}:</p>
                  <p className="text-[#111827] line-clamp-4 text-sm">{recentAdvisory.response}</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-100 rounded-2xl">
                <Sprout className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-[#6B7280] font-devanagari">{t('dash_no_advisory')}</p>
              </div>
            )}
          </div>
        )}

        {/* Market Prices */}
        <div className={clsx("ds-card", !isFarmer && "lg:col-span-2")}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="ds-section-title flex items-center gap-2 font-devanagari">
              <TrendingUp className="w-6 h-6 text-[#1B4332]" /> {t('dash_market')}
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { name: 'Wheat (गेहूं)', price: 2150, trend: 'up' as const, change: '+1.2%' },
              { name: 'Rice (धान)', price: 1980, trend: 'down' as const, change: '-0.8%' },
              { name: 'Potato (आलू)', price: 820, trend: 'up' as const, change: '+3.1%' },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between p-4 rounded-2xl bg-[#F9FAFB] border border-gray-100">
                <span className="font-bold text-[#111827] font-devanagari text-sm">{item.name}</span>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-[#111827]">{formatRupee(item.price)}/q</span>
                  <span
                    className={clsx(
                      'flex items-center gap-1 text-sm font-bold w-16 justify-end',
                      item.trend === 'up' ? 'text-[#10B981]' : item.trend === 'down' ? 'text-[#EF4444]' : 'text-[#6B7280]'
                    )}
                  >
                    {item.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {item.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <FarmFormModal isOpen={isFarmFormOpen} onClose={() => setIsFarmFormOpen(false)} onSuccess={() => { setIsFarmFormOpen(false); void fetchMyFarms(); }} />
      <CreditApplyModal isOpen={isCreditModalOpen} onClose={() => setIsCreditModalOpen(false)} />
    </motion.div>
  );
}
