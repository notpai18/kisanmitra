import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { X, Sprout, Landmark, ScanFace, ChevronRight } from 'lucide-react';

const steps = [
  {
    id: 1,
    title: "Welcome to KisanMitra",
    titleHi: "किसान मित्र में आपका स्वागत है",
    desc: "Your AI farming assistant.",
    descHi: "आपका एआई कृषक सहायक।",
    icon: Sprout,
    color: "text-forest-600 bg-forest-50"
  },
  {
    id: 2,
    title: "Set up your Farm",
    titleHi: "अपना खेत सेट करें",
    desc: "Tell us about your crops and location for tailored advice.",
    descHi: "सही सलाह के लिए अपने खेत और स्थान की जानकारी दें।",
    icon: Landmark,
    color: "text-blue-600 bg-blue-50"
  },
  {
    id: 3,
    title: "Get AI Advice",
    titleHi: "एआई से सलाह लें",
    desc: "Scan diseases, check market prices, and find government schemes.",
    descHi: "बीमारियों को स्कैन करें, बाजार मूल्य जांचें और योजनाएं खोजें।",
    icon: ScanFace,
    color: "text-purple-600 bg-purple-50"
  }
];

export default function OnboardingModal() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Only show if user is logged in
    if (!user) return;
    const hasSeen = localStorage.getItem(`onboard_${user.uid}`);
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, [user]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    if (user) {
      localStorage.setItem(`onboard_${user.uid}`, 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const step = steps[currentStep];
  const Icon = step.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-[2rem] shadow-2xl relative z-10 w-full max-w-md overflow-hidden flex flex-col items-center p-8 text-center"
        >
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex gap-2 mb-8">
            {steps.map((s, i) => (
              <div 
                key={s.id} 
                className={`h-2 rounded-full transition-all duration-300 ${i === currentStep ? 'w-8 bg-forest-600' : 'w-2 bg-gray-200'}`}
              />
            ))}
          </div>

          <motion.div 
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm ${step.color}`}
          >
            <Icon className="w-12 h-12" />
          </motion.div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3 font-devanagari">
            {language === 'hi' ? step.titleHi : step.title}
          </h2>
          <p className="text-gray-500 mb-8 font-devanagari min-h-[48px]">
            {language === 'hi' ? step.descHi : step.desc}
          </p>

          <button
            onClick={handleNext}
            className="w-full bg-forest-600 hover:bg-forest-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            {currentStep === steps.length - 1 
              ? (language === 'hi' ? 'शुरू करें' : 'Get Started')
              : (language === 'hi' ? 'अगला' : 'Continue')}
            <ChevronRight className="w-5 h-5" />
          </button>
          
          {currentStep < steps.length - 1 && (
            <button
              onClick={handleClose}
              className="mt-4 text-sm font-medium text-gray-400 hover:text-gray-600"
            >
              {language === 'hi' ? 'अभी छोड़ें' : 'Skip for now'}
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
