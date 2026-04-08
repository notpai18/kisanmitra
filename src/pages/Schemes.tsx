import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { db, doc, getDoc, isMockConfig } from '../lib/firebase';
import { collection, getDocs, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import LocationSelector from '../components/LocationSelector';
import { Landmark, Search, Filter, Sparkles, ChevronRight, CheckCircle2, XCircle, Calendar, MapPin, Phone, ShoppingCart, Tractor } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { formatRupee } from '../lib/formatters';
import { UI } from '../constants/translations';

const SCHEMES_DATA = [
  {
    name: 'UP Kisan Karj Rahat Yojana',
    nameHi: 'यूपी किसान कर्ज राहत योजना',
    description: 'UP government scheme for small and marginal farmers',
    category: 'Loan',
    benefit: 'Loan waiver up to ₹1 lakh for UP farmers',
    benefitHi: 'उत्तर प्रदेश किसानों को ₹1 लाख तक कर्ज माफी',
    details: 'UP government scheme for small and marginal farmers',
    link: 'https://upkisankarjrahat.upsdc.gov.in',
  },
  {
    name: "PM-KISAN",
    description: "₹6000/year direct income support to farmers.",
    category: "Subsidy",
    benefit: "₹6000/year",
    details: "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) is a central sector scheme that provides income support to all landholding farmers' families in the country to supplement their financial needs.",
    link: "https://pmkisan.gov.in"
  },
  {
    name: "Pradhan Mantri Fasal Bima Yojana",
    description: "Crop insurance with low premium rates.",
    category: "Insurance",
    benefit: "2% premium",
    details: "PMFBY provides a comprehensive insurance cover against failure of the crop thus helping in stabilizing the income of the farmers.",
    link: "https://pmfby.gov.in"
  },
  {
    name: "Kisan Credit Card",
    description: "Credit support for agricultural needs.",
    category: "Loan",
    benefit: "Up to ₹3 lakh at 4%",
    details: "The KCC scheme aims to provide adequate and timely credit support from the banking system under a single window to the farmers for their cultivation & other needs.",
    link: "https://www.nabard.org/content.aspx?id=580"
  },
  {
    name: "PM Krishi Sinchai Yojana",
    description: "Subsidy on micro-irrigation systems.",
    category: "Subsidy",
    benefit: "55% subsidy",
    details: "PMKSY aims to enhance physical access of water on farm and expand cultivable area under assured irrigation, improve on-farm water use efficiency.",
    link: "https://pmksy.gov.in"
  },
  {
    name: "Soil Health Card Scheme",
    description: "Free soil testing and nutrient recommendations.",
    category: "Training",
    benefit: "Free testing",
    details: "The scheme aims at promoting soil test based and balanced use of fertilizers to enable farmers to realize higher yields at lower cost.",
    link: "https://soilhealth.dac.gov.in"
  },
  {
    name: "e-NAM",
    description: "National Agriculture Market online trading platform.",
    category: "Market",
    benefit: "Online trading",
    details: "e-NAM is a pan-India electronic trading portal which networks the existing APMC mandis to create a unified national market for agricultural commodities.",
    link: "https://www.enam.gov.in"
  },
  {
    name: "Rashtriya Krishi Vikas Yojana",
    description: "Grants for agricultural infrastructure.",
    category: "Subsidy",
    benefit: "Infra grants",
    details: "RKVY aims at achieving and sustaining desired annual growth in agriculture sector through development of infrastructure.",
    link: "https://rkvy.da.gov.in"
  },
  {
    name: "Paramparagat Krishi Vikas Yojana",
    description: "Support for organic farming.",
    category: "Subsidy",
    benefit: "Organic support",
    details: "PKVY is an elaborated component of Soil Health Management (SHM) of major project National Mission of Sustainable Agriculture (NMSA).",
    link: "https://pgsindia-ncof.gov.in/pkvy/index.aspx"
  }
];

const OFFICIAL_SCHEME_URLS: Record<string, string> = {
  'PM-KISAN': 'https://pmkisan.gov.in',
  'Kisan Credit Card': 'https://www.nabard.org/content.aspx?id=580',
  'Pradhan Mantri Fasal Bima Yojana': 'https://pmfby.gov.in',
  'PM Fasal Bima Yojana': 'https://pmfby.gov.in',
  'PM Krishi Sinchai Yojana': 'https://pmksy.gov.in',
  'PMKSY': 'https://pmksy.gov.in',
  'Soil Health Card': 'https://soilhealth.dac.gov.in',
  'Soil Health Card Scheme': 'https://soilhealth.dac.gov.in',
  'eNAM': 'https://www.enam.gov.in',
  'e-NAM': 'https://www.enam.gov.in',
  'RKVY': 'https://rkvy.da.gov.in',
  'Rashtriya Krishi Vikas Yojana': 'https://rkvy.da.gov.in',
};

function schemeUrl(name: string): string {
  return OFFICIAL_SCHEME_URLS[name] || 'https://www.india.gov.in/topics/agriculture';
}

const CATEGORIES = ['All', 'Subsidy', 'Loan', 'Insurance', 'Training', 'Market'];

const MOCK_PRODUCTS = {
  'Seeds': [
    { id: 's1', name: 'Wheat Seed HD-2967', hindiName: 'गेहूं बीज HD-2967', brand: 'Pusa', price: 1200, unit: '40kg bag' },
    { id: 's2', name: 'Rice Seed MTU-7029', hindiName: 'धान बीज MTU-7029', brand: 'Swarna', price: 850, unit: '25kg bag' },
    { id: 's3', name: 'Potato Seed Kufri', hindiName: 'आलू बीज कुफरी', brand: 'CPRI', price: 1500, unit: '50kg bag' },
    { id: 's4', name: 'Tomato Seed Abhinav', hindiName: 'टमाटर बीज अभिनव', brand: 'Syngenta', price: 450, unit: '10g pkt' },
    { id: 's5', name: 'Maize Seed Pioneer', hindiName: 'मक्का बीज पायनियर', brand: 'Pioneer', price: 1100, unit: '5kg bag' },
    { id: 's6', name: 'Mustard Seed Pusa', hindiName: 'सरसों बीज पूसा', brand: 'Pusa', price: 300, unit: '1kg pkt' }
  ],
  'Fertilizers': [
    { id: 'f1', name: 'Urea', hindiName: 'यूरिया', brand: 'IFFCO', price: 266, unit: '45kg bag' },
    { id: 'f2', name: 'DAP', hindiName: 'डीएपी', brand: 'IFFCO', price: 1350, unit: '50kg bag' },
    { id: 'f3', name: 'MOP', hindiName: 'एमओपी', brand: 'IPL', price: 1700, unit: '50kg bag' },
    { id: 'f4', name: 'NPK 12:32:16', hindiName: 'एनपीके 12:32:16', brand: 'IFFCO', price: 1470, unit: '50kg bag' },
    { id: 'f5', name: 'Zinc Sulphate', hindiName: 'जिंक सल्फेट', brand: 'Aries', price: 450, unit: '5kg bag' },
    { id: 'f6', name: 'Organic Compost', hindiName: 'जैविक खाद', brand: 'Local', price: 300, unit: '50kg bag' }
  ],
  'Pesticides': [
    { id: 'p1', name: 'Chlorpyrifos 20% EC', hindiName: 'क्लोरोपाइरीफॉस', brand: 'Bayer', price: 450, unit: '1L' },
    { id: 'p2', name: 'Imidacloprid 17.8% SL', hindiName: 'इमिडाक्लोप्रिड', brand: 'Tata', price: 850, unit: '500ml' },
    { id: 'p3', name: 'Mancozeb 75% WP', hindiName: 'मैन्कोज़ेब', brand: 'UPL', price: 350, unit: '500g' },
    { id: 'p4', name: 'Glyphosate 41% SL', hindiName: 'ग्लाइफोसेट', brand: 'Excel', price: 400, unit: '1L' },
    { id: 'p5', name: 'Neem Oil 10000 ppm', hindiName: 'नीम तेल', brand: 'Ozone', price: 550, unit: '1L' },
    { id: 'p6', name: 'Carbendazim 50% WP', hindiName: 'कार्बेन्डाजिम', brand: 'Crystal', price: 300, unit: '250g' }
  ],
  'Tools': [
    { id: 't1', name: 'Knapsack Sprayer', hindiName: 'स्प्रेयर मशीन', brand: 'Aspee', price: 2500, unit: '1 pc' },
    { id: 't2', name: 'Sickle', hindiName: 'हंसिया', brand: 'Local', price: 150, unit: '1 pc' },
    { id: 't3', name: 'Spade', hindiName: 'फावड़ा', brand: 'Tata Agrico', price: 450, unit: '1 pc' },
    { id: 't4', name: 'Pruning Shears', hindiName: 'कटाई कैंची', brand: 'Falcon', price: 350, unit: '1 pc' },
    { id: 't5', name: 'Water Pump 2HP', hindiName: 'वाटर पंप', brand: 'Crompton', price: 8500, unit: '1 pc' },
    { id: 't6', name: 'Tarpaulin Sheet', hindiName: 'तिरपाल', brand: 'Silpaulin', price: 1200, unit: '15x15 ft' }
  ]
};

const productImages: Record<string, string> = {
  // Seeds
  'Wheat Seed HD-2967': 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=200',
  'Rice Seed MTU-7029': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=200',
  'Potato Seed Kufri': 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=200',
  'Tomato Seed Abhinav': 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=200',
  'Maize Seed Pioneer': 'https://images.unsplash.com/photo-1601593346740-925612772716?w=200',
  'Mustard Seed Pusa': 'https://images.unsplash.com/photo-1628689469838-524a4a973b8e?w=200',

  // Fertilizers
  Urea: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200',
  DAP: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200',
  NPK: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200',

  // Pesticides
  Fungicide: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=200',
  Insecticide: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=200',
  Herbicide: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=200',
};

const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200';

const MOCK_EQUIPMENT = [
  { id: 'e1', name: 'Tractor', hindiName: 'ट्रैक्टर', price: 800, available: true },
  { id: 'e2', name: 'Rotavator', hindiName: 'रोटावेटर', price: 500, available: true },
  { id: 'e3', name: 'Thresher', hindiName: 'थ्रेशर', price: 600, available: true },
  { id: 'e4', name: 'Sprayer', hindiName: 'स्प्रेयर', price: 150, available: true },
  { id: 'e5', name: 'Harvester', hindiName: 'हार्वेस्टर', price: 2500, available: true },
  { id: 'e6', name: 'Seed Drill', hindiName: 'सीड ड्रिल', price: 400, available: true }
];

type SchemeRow = (typeof SCHEMES_DATA)[0] & { id?: string };

export default function Schemes() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [schemes, setSchemes] = useState<SchemeRow[]>(SCHEMES_DATA);
  const [schemesInitLoading, setSchemesInitLoading] = useState(true);
  const [schemesInitError, setSchemesInitError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const [findingSchemes, setFindingSchemes] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  
  const [selectedScheme, setSelectedScheme] = useState<any | null>(null);

  const [selectedProductCategory, setSelectedProductCategory] = useState('Seeds');
  const { items: cartItems, addToCart, removeFromCart, updateQuantity } = useCart();

  const [bookingEquipment, setBookingEquipment] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingDuration, setBookingDuration] = useState(1);
  const [bookingState, setBookingState] = useState('Uttar Pradesh');
  const [bookingDistrict, setBookingDistrict] = useState('');
  const [bookingVillage, setBookingVillage] = useState('');
  const [bookingContact, setBookingContact] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingLocErr, setBookingLocErr] = useState({ district: '' });

  useEffect(() => {
    const initSchemes = async () => {
      if (isMockConfig) {
        setSchemesInitLoading(false);
        return;
      }
      setSchemesInitLoading(true);
      setSchemesInitError(null);
      try {
        const schemesRef = collection(db, 'schemes');
        const snapshot = await getDocs(schemesRef);
        if (snapshot.empty) {
          for (const scheme of SCHEMES_DATA) {
            await addDoc(schemesRef, scheme);
          }
          const again = await getDocs(schemesRef);
          setSchemes(again.docs.map((d) => ({ id: d.id, ...(d.data() as SchemeRow) })));
        } else {
          setSchemes(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as SchemeRow) })));
        }
      } catch (error) {
        console.error('Error initializing schemes:', error);
        setSchemesInitError(UI.errorTitleEn);
        toast.error(UI.errorTitleEn);
      } finally {
        setSchemesInitLoading(false);
      }
    };
    initSchemes();
  }, []);

  const filteredSchemes = schemes.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleFindSchemes = async () => {
    if (!user) return;
    setFindingSchemes(true);
    try {
      const profileDoc = await getDoc(doc(db, `users/${user.uid}/farmProfile/profile`));
      const base = profileDoc.exists() ? profileDoc.data() : { acres: 2, crop: 'Wheat', soil: 'Loam' };
      const farmsSnap = await getDocs(collection(db, `users/${user.uid}/farms`));
      const firstFarm = farmsSnap.docs[0]?.data() as { area?: number; crops?: string[]; crop?: string; soil?: string; state?: string; district?: string } | undefined;
      const profile = {
        ...base,
        acres: firstFarm?.area ?? (base as { acres?: number }).acres ?? 2,
        crop: firstFarm?.crops?.[0] ?? firstFarm?.crop ?? (base as { crop?: string }).crop ?? 'Wheat',
        soil: firstFarm?.soil ?? (base as { soil?: string }).soil ?? 'Loam',
        state: firstFarm?.state ?? (base as { state?: string }).state ?? '',
        district: firstFarm?.district ?? (base as { district?: string }).district ?? '',
      };

      const res = await fetch('/api/scheme-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, schemes, language })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.message || data.error || 'Failed to find schemes');
      setAiRecommendations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error(UI.aiUnavailable);
    } finally {
      setFindingSchemes(false);
    }
  };

  const handleBookEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !bookingEquipment) return;
    setBookingLocErr({ district: '' });
    if (!bookingDistrict.trim()) {
      setBookingLocErr((p) => ({ ...p, district: t('loc_err_district') }));
      return;
    }
    setBookingSubmitting(true);
    try {
      if (!isMockConfig) {
        await addDoc(collection(db, 'equipment_bookings'), {
          userId: user.uid,
          equipmentId: bookingEquipment.id,
          equipmentName: bookingEquipment.name,
          startDate: bookingDate,
          durationDays: bookingDuration,
          state: 'Uttar Pradesh',
          district: bookingDistrict,
          villageOrLandmark: bookingVillage.trim() || null,
          contact: bookingContact,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }
      toast.success(language === 'hi' ? 'बुकिंग सफलतापूर्वक सबमिट की गई!' : 'Booking submitted');
      setBookingEquipment(null);
      setBookingState('');
      setBookingDistrict('');
      setBookingVillage('');
    } catch (error) {
      console.error(error);
      toast.error(UI.errorTitleEn);
    } finally {
      setBookingSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-12">
      
      {/* SECTION 1: GOVERNMENT SCHEMES FINDER */}
      <section>
        <div className="flex items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <Landmark className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              {language === 'en' ? 'Sarkari Yojanaen' : 'सरकारी योजनाएं'}
            </h1>
            <p className="text-gray-500 mt-1">{t('sch_subtitle')}</p>
            <p className="text-sm text-forest-700 mt-1 font-devanagari">
              {language === 'hi' ? 'उत्तर प्रदेश के किसानों के लिए योजनाएं' : 'Schemes available for Uttar Pradesh farmers'}
            </p>
          </div>
          <button 
            onClick={handleFindSchemes}
            disabled={findingSchemes}
            className="hidden md:flex items-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white px-6 py-3 rounded-xl font-bold shadow-sm transition-all disabled:opacity-80"
          >
            {findingSchemes ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Sparkles className="w-5 h-5" />}
            {t('sch_find')}
          </button>
        </div>

        {/* Mobile AI Button */}
        <button 
          onClick={handleFindSchemes}
          disabled={findingSchemes}
          className="md:hidden w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white px-6 py-3 rounded-xl font-bold shadow-sm mb-6"
        >
          {findingSchemes ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Sparkles className="w-5 h-5" />}
          {t('sch_find')}
        </button>

        {/* AI Recommendations */}
        {aiRecommendations.length > 0 && (
          <div className="bg-gold-50 border border-gold-200 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-bold text-gold-800 flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5" /> Recommended for You
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {aiRecommendations.map((rec, idx) => {
                const scheme = schemes.find(s => s.name === rec.scheme_name);
                if (!scheme) return null;
                const href = schemeUrl(scheme.name);
                return (
                  <div key={`${rec.scheme_name}-${idx}`} className="bg-white rounded-xl p-4 border border-gold-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-900">{scheme.name}</h3>
                      <span className="bg-gold-100 text-gold-800 text-xs font-bold px-2 py-1 rounded-md">#{idx + 1}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{scheme.description}</p>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-xs font-bold text-gold-800 bg-gold-50 border border-gold-100 px-2 py-1 rounded-lg">
                        {scheme.benefit}
                      </span>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-forest-700 hover:underline shrink-0"
                      >
                        Know More →
                      </a>
                    </div>
                    <div className="bg-gold-50 p-2 rounded-lg text-xs text-gold-800 italic border border-gold-100 font-devanagari">
                      &ldquo;{rec.reasoning_hindi}&rdquo;
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder={t('sch_search')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex overflow-x-auto pb-2 md:pb-0 hide-scrollbar gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={clsx(
                  "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border",
                  selectedCategory === cat 
                    ? "bg-blue-600 text-white border-blue-600" 
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Schemes List */}
        <div className="space-y-4">
          {schemesInitLoading ? (
            <div className="space-y-4">
              <div className="skeleton h-28 w-full rounded-2xl" />
              <div className="skeleton h-28 w-full rounded-2xl" />
            </div>
          ) : schemesInitError ? (
            <div className="ds-card text-center border border-[#EF4444]/20 bg-red-50">
              <p className="text-[#EF4444] mb-4">⚠️ {schemesInitError}</p>
              <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
                {UI.tryAgainEn}
              </button>
            </div>
          ) : (
            <>
          {filteredSchemes.map((scheme) => {
            const href = schemeUrl(scheme.name);
            return (
            <div key={scheme.id ?? scheme.name} className="ds-card flex flex-col md:flex-row gap-4 items-start md:items-center hover:border-[#1B4332]/20 transition-colors border border-gray-100">
              <div className={clsx(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                scheme.category === 'Subsidy' ? "bg-green-100 text-green-600" :
                scheme.category === 'Loan' ? "bg-blue-100 text-blue-600" :
                scheme.category === 'Insurance' ? "bg-purple-100 text-purple-600" :
                "bg-orange-100 text-orange-600"
              )}>
                <Landmark className="w-6 h-6" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900 text-lg">{scheme.name}</h3>
                  <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">{scheme.category}</span>
                </div>
                <p className="text-gray-600 text-sm mb-2">{scheme.description}</p>
                <div className="inline-flex items-center gap-1 bg-gold-50 text-gold-700 px-2.5 py-1 rounded-lg text-sm font-bold border border-gold-200">
                  <Sparkles className="w-4 h-4" /> {scheme.benefit}
                </div>
              </div>

              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-auto bg-gray-50 hover:bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl font-medium transition-colors border border-gray-200 flex items-center justify-center gap-2"
              >
                {t('sch_know_more')} <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          )})}
          {filteredSchemes.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-500 font-devanagari">कोई योजना नहीं मिली।</p>
            </div>
          )}
            </>
          )}
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* SECTION 2: INPUT MARKETPLACE */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('sch_input_title')}</h2>
          <p className="text-gray-500 mt-1">{t('sch_input_sub')}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.keys(MOCK_PRODUCTS).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedProductCategory(cat)}
              className={clsx(
                "p-4 rounded-2xl border text-center transition-all",
                selectedProductCategory === cat 
                  ? "bg-forest-50 border-forest-500 shadow-sm" 
                  : "bg-white border-gray-200 hover:border-forest-300"
              )}
            >
              <div className={clsx(
                "w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2",
                selectedProductCategory === cat ? "bg-forest-100 text-forest-600" : "bg-gray-100 text-gray-500"
              )}>
                <ShoppingCart className="w-6 h-6" />
              </div>
              <p className={clsx("font-bold", selectedProductCategory === cat ? "text-forest-900" : "text-gray-700")}>{cat}</p>
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {MOCK_PRODUCTS[selectedProductCategory as keyof typeof MOCK_PRODUCTS].map(product => (
            <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <img
                src={productImages[product.name] || DEFAULT_PRODUCT_IMAGE}
                alt={product.name}
                className="w-full h-40 object-cover rounded-t-xl"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                }}
              />
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-gray-900">{language === 'hi' ? product.hindiName : product.name}</h3>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md">{product.brand}</span>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-[#1B4332]">{formatRupee(product.price)}</p>
                    <p className="text-xs text-gray-500">per {product.unit}</p>
                  </div>
                  {(() => {
                    const cartItem = cartItems.find((item) => item.id === product.id);
                    const count = cartItem ? cartItem.quantity : 0;
                    
                    if (count > 0) {
                      return (
                        <div className="flex items-center justify-between bg-forest-50 border border-forest-200 rounded-xl px-2 min-w-[100px] h-9">
                          <button onClick={() => count === 1 ? removeFromCart(product.id) : updateQuantity(product.id, count - 1)} className="text-forest-600 font-bold p-1 w-6 hover:bg-forest-100 rounded flex items-center justify-center transition-colors">−</button>
                          <span className="font-bold text-forest-900 min-w-[20px] text-center">{count}</span>
                          <button onClick={() => updateQuantity(product.id, count + 1)} className="text-forest-600 font-bold p-1 w-6 hover:bg-forest-100 rounded flex items-center justify-center transition-colors">+</button>
                        </div>
                      );
                    }
                    
                    return (
                      <button 
                        onClick={() => {
                          addToCart({
                            id: product.id,
                            name: language === 'hi' ? product.hindiName : product.name,
                            price: product.price,
                            category: selectedProductCategory
                          });
                          toast.success(language === 'hi' ? 'कार्ट में जोड़ा गया' : 'Added to cart');
                        }}
                        className="bg-forest-600 hover:bg-forest-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors h-9"
                      >
                        {t('sch_add_cart')}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* SECTION 3: EQUIPMENT RENTAL */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('sch_rent_title')}</h2>
          <p className="text-gray-500 mt-1">{t('sch_rent_sub')}</p>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {MOCK_EQUIPMENT.map(eq => (
            <div key={eq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
                <Tractor className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">{language === 'hi' ? eq.hindiName : eq.name}</h3>
                <p className="font-bold text-orange-600">{formatRupee(eq.price)}<span className="text-xs text-gray-500 font-normal"> / day</span></p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {eq.available ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Available
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">
                    <XCircle className="w-3 h-3" /> Booked
                  </span>
                )}
                <button 
                  onClick={() => setBookingEquipment(eq)}
                  disabled={!eq.available}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors"
                >
                  {t('sch_book')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Scheme Details Modal */}
      <AnimatePresence>
        {selectedScheme && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedScheme.name}</h2>
                  <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">{selectedScheme.category}</span>
                </div>
                <button onClick={() => setSelectedScheme(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="bg-gold-50 text-gold-800 p-4 rounded-xl mb-6 border border-gold-100 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gold-600 uppercase tracking-wider">Key Benefit</p>
                    <p className="font-bold text-lg">{selectedScheme.benefit}</p>
                  </div>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">About the Scheme</h3>
                <p className="text-gray-600 leading-relaxed mb-6">{selectedScheme.details}</p>
                
                <a 
                  href={selectedScheme.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                  Visit Official Website <ChevronRight className="w-5 h-5" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Equipment Booking Modal */}
      <AnimatePresence>
        {bookingEquipment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Book Equipment</h2>
                <button onClick={() => setBookingEquipment(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleBookEquipment} className="p-6 overflow-y-auto space-y-4">
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900">{bookingEquipment.name}</p>
                    <p className="text-sm text-gray-600">{bookingEquipment.hindiName}</p>
                  </div>
                  <p className="font-bold text-orange-600">{formatRupee(bookingEquipment.price)}/day</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="date" 
                      required
                      value={bookingDate}
                      onChange={e => setBookingDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Days)</label>
                  <input 
                    type="number" 
                    required min="1"
                    value={bookingDuration}
                    onChange={e => setBookingDuration(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>

                <LocationSelector
                  label
                  selectedState={bookingState}
                  selectedDistrict={bookingDistrict}
                  onStateChange={(s) => {
                    setBookingState(s);
                  }}
                  onDistrictChange={setBookingDistrict}
                  districtError={bookingLocErr.district}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('sch_village_optional')}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={bookingVillage}
                      onChange={(e) => setBookingVillage(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="tel" 
                      required placeholder="10-digit number" pattern="[0-9]{10}"
                      value={bookingContact}
                      onChange={e => setBookingContact(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-between items-center mb-4">
                  <span className="font-medium text-gray-700">Total Amount:</span>
                  <span className="text-xl font-bold text-gray-900">{formatRupee(bookingEquipment.price * bookingDuration)}</span>
                </div>

                <button 
                  type="submit"
                  disabled={bookingSubmitting}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-80"
                >
                  {bookingSubmitting ? 'Submitting...' : 'Confirm Booking'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
