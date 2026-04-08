import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout, Stethoscope, Store, TrendingUp, ArrowRight } from 'lucide-react';
import { motion, useInView } from 'motion/react';
import { useRef, useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useLanguage } from '../contexts/LanguageContext';
import { TranslationKey } from '../lib/translations';

function AnimatedStat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      const timer = setInterval(() => {
        start += increment;
        if (start >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return (
    <div ref={ref} className="text-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100 transform hover:-translate-y-1 transition-transform">
      <div className="text-4xl md:text-5xl font-bold text-forest-600 mb-2 font-devanagari">
        {count}{suffix}
      </div>
      <div className="text-gray-500 font-medium font-devanagari text-lg">{label}</div>
    </div>
  );
}
export default function Landing() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const features: { icon: typeof Sprout; titleKey: TranslationKey; descKey: TranslationKey }[] = [
    { icon: Sprout, titleKey: 'feature_advisory_title', descKey: 'feature_advisory_desc' },
    { icon: Stethoscope, titleKey: 'feature_doctor_title', descKey: 'feature_doctor_desc' },
    { icon: Store, titleKey: 'feature_market_title', descKey: 'feature_market_desc' },
    { icon: TrendingUp, titleKey: 'feature_insights_title', descKey: 'feature_insights_desc' },
  ];

  return (
    <div className="min-h-screen bg-bg-light flex flex-col">
      <Navbar />
      


      {/* Hero Section */}
      <section className="relative bg-forest-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 relative z-10 flex flex-col lg:flex-row items-center">
          <div className="lg:w-1/2 text-center lg:text-left">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 font-devanagari"
            >
              {t('hero_title')}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg md:text-xl text-forest-100 mb-10 max-w-2xl mx-auto lg:mx-0 font-devanagari"
            >
              {t('hero_subtitle')}
            </motion.p>
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => navigate('/role-selection')}
              className="bg-gold-500 hover:bg-gold-400 text-forest-900 font-bold text-lg px-8 py-4 rounded-full inline-flex items-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-gold-500/20 font-devanagari"
            >
              {t('get_started')} <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
          
          <div className="lg:w-1/2 mt-16 lg:mt-0 flex justify-center relative">
            <motion.div
              animate={{ y: [0, -20, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="relative w-64 h-64 md:w-96 md:h-96"
            >
              <div className="absolute inset-0 bg-forest-800 rounded-full blur-3xl opacity-50"></div>
              <img 
                src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=600"
                alt="Indian farmer in green field"
                loading="lazy"
                className="w-full h-full object-cover rounded-full border-4 border-[#1B4332] shadow-2xl"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=600';
                }}
              />
              <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-2xl shadow-xl">
                <Sprout className="w-10 h-10 text-forest-500" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Impact Counters */}
      <section className="bg-forest-50 py-16 border-y border-forest-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <AnimatedStat value={10} suffix="k+" label={language === 'en' ? 'Active Farmers' : 'सक्रिय किसान'} />
            <AnimatedStat value={50} suffix="M+" label={language === 'en' ? 'Traded (₹)' : 'व्यापार (₹)'} />
            <AnimatedStat value={98} suffix="%" label={language === 'en' ? 'AI Accuracy' : 'एआई सटीकता'} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-forest-900 font-devanagari">{t('features_heading')}</h2>
          <p className="text-gray-500 mt-4 font-devanagari">{t('features_subheading')}</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-shadow border border-gray-50"
            >
              <div className="w-12 h-12 bg-forest-50 rounded-xl flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6 text-forest-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 font-devanagari">{t(feature.titleKey)}</h3>
              <p className="text-gray-500 leading-relaxed font-devanagari">{t(feature.descKey)}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
