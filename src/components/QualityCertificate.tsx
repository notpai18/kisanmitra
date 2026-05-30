import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Shield, CheckCircle, ScanLine } from 'lucide-react';
import { motion } from 'framer-motion';

interface QualityCertificateProps {
  grade: 'A' | 'B' | 'C';
  defectPercentage: number;
  averageSize: string;
  averageWeight: string;
  crop: string;
  inspectionDate: string;
}

const gradeConfig = {
  A: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Premium' },
  B: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Standard' },
  C: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Basic' },
};

export default function QualityCertificate({
  grade,
  defectPercentage,
  averageSize,
  averageWeight,
  crop,
  inspectionDate,
}: QualityCertificateProps) {
  const { language } = useLanguage();
  const config = gradeConfig[grade];

  const qrCodeData = `KM-QC-${crop.toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}-${grade}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200 relative overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(248,250,252,0.8) 0%, transparent 50%)',
      }}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1B4332] via-[#6366F1] to-[#8B5CF6]" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#1B4332]" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {language === 'hi' ? 'गुणवत्ता प्रमाण पत्र' : 'Quality Certificate'}
          </span>
        </div>
        <span className="text-xs text-gray-400 font-mono">KM-QC-2026</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-gray-500 mb-1">
              {language === 'hi' ? 'AI ग्रेड' : 'AI Grade'}
            </p>
            <div className={clsx(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-lg',
              config.bg, config.color, config.border
            )}>
              <span>Grade {grade}</span>
              <span className="text-sm opacity-80">({config.label})</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 mb-1">
              {language === 'hi' ? 'फसल' : 'Crop'}
            </p>
            <p className="font-bold text-[#111827] text-lg">{crop}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">
              {language === 'hi' ? 'दोष %' : 'Defect %'}
            </p>
            <p className="font-bold text-[#111827]">
              {defectPercentage < 1 ? '<1%' : `${defectPercentage}%`}
            </p>
          </div>
          <div className="text-center border-l border-r border-slate-100">
            <p className="text-xs text-gray-500 mb-1">
              {language === 'hi' ? 'औसत आकार' : 'Avg Size'}
            </p>
            <p className="font-bold text-[#111827]">{averageSize}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">
              {language === 'hi' ? 'औसत वजन' : 'Avg Weight'}
            </p>
            <p className="font-bold text-[#111827]">{averageWeight}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-16 h-16 bg-white border border-slate-200 rounded-lg flex items-center justify-center p-1">
            <div className="w-full h-full bg-[#1B4332]/5 rounded flex items-center justify-center relative overflow-hidden">
              <ScanLine className="w-10 h-10 text-[#1B4332]/30" />
              <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-0.5 opacity-30">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className={`${
                      [0, 3, 5, 6, 9, 10, 12, 15].includes(i)
                        ? 'bg-[#1B4332]'
                        : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {language === 'hi' ? 'सत्यापन कोड' : 'Verify Code'}
            </p>
            <p className="text-xs font-mono text-gray-400 truncate max-w-[120px]">
              {qrCodeData.slice(0, 12)}...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="font-medium">
            {language === 'hi' ? 'KisanMitra AI द्वारा सत्यापित' : 'Verified by KisanMitra AI'}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-center text-gray-400 mt-4 font-devanagari">
        {language === 'hi'
          ? `जांच तिथि: ${inspectionDate} | ऑप्टिकल स्कैनिंग द्वारा विश्लेषण`
          : `Inspected: ${inspectionDate} | Analysis via Optical Scanning`
        }
      </p>
    </motion.div>
  );
}

function clsx(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}