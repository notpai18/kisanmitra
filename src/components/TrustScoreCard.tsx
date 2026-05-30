import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ShieldCheck, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TrustScoreCardProps {
  className?: string;
}

interface UserProfile {
  name?: string;
  totalArea?: number;
  recentSales?: number;
}

export default function TrustScoreCard({ className = '' }: TrustScoreCardProps) {
  const { userData } = useAuth();
  const { language } = useLanguage();
  const [showInfo, setShowInfo] = useState(false);

  const { score, status, colorClass, statusLabel } = useMemo(() => {
    const profile: UserProfile = {
      name: userData?.name,
      totalArea: (userData as any)?.totalArea || 0,
      recentSales: (userData as any)?.recentSales || 0,
    };

    // Calculate TrustScore (same logic as CreditApplyModal)
    let score = 500;
    if (profile.name) score += 100;
    if (profile.totalArea > 0) score += 150;
    if (profile.recentSales > 0) score += 100;
    if (userData?.phone) score += 50;
    if (userData?.aadhaarLast4) score += 100;
    if (userData?.trustScore?.verified) score += 100;
    score = Math.min(1000, score);

    // Determine status
    let status: 'excellent' | 'good' | 'building';
    let colorClass: string;
    let statusLabel: string;

    if (score > 800) {
      status = 'excellent';
      colorClass = 'text-green-600 bg-green-50 border-green-200';
      statusLabel = language === 'hi' ? 'उत्कृष्ट' : 'Excellent';
    } else if (score >= 600) {
      status = 'good';
      colorClass = 'text-blue-600 bg-blue-50 border-blue-200';
      statusLabel = language === 'hi' ? 'अच्छा' : 'Good';
    } else {
      status = 'building';
      colorClass = 'text-orange-600 bg-orange-50 border-orange-200';
      statusLabel = language === 'hi' ? 'बन रहा है' : 'Building';
    }

    return { score, status, colorClass, statusLabel };
  }, [userData, language]);

  // SVG circle calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 1000) * circumference;
  const strokeDashoffset = circumference - progress;

  // Score to color mapping
  const getStrokeColor = () => {
    if (score > 800) return '#16a34a';
    if (score >= 600) return '#2563eb';
    return '#f97316';
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#1B4332]" />
          <h3 className="text-lg font-bold text-gray-900 font-devanagari">
            {language === 'hi' ? 'ट्रस्टस्कोर' : 'TrustScore'}
          </h3>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          title={language === 'hi' ? 'यह कैसे गणना होती है?' : 'How is this calculated?'}
        >
          <Info className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Circular Gauge */}
      <div className="flex justify-center mb-4">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <motion.circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={getStrokeColor()}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-gray-900">{score}</span>
            <span className="text-xs text-gray-400">/ 1000</span>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex justify-center mb-3">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
          {statusLabel}
        </span>
      </div>

      {/* Info expand - How it's calculated */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1.5 border border-gray-100">
              <p className="font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'स्कोर गणना:' : 'Score calculation:'}
              </p>
              <div className="flex justify-between">
                <span>{language === 'hi' ? 'आधार स्कोर' : 'Base score'}</span>
                <span className="font-medium">+500</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'hi' ? 'प्रोफाइल नाम' : 'Profile name'}</span>
                <span className="font-medium">+{userData?.name ? '100' : '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'hi' ? 'खेत क्षेत्र' : 'Farm area'}</span>
                <span className="font-medium">+{(userData as any)?.totalArea ? '150' : '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'hi' ? 'बिक्री इतिहास' : 'Sales history'}</span>
                <span className="font-medium">+{(userData as any)?.recentSales ? '100' : '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'hi' ? 'फोन सत्यापित' : 'Phone verified'}</span>
                <span className="font-medium">+{userData?.phone ? '50' : '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'hi' ? 'आधार सत्यापित' : 'Aadhaar verified'}</span>
                <span className="font-medium">+{userData?.aadhaarLast4 ? '100' : '0'}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showInfo && (
        <button
          onClick={() => setShowInfo(true)}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1"
        >
          <ChevronDown className="w-3 h-3" />
          {language === 'hi' ? 'विवरण देखें' : 'See breakdown'}
        </button>
      )}
    </div>
  );
}