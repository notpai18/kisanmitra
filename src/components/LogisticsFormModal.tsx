import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, Phone, Send, X } from 'lucide-react';
import { db, isMockConfig } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

interface LogisticsFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: any;
  transportType: 'buyer_pickup' | 'agent_transport';
  onSuccess: () => void;
}

export default function LogisticsFormModal({
  isOpen,
  onClose,
  listing,
  transportType,
  onSuccess
}: LogisticsFormModalProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isBuyerPickup = transportType === 'buyer_pickup';
  const isForBuyer = isBuyerPickup; // buyer enters details for buyer_pickup

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isMockConfig) {
      // Mock mode
      onSuccess();
      return;
    }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'listings', listing.id), {
        status: 'in_transit',
        transportDetails: {
          vehicleNumber: vehicleNumber.toUpperCase(),
          driverPhone,
          dispatchedAt: serverTimestamp(),
        },
      });
      toast.success(
        language === 'hi'
          ? 'ट्रक रवाना! ट्रांज़िट में है।'
          : 'Truck dispatched! Now in transit.'
      );
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-start rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {language === 'hi' ? 'ट्रक की जानकारी दें' : 'Enter Truck Details'}
                </h2>
                <p className="text-sm text-gray-500 mt-1 font-devanagari">
                  {listing.crop} - {listing.quantity} {listing.unit}
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onClose}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </motion.button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-[#F9FAFB] to-[#F3F4F6] rounded-xl p-5 border border-gray-100"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-[#1B4332] rounded-xl flex items-center justify-center">
                    <Truck className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-gray-900">
                    {isBuyerPickup
                      ? (language === 'hi' ? 'खरीदार का ट्रक' : "Buyer's Truck")
                      : (language === 'hi' ? 'एजेंट का ट्रक' : "Agent's Truck")}
                  </span>
                </div>
                <p className="text-sm text-gray-600 font-devanagari">
                  {isBuyerPickup
                    ? (language === 'hi'
                        ? 'खरीदार द्वारा भेजे गए ट्रक की जानकारी दर्ज करें।'
                        : "Enter details of the truck being sent by the buyer.")
                    : (language === 'hi'
                        ? 'एजेंट द्वारा भेजे गए ट्रक की जानकारी दर्ज करें।'
                        : "Enter details of the truck being sent by the agent.")}
                </p>
              </motion.div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {language === 'hi' ? 'ट्रक का नंबर' : 'Vehicle Number'}
                </label>
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="UP 70 AB 1234"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 font-mono text-lg uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {language === 'hi' ? 'ड्राइवर का फ़ोन नंबर' : 'Driver Phone Number'}
                </label>
                <input
                  type="tel"
                  required
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-lg focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all"
                />
              </div>

              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-xl font-bold text-white bg-[#1B4332] hover:bg-[#153326] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 min-h-[52px]"
              >
                {submitting ? (
                  language === 'hi' ? 'सबमिट हो रहा है...' : 'Processing...'
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    {language === 'hi' ? 'रवाना करें' : 'Dispatch Truck'}
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}