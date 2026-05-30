import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout, Stethoscope, Store, TrendingUp, ArrowRight, Star } from 'lucide-react';
import { motion, useInView } from 'motion/react';
import { useRef, useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
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
    <div ref={ref} className="text-center p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-white/20 transform hover:-translate-y-2 transition-all duration-300">
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
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col overflow-x-hidden">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative bg-forest-900 text-white min-h-[90vh] flex items-center overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-forest-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-forest-800/50 backdrop-blur-md border border-forest-700/50 text-gold-400 text-sm font-bold mb-8 shadow-xl shadow-black/20"
            >
              <Star className="w-4 h-4 fill-gold-400" />
              <span>{language === 'en' ? 'Trusted by 10,000+ Farmers' : '10,000+ किसानों द्वारा विश्वसनीय'}</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 font-devanagari leading-[1.1]"
            >
              {t('hero_title').split(' ').map((word, i) => (
                <span key={i} className={i === 1 ? "text-gold-400" : ""}>{word} </span>
              ))}
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-xl md:text-2xl text-forest-100/90 mb-12 max-w-2xl mx-auto lg:mx-0 font-devanagari leading-relaxed"
            >
              {t('hero_subtitle')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6"
            >
              <button
                onClick={() => navigate('/role-selection')}
                className="group relative bg-gold-500 hover:bg-gold-400 text-forest-900 font-black text-xl px-10 py-5 rounded-2xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-[0_10px_40px_-10px_rgba(234,179,8,0.5)] font-devanagari overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <span className="relative z-10">{t('get_started')}</span>
                <ArrowRight className="w-6 h-6 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </div>
          
          <div className="lg:w-1/2 flex justify-center relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative w-72 h-72 md:w-[500px] md:h-[500px]"
            >
              <div className="absolute inset-0 bg-gold-500/20 rounded-full blur-[100px] animate-pulse"></div>
              <div className="relative w-full h-full rounded-[2rem] overflow-hidden border-8 border-forest-800 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-700">
                <img 
                  src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800"
                  alt="Indian farmer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest-900/60 to-transparent"></div>
              </div>
              
              {/* Floating Cards */}
              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="absolute -bottom-10 -left-10 bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-2xl border border-white/20 flex items-center gap-4"
              >
                <div className="bg-forest-500 p-3 rounded-2xl text-white">
                  <Sprout className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-forest-900 font-bold text-lg">Smart Crop</div>
                  <div className="text-forest-500 font-bold">98% Accuracy</div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 15, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 1 }}
                className="absolute -top-10 -right-10 bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-2xl border border-white/20 flex items-center gap-4"
              >
                <div className="bg-gold-500 p-3 rounded-2xl text-forest-900">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-forest-900 font-bold text-lg">Live Market</div>
                  <div className="text-gold-600 font-bold">Best Prices</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Impact Counters */}
      <section className="relative -mt-12 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <AnimatedStat value={10} suffix="k+" label={language === 'en' ? 'Active Farmers' : 'सक्रिय किसान'} />
            <AnimatedStat value={50} suffix="M+" label={language === 'en' ? 'Traded (₹)' : 'व्यापार (₹)'} />
            <AnimatedStat value={98} suffix="%" label={language === 'en' ? 'AI Accuracy' : 'एआई सटीकता'} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-forest-900 font-devanagari mb-6"
          >
            {t('features_heading')}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-500 font-devanagari max-w-3xl mx-auto"
          >
            {t('features_subheading')}
          </motion.p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ y: -10 }}
              className="group bg-white p-10 rounded-[2.5rem] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_60px_-15px_rgba(34,197,94,0.15)] transition-all duration-500 border border-gray-100 flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 bg-forest-50 rounded-3xl flex items-center justify-center mb-8 group-hover:bg-forest-500 group-hover:text-white transition-colors duration-500 shadow-inner">
                <feature.icon className="w-10 h-10 text-forest-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4 font-devanagari">{t(feature.titleKey)}</h3>
              <p className="text-gray-500 leading-relaxed font-devanagari text-lg">{t(feature.descKey)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}

