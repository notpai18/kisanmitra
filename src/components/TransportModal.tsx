import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, Store, Shield, Phone, ChevronRight, CheckCircle2, Zap } from 'lucide-react';
import { db, isMockConfig } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

const TRANSPORT_COMMISSION_RATE = 0.05; // 5% platform transport commission
const BASE_TRANSPORT_FEE = 2000; // Base fee in INR
const PER_KM_RATE = 50; // Per km rate

interface TransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: any;
  onSuccess: () => void;
}

export default function TransportModal({ isOpen, onClose, listing, onSuccess }: TransportModalProps) {
  const { user, userData } = useAuth();
  const { language } = useLanguage();
  const [transportType, setTransportType] = useState<'buyer_pickup' | 'agent_transport' | 'platform_transport'>('buyer_pickup');
  const [submitting, setSubmitting] = useState(false);

  // Calculate transport fee based on quantity (simulated distance-based pricing)
  const calculateTransportFee = () => {
    const quantity = Number(listing?.quantity) || 1;
    // Simulated: base fee + per-quintal charge (assuming 1 ton = 10 quintals)
    const quantityMultiplier = Math.ceil(quantity * 10); // each 100kg adds to distance estimate
    return BASE_TRANSPORT_FEE + (quantityMultiplier * 100);
  };

  const transportFee = calculateTransportFee();
  const platformCommission = transportFee * TRANSPORT_COMMISSION_RATE;
  const transporterPayout = transportFee - platformCommission;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isMockConfig) {
      // Mock mode handling
      onSuccess();
      return;
    }
    setSubmitting(true);
    try {
      const updateData: any = {
        status: 'awaiting_logistics',
        transportType,
        escrowAmount: listing.highestBid,
        escrowSecuredAt: serverTimestamp(),
      };

      // If platform transport is selected, add transport fee details
      if (transportType === 'platform_transport') {
        updateData.requiresPlatformTransport = true;
        updateData.transportFee = transportFee;
        updateData.platformTransportCommission = platformCommission;
        updateData.transporterPayout = transporterPayout;
      }

      await updateDoc(doc(db, 'listings', listing.id), updateData);
      toast.success(language === 'hi' ? 'फंड सिक्योर हुआ! लॉजिस्टिक्स का इंतज़ार करें।' : 'Funds secured! Awaiting logistics.');
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error(language === 'hi' ? 'त्रुटि हुई' : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100"
          >
            <div className="p-6 border-b border-gray-100 rounded-t-2xl">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {language === 'hi' ? 'फंड सिक्योर करें' : 'Secure Funds & Choose Shipping'}
                  </h2>
                  <p className="text-sm text-gray-500 font-devanagari">
                    {listing.crop} - ₹{listing.highestBid}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {language === 'hi'
                  ? 'अपना ट्रांसपोर्ट विकल्प चुनें। फंड एस्क्रो में सुरक्षित रहेंगे।'
                  : 'Select your transport option. Funds will be held securely in escrow.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-700">
                  {language === 'hi' ? 'ट्रांसपोर्ट का तरीका चुनें:' : 'Choose Transport Method:'}
                </label>

                <motion.label
                  whileHover={{ scale: 1.01 }}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    transportType === 'buyer_pickup'
                      ? 'border-[#1B4332] bg-[#D1FAE5]/50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="transportType"
                    value="buyer_pickup"
                    checked={transportType === 'buyer_pickup'}
                    onChange={() => setTransportType('buyer_pickup')}
                    className="hidden"
                  />
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                    transportType === 'buyer_pickup' ? 'bg-[#1B4332] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Truck className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-gray-900 block">
                      {language === 'hi' ? 'मैं अपना ट्रक भेजूंगा' : 'I will arrange my own truck'}
                    </span>
                    <span className="text-xs text-gray-500 font-devanagari">
                      {language === 'hi' ? 'स्वयं ले जाऊंगा' : 'Self-Pickup'}
                    </span>
                  </div>
                  {transportType === 'buyer_pickup' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-6 h-6 bg-[#1B4332] rounded-full flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </motion.label>

                <motion.label
                  whileHover={{ scale: 1.01 }}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    transportType === 'agent_transport'
                      ? 'border-[#1B4332] bg-[#D1FAE5]/50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="transportType"
                    value="agent_transport"
                    checked={transportType === 'agent_transport'}
                    onChange={() => setTransportType('agent_transport')}
                    className="hidden"
                  />
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                    transportType === 'agent_transport' ? 'bg-[#1B4332] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Store className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-gray-900 block">
                      {language === 'hi' ? 'एजेंट से ट्रांसपोर्ट लें' : 'Request Local Agent Transport'}
                    </span>
                    <span className="text-xs text-gray-500 font-devanagari">
                      {language === 'hi' ? 'स्थानीय एजेंट की मदद से' : 'Agent will arrange transport'}
                    </span>
                  </div>
                  {transportType === 'agent_transport' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-6 h-6 bg-[#1B4332] rounded-full flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </motion.label>

                <motion.label
                  whileHover={{ scale: 1.01 }}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    transportType === 'platform_transport'
                      ? 'border-amber-500 bg-amber-50/50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="transportType"
                    value="platform_transport"
                    checked={transportType === 'platform_transport'}
                    onChange={() => setTransportType('platform_transport')}
                    className="hidden"
                  />
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                    transportType === 'platform_transport' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Zap className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-gray-900 block">
                      {language === 'hi' ? 'किसनमैच ट्रांसपोर्ट (ऑटोमेटेड)' : 'KisanMatch Transport (Automated)'}
                    </span>
                    <span className="text-xs text-gray-500 font-devanagari">
                      {language === 'hi' ? 'ऑनलाइन लोड बोर्ड से ट्रांसपोर्टर मैच करें' : 'Match with transporter via load board'}
                    </span>
                  </div>
                  {transportType === 'platform_transport' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </motion.label>
              </div>

              {/* Transport Fee Display for Platform Transport */}
              <AnimatePresence>
                {transportType === 'platform_transport' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 space-y-2"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {language === 'hi' ? 'ट्रांसपोर्ट फीस:' : 'Transport Fee:'}
                      </span>
                      <span className="font-bold text-gray-900">₹{transportFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {language === 'hi' ? 'प्लेटफॉर्म कमीशन (5%):' : 'Platform Commission (5%):'}
                      </span>
                      <span className="font-bold text-orange-600">-₹{platformCommission.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-amber-200 pt-2 flex justify-between">
                      <span className="font-bold text-gray-700">
                        {language === 'hi' ? 'ट्रांसपोर्टर को भुगतान:' : 'Transporter Payout:'}
                      </span>
                      <span className="font-bold text-amber-600">₹{transporterPayout.toLocaleString()}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-[#FEF3C7] to-[#FDE68A] rounded-xl p-4 flex items-start gap-3"
              >
                <Shield className="w-5 h-5 text-[#92400e] shrink-0 mt-0.5" />
                <div className="text-sm text-[#92400e]">
                  <span className="font-bold block">
                    {language === 'hi' ? 'एस्क्रो सुरक्षा सक्रिय' : 'Escrow Protection Active'}
                  </span>
                  <span className="font-devanagari">
                    {language === 'hi'
                      ? 'डिलीवरी के बाद ही पैसे सैलर को मिलेंगे।'
                      : 'Funds will be released to seller only after delivery confirmation.'}
                  </span>
                </div>
              </motion.div>

              <div className="flex gap-3 pt-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3.5 rounded-xl font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors min-h-[48px]"
                >
                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 px-6 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] transition-all shadow-lg min-h-[48px]"
                >
                  {submitting
                    ? (language === 'hi' ? 'सबमिट हो रहा है...' : 'Processing...')
                    : (language === 'hi' ? 'फंड सिक्योर करें' : 'Secure Funds')}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}