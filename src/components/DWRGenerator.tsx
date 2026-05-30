import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Package, MapPin, Calendar, IndianRupee, QrCode, CheckCircle2, Lock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DWRData {
  id: string;
  farmerName: string;
  warehouseName: string;
  warehouseLocation: string;
  crop: string;
  quantity: number;
  unit: string;
  storageDuration: number;
  totalCost: number;
  status: string;
  pledgeStatus: string;
  createdAt?: any;
}

interface DWRGeneratorProps {
  receipt: DWRData;
  marketValue?: number;
  onCollateralize?: () => void;
}

export default function DWRGenerator({ receipt, marketValue, onCollateralize }: DWRGeneratorProps) {
  const { language } = useLanguage();

  const getStatusBadge = () => {
    if (receipt.pledgeStatus === 'pledged_to_bank') {
      return {
        label: language === 'hi' ? 'बैंक में गिरवी' : 'Pledged to Bank',
        bg: 'bg-red-100',
        text: 'text-red-700',
        icon: Lock,
      };
    }
    if (receipt.pledgeStatus === 'unpledged') {
      return {
        label: language === 'hi' ? 'गिरवी के लिए उपलब्ध' : 'Available for Pledge',
        bg: 'bg-green-100',
        text: 'text-green-700',
        icon: CheckCircle2,
      };
    }
    return {
      label: receipt.status,
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      icon: Package,
    };
  };

  const statusInfo = getStatusBadge();
  const StatusIcon = statusInfo.icon;

  const cropLabel = receipt.crop.charAt(0).toUpperCase() + receipt.crop.slice(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-50 rounded-2xl border-2 border-slate-200 overflow-hidden"
    >
      {/* Header with official branding */}
      <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-green-400" />
          <span className="font-bold text-lg">KisanMitra</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Digital Warehouse Receipt</p>
          <p className="font-mono text-sm">#{receipt.id.slice(0, 12).toUpperCase()}</p>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6 space-y-4">
        {/* Status Badge */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${statusInfo.bg} ${statusInfo.text}`}>
          <StatusIcon className="w-4 h-4" />
          {statusInfo.label}
        </div>

        {/* Asset Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {language === 'hi' ? 'किसान' : 'Farmer'}
              </p>
              <p className="font-bold text-gray-900">{receipt.farmerName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {language === 'hi' ? 'फसल' : 'Crop'}
              </p>
              <p className="font-bold text-gray-900 capitalize">{cropLabel}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {language === 'hi' ? 'मात्रा' : 'Quantity'}
              </p>
              <p className="font-bold text-gray-900">{receipt.quantity} {receipt.unit}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {language === 'hi' ? 'गोदाम' : 'Warehouse'}
              </p>
              <p className="font-bold text-gray-900">{receipt.warehouseName}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {receipt.warehouseLocation}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {language === 'hi' ? 'अवधि' : 'Duration'}
              </p>
              <p className="font-bold text-gray-900">{receipt.storageDuration} {language === 'hi' ? 'महीने' : 'months'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {language === 'hi' ? 'भंडारण शुल्क' : 'Storage Fee'}
              </p>
              <p className="font-bold text-gray-900">₹{receipt.totalCost?.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Market Value */}
        {marketValue && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 uppercase tracking-wide">
                  {language === 'hi' ? 'वर्तमान बाजार मूल्य' : 'Current Market Value'}
                </p>
                <p className="text-2xl font-bold text-green-700">
                  ₹{marketValue.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <IndianRupee className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-green-600 mt-2">
              {language === 'hi'
                ? 'यह मूल्य मंडी भाव के आधार पर अनुमानित है'
                : 'Value estimated based on current mandi prices'}
            </p>
          </div>
        )}

        {/* Collateral Action */}
        {receipt.pledgeStatus === 'unpledged' && onCollateralize && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onCollateralize}
            className="w-full mt-4 py-3 bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"
          >
            <Lock className="w-5 h-5" />
            {language === 'hi' ? 'गिरवी रखें और लोन लें' : 'Use as Collateral for Loan'}
          </motion.button>
        )}

        {/* Footer verification */}
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-200">
          <QrCode className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500">
            {language === 'hi' ? 'KisanMitra द्वारा सत्यापित' : 'Verified by KisanMitra'}
          </span>
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        </div>
      </div>
    </motion.div>
  );
}