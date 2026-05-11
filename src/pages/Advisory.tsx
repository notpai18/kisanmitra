import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, doc, isMockConfig } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, getDocs } from '../lib/firebase';
import { CloudRain, Wind, Droplets, ThermometerSun, Send, Leaf, AlertTriangle, CheckCircle2, Bell, Sprout, Mic, MicOff, MapPin, Map, Calendar, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { UI } from '../constants/translations';
import FarmFormModal, { FarmProfileData } from '../components/FarmFormModal';
import { formatLocationLine } from '../utils/formatLocation';
import { resolveWeatherCoords } from '../utils/weatherLocation';
import SoilMoistureCard from '../components/SoilMoistureCard';
import { geminiClient } from '../lib/geminiClient';

function primaryCrop(f: FarmProfileData): string {
  return (f.crops && f.crops.length > 0 ? f.crops[0] : (f as { crop?: string }).crop) || '';
}

interface WeatherData {
  temp: number;
  humidity: number;
  rainChance: number;
  windSpeed: number;
  forecast: { day: string; temp: number; icon: any }[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export default function Advisory() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  
  const [farms, setFarms] = useState<FarmProfileData[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<FarmProfileData | null>(null);
  const [isFarmFormOpen, setIsFarmFormOpen] = useState(false);
  const [farmsLoading, setFarmsLoading] = useState(true);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLocation, setWeatherLocation] = useState<string>('');
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [planMonth, setPlanMonth] = useState(MONTHS[new Date().getMonth()]);
  const [planAcres, setPlanAcres] = useState(2);
  const [planWater, setPlanWater] = useState('Tubewell');
  const [planning, setPlanning] = useState(false);
  const [cropPlans, setCropPlans] = useState<any[]>([]);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastScrolledAiIdRef = useRef<string | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
        recognitionRef.current.start();
        setIsListening(true);
      } else {
        toast.error(language === 'hi' ? 'आपका ब्राउज़र वॉइस इनपुट को सपोर्ट नहीं करता है।' : 'Your browser does not support voice input.');
      }
    }
  };

  const loadFarms = async () => {
    if (!user) return;
    if (isMockConfig) {
      const loaded = [
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
      setFarms(loaded);
      if (loaded.length > 0 && !selectedFarm) {
        setSelectedFarm(loaded[0]);
      }
      setFarmsLoading(false);
      return;
    }
    setFarmsLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'users', user.uid, 'farms'));
      const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FarmProfileData));
      setFarms(loaded);
      if (loaded.length > 0 && !selectedFarm) {
        setSelectedFarm(loaded[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setFarmsLoading(false);
    }
  };

  useEffect(() => {
    loadFarms();
  }, [user]);

  const handleCropPlan = async () => {
    setPlanning(true);
    setPlanError(null);
    try {
      const data = await geminiClient.suggestCropPlan({
        month: planMonth,
        acres: planAcres,
        waterSource: planWater,
        language,
        state: selectedFarm?.state || '',
        district: selectedFarm?.district || '',
      });
      setCropPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setPlanError(t('error_generic'));
      toast.error(t('error'));
    } finally {
      setPlanning(false);
    }
  };

  useEffect(() => {
    if (!user || isMockConfig) return;
    const q = query(collection(db, 'users', user.uid, 'advisoryHistory'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        loadedMessages.push({ id: doc.id + '_q', role: 'user', text: data.question, timestamp: data.timestamp });
        loadedMessages.push({ id: doc.id + '_r', role: 'ai', text: data.response, timestamp: data.timestamp });
      });
      setMessages(loadedMessages);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const fetchWeather = async () => {
      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const { lat, lon, name } = await resolveWeatherCoords(selectedFarm?.state || '', selectedFarm?.district || '');
        if (!cancelled) {
          setWeatherLocation(name);
        }
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m&daily=temperature_2m_max,precipitation_probability_max&timezone=Asia%2FKolkata`
        );
        const data = await res.json();
        if (!data?.current) throw new Error('Weather unavailable');
        if (cancelled) return;

        setWeather({
          temp: Math.round(data.current.temperature_2m),
          humidity: data.current.relative_humidity_2m,
          rainChance: data.current.precipitation_probability ?? data.daily?.precipitation_probability_max?.[0] ?? 0,
          windSpeed: Math.round(data.current.wind_speed_10m),
          forecast: [
            { day: 'Tomorrow', temp: Math.round(data.daily.temperature_2m_max[1]), icon: CloudRain },
            { day: 'Day 3', temp: Math.round(data.daily.temperature_2m_max[2]), icon: ThermometerSun },
            { day: 'Day 4', temp: Math.round(data.daily.temperature_2m_max[3]), icon: ThermometerSun },
          ],
        });
      } catch (error) {
        console.error('Error fetching weather:', error);
        if (!cancelled) setWeatherError(UI.errorTitleEn);
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    };
    fetchWeather();
    return () => {
      cancelled = true;
    };
  }, [selectedFarm?.state, selectedFarm?.district, selectedFarm?.id]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !selectedFarm) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const textResponse = await geminiClient.generateAdvisory({
        ...selectedFarm,
        crop: primaryCrop(selectedFarm),
        acres: selectedFarm.area,
        state: selectedFarm.state,
        district: selectedFarm.district,
        temp: weather?.temp || 30,
        humidity: weather?.humidity || 50,
        rainChance: weather?.rainChance || 0,
        date: new Date().toLocaleDateString(),
        question: text,
        language
      });

      if (user && !isMockConfig) {
        await addDoc(collection(db, 'users', user.uid, 'advisoryHistory'), {
          question: text,
          response: textResponse,
          timestamp: new Date().toISOString(),
        });
      } else {
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: 'ai', text: textResponse, timestamp: new Date().toISOString() },
        ]);
      }
    } catch (error) {
      console.error('Error getting advisory:', error);
      toast.error(UI.aiUnavailable);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'ai',
          text: 'कुछ गलत हुआ — Something went wrong. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'ai') return;
    if (lastScrolledAiIdRef.current === last.id) return;
    lastScrolledAiIdRef.current = last.id;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !(e as any).shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSendMessage(input);
    }
  };

  const quickQuestions = [
    t('adv_quick_q1'),
    t('adv_quick_q2'),
    t('adv_quick_q3'),
    t('adv_quick_q4'),
  ];

  if (farmsLoading) {
    return <div className="skeleton h-64 w-full rounded-2xl" />;
  }

  if (farms.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24 bg-white rounded-2xl shadow-sm border border-gray-100">
        <Sprout className="w-16 h-16 text-forest-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {language === 'en' ? 'Welcome! Please set up your Farm Profile to get started.' : 'स्वागत है! शुरू करने के लिए अपना खेत जोड़ें।'}
        </h2>
        <p className="text-gray-500 mb-8">
          {language === 'en' ? 'Your personalized AI advisory, weather, and market insights will be tailored to your farm.' : 'आपकी एआई सलाह, मौसम और बाज़ार की जानकारी आपके खेत के अनुसार तैयार की जाएगी।'}
        </p>
        <button onClick={() => setIsFarmFormOpen(true)} className="bg-forest-600 hover:bg-forest-700 text-white transition-colors rounded-xl font-bold text-lg px-8 py-3 mx-auto flex items-center justify-center">
          {language === 'en' ? 'Add My Farm →' : 'मेरा खेत जोड़ें →'}
        </button>
        <FarmFormModal 
          isOpen={isFarmFormOpen} 
          onClose={() => setIsFarmFormOpen(false)} 
          onSuccess={() => { setIsFarmFormOpen(false); loadFarms(); }} 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-6">
        
        {/* Farm Profile Selection */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 z-10 w-full overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-forest-900 text-lg font-devanagari flex items-center gap-2">
              <Sprout className="text-forest-600 w-5 h-5" />
              {language === 'en' ? 'My Farms' : 'मेरे खेत'}
            </h2>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar w-full">
            {farms.map(f => (
              <div 
                key={f.id} 
                onClick={() => setSelectedFarm(f)}
                className={clsx(
                  "min-w-[220px] max-w-[260px] shrink-0 p-4 rounded-xl border-2 cursor-pointer transition-colors",
                  selectedFarm?.id === f.id ? "border-forest-500 bg-forest-50" : "border-gray-100 hover:border-forest-200 bg-white"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-900 truncate pr-2">{f.name}</h3>
                  {selectedFarm?.id === f.id && <CheckCircle2 className="w-5 h-5 text-forest-500 shrink-0" />}
                </div>
                <div className="text-sm text-gray-600 truncate mt-1">
                  {f.crops?.length > 0 ? f.crops.slice(0, 2).join(', ') + (f.crops.length > 2 ? '...' : '') : (f as any).crop} • {f.area} Acres
                </div>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0"/> <span className="truncate">{formatLocationLine(f.district, f.state)}</span></p>
              </div>
            ))}
          </div>
          <button onClick={() => setIsFarmFormOpen(true)} className="text-forest-600 font-medium text-sm hover:underline mt-2">
            + {language === 'en' ? 'Add New Farm' : 'नया खेत जोड़ें'}
          </button>
        </div>

        {/* Weather Widget */}
        <div className="bg-gradient-to-br from-[#1B4332] to-[#064e3b] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            {weatherLoading ? (
              <div className="w-full space-y-3 py-4">
                <div className="skeleton h-12 w-48 mx-auto bg-white/20" />
                <div className="skeleton h-8 w-full max-w-md mx-auto bg-white/10" />
              </div>
            ) : weatherError ? (
              <div className="w-full text-center py-4 text-red-100 font-devanagari">
                ⚠️ {weatherError}
                <button type="button" className="block mx-auto mt-3 text-sm underline" onClick={() => window.location.reload()}>
                  {UI.tryAgainEn}
                </button>
              </div>
            ) : (
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 w-full">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold mb-1">{weather?.temp ?? '--'}°C</div>
                <div className="text-white/70 text-sm font-devanagari">
                  {weatherLocation || (language === 'hi' ? 'स्थान खोज रहे हैं...' : 'Detecting location...')}
                </div>
              </div>
              <div className="w-px h-16 bg-white/20 hidden sm:block"></div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2"><Droplets className="w-4 h-4 text-blue-300" /> {weather?.humidity ?? '--'}% Humidity</div>
                <div className="flex items-center gap-2"><CloudRain className="w-4 h-4 text-blue-200" /> {weather?.rainChance ?? '--'}% Rain</div>
                <div className="flex items-center gap-2"><Wind className="w-4 h-4 text-gray-300" /> {weather?.windSpeed ?? '--'} km/h</div>
              </div>
            </div>
            
            <div className="flex gap-3">
              {weather?.forecast.map((day, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center min-w-[80px] border border-white/10">
                  <div className="text-xs text-forest-200 mb-1">{day.day}</div>
                  <day.icon className="w-6 h-6 mx-auto mb-1 text-gold-400" />
                  <div className="font-bold">{day.temp}°C</div>
                </div>
              ))}
            </div>
            </div>
            )}
          </div>
          
          {weather && !weatherLoading && weather.rainChance > 60 && (
            <div className="mt-4 bg-[#FEF3C7]/95 border border-[#F59E0B]/40 rounded-xl p-3 flex items-center gap-3 text-[#92400e]">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0" />
              <p className="text-sm font-medium font-devanagari">
                ⚠️ कल बारिश की संभावना — सिंचाई न करें
              </p>
            </div>
          )}
        </div>

        {/* Soil Moisture (Simulated IoT) */}
        {selectedFarm && (
          <SoilMoistureCard
            soilType={selectedFarm.soil}
            season={selectedFarm.season}
            weatherCondition={(weather?.rainChance ?? 0) > 60 ? 'Rainy' : (weather?.temp ?? 0) > 35 ? 'Hot' : 'Clear'}
            recentRainfall={(weather?.rainChance ?? 0) > 50}
          />
        )}

        {/* Advisory Chat */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[500px]">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-forest-50 rounded-t-2xl">
            <div className="w-10 h-10 bg-forest-600 rounded-full flex items-center justify-center text-white">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-forest-900 font-devanagari">{t('adv_ai_advisor')}</h2>
              <p className="text-xs text-forest-600 font-devanagari">{language === 'en' ? 'AI खेत सलाहकार' : 'AI Farm Advisor'}</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
            {messages.length === 0 && selectedFarm && (
              <div className="text-center text-gray-400 my-8">
                <Leaf className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-devanagari">{t('adv_ask_about')} {primaryCrop(selectedFarm)} {t('adv_crop_text')}.</p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={clsx(
                  "max-w-[80%] rounded-2xl p-4 shadow-sm",
                  msg.role === 'user' 
                    ? "bg-forest-600 text-white rounded-tr-none" 
                    : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"
                )}>
                  {msg.role === 'ai' && (
                    <div className="flex items-center gap-2 mb-2 text-forest-600 font-medium text-sm border-b border-gray-50 pb-2 font-devanagari">
                      <Leaf className="w-4 h-4" /> {t('adv_ai_advisor')}
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)/g, '• $1') }} />
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-forest-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-forest-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-forest-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-gray-100 rounded-b-2xl">
            <div className="flex flex-wrap gap-2 mb-3">
              {quickQuestions.map((q, i) => (
                <button 
                  key={i}
                  onClick={() => handleSendMessage(q)}
                  className="text-xs bg-forest-50 text-forest-700 px-3 py-1.5 rounded-full hover:bg-forest-100 transition-colors border border-forest-100"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleListening}
                className={clsx(
                  "p-3 rounded-xl transition-colors flex items-center justify-center",
                  isListening ? "bg-red-100 text-red-600 animate-pulse" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('adv_chat_placeholder')}
                className="flex-1 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-forest-500 focus:ring-forest-500 p-3 border outline-none"
              />
              <button 
                onClick={() => handleSendMessage(input)}
                disabled={!input.trim() || isTyping || !selectedFarm}
                className="bg-gold-500 hover:bg-gold-600 text-white p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

      {/* Crop Planning Advisor */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-forest-900 font-devanagari">{t('ins_plan_title')}</h2>
            <p className="text-gray-500 font-devanagari">{t('ins_plan_sub')}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
              <Calendar className="w-4 h-4 text-gray-400" />
              <select value={planMonth} onChange={e => setPlanMonth(e.target.value)} className="bg-transparent text-sm font-medium outline-none">
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
              <Map className="w-4 h-4 text-gray-400" />
              <input type="number" value={planAcres} onChange={e => setPlanAcres(Number(e.target.value))} className="w-12 bg-transparent text-sm font-medium outline-none" min="1" />
              <span className="text-sm text-gray-500 font-devanagari">{t('ins_acres')}</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
              <Droplets className="w-4 h-4 text-gray-400" />
              <select value={planWater} onChange={e => setPlanWater(e.target.value)} className="bg-transparent text-sm font-medium outline-none">
                <option value="Canal">Canal</option>
                <option value="Tubewell">Tubewell</option>
                <option value="Rainfed">Rainfed</option>
              </select>
            </div>
            <button 
              onClick={handleCropPlan}
              disabled={planning}
              className="bg-forest-600 hover:bg-forest-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-70 flex items-center gap-2 font-devanagari"
            >
              {planning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : t('ins_plan_btn')}
            </button>
          </div>
        </div>

        {planError && <p className="text-red-500 text-center mb-4 font-devanagari">{planError}</p>}

        {cropPlans.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cropPlans.map((plan, index) => (
              <motion.div 
                key={`${plan.crop_name}-${index}`}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}
                className={clsx(
                  "rounded-xl p-5 border relative overflow-hidden flex flex-col",
                  index === 0 ? "bg-gradient-to-b from-gold-50 to-white border-gold-200 shadow-md" : "bg-white border-gray-100 shadow-sm"
                )}
              >
                <div className="absolute top-0 right-0 w-12 h-12 flex items-start justify-end p-2">
                  <Award className={clsx(
                    "w-6 h-6",
                    index === 0 ? "text-gold-500" : index === 1 ? "text-gray-400" : "text-amber-600"
                  )} />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-1">#{index + 1} {plan.crop_name}</h3>
                <span className={clsx(
                  "inline-block px-2.5 py-0.5 rounded-md text-xs font-bold mb-4 w-fit",
                  plan.risk_level === 'Low' ? "bg-green-100 text-green-800" :
                  plan.risk_level === 'Medium' ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                )}>{plan.risk_level} {t('ins_risk')}</span>

                <div className="space-y-3 mb-6 flex-1">
                  <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                    <span className="text-gray-500 font-devanagari">{t('ins_est_yield')}</span>
                    <span className="font-medium text-gray-900">{plan.estimated_yield_per_acre}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                    <span className="text-gray-500 font-devanagari">{t('ins_market_price')}</span>
                    <span className="font-medium text-gray-900">{plan.market_price_range}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                    <span className="text-gray-500 font-devanagari">{t('ins_input_cost')}</span>
                    <span className="font-medium text-gray-900">{plan.input_cost_estimate}</span>
                  </div>
                  <div className="flex justify-between text-sm bg-green-50 p-2 rounded-lg border border-green-100">
                    <span className="text-green-800 font-medium font-devanagari">{t('ins_est_profit')}</span>
                    <span className="font-bold text-green-700">{plan.profit_estimate}</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-600 italic border border-gray-100 font-devanagari">
                  "{plan.reasoning_hindi}"
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-2xl">
            <Sprout className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-devanagari">{t('ins_plan_empty')}</p>
          </div>
        )}
      </div>

      </div>

      {/* Alerts Panel */}
      <div className="w-full lg:w-80 space-y-4">
        <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
          <Bell className="w-5 h-5 text-forest-600" /> {t('adv_active_alerts')}
        </h2>
        
        <div className="space-y-3">
          {weather && weather.humidity > 75 && selectedFarm && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-800 text-sm font-devanagari">{t('adv_high_pest')}</h3>
                <p className="text-xs text-red-600 mt-1">High humidity ({weather.humidity}%) increases chance of fungal diseases in {primaryCrop(selectedFarm)}. Monitor closely.</p>
              </div>
            </div>
          )}
          
          {selectedFarm && (
            <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl flex gap-3">
              <Droplets className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-yellow-800 text-sm font-devanagari">{t('adv_irrigation_reminder')}</h3>
                <p className="text-xs text-yellow-700 mt-1">Based on your sowing date, {primaryCrop(selectedFarm)} might need its next irrigation cycle soon.</p>
              </div>
            </div>
          )}
          
          {selectedFarm && weather && (
            <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-green-800 text-sm font-devanagari">{t('adv_favorable')}</h3>
                <p className="text-xs text-green-700 mt-1">Current temperature is optimal for {primaryCrop(selectedFarm)} growth.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <FarmFormModal 
        isOpen={isFarmFormOpen} 
        onClose={() => setIsFarmFormOpen(false)} 
        onSuccess={() => { setIsFarmFormOpen(false); loadFarms(); }} 
      />
    </div>
  );
}
