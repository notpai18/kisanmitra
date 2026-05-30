import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, MapPin, Package, DollarSign, ArrowRight, CheckCircle2, Loader2, Navigation } from 'lucide-react';
import { db, isMockConfig } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

interface Load {
  id: string;
  crop: string;
  quantity: number;
  unit: string;
  pickupLocation: string;
  dropoffLocation: string;
  sellerName: string;
  transportFee: number;
  platformTransportCommission: number;
  transporterPayout: number;
  status: string;
}

export default function LoadBoard() {
  const { user, userData } = useAuth();
  const { language } = useLanguage();
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableLoads();
  }, []);

  const fetchAvailableLoads = async () => {
    if (isMockConfig) {
      setLoads([
        {
          id: 'mock-1',
          crop: 'Wheat',
          quantity: 5,
          unit: 'tons',
          pickupLocation: 'Azamgarh, UP',
          dropoffLocation: 'Kanpur, UP',
          sellerName: 'Ramesh Kumar',
          transportFee: 4500,
          platformTransportCommission: 225,
          transporterPayout: 4275,
          status: 'awaiting_logistics',
        },
        {
          id: 'mock-2',
          crop: 'Paddy',
          quantity: 8,
          unit: 'tons',
          pickupLocation: 'Gorakhpur, UP',
          dropoffLocation: 'Lucknow, UP',
          sellerName: 'Suresh Yadav',
          transportFee: 6000,
          platformTransportCommission: 300,
          transporterPayout: 5700,
          status: 'awaiting_logistics',
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'listings'),
        where('status', '==', 'awaiting_logistics'),
        where('requiresPlatformTransport', '==', true)
      );
      const snapshot = await getDocs(q);
      const loadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Load[];
      setLoads(loadsData);
    } catch (error) {
      console.error('Error fetching loads:', error);
      toast.error(language === 'hi' ? 'लोड लोड करने में त्रुटि' : 'Error loading loads');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptLoad = async (load: Load) => {
    if (!user || isMockConfig) {
      toast.success(language === 'hi' ? 'लोड स्वीकार किया!' : 'Load accepted!');
      setLoads(prev => prev.filter(l => l.id !== load.id));
      return;
    }

    setAcceptingId(load.id);
    try {
      await updateDoc(doc(db, 'listings', load.id), {
        status: 'in_transit',
        transporterId: user.uid,
        acceptedAt: serverTimestamp(),
        dispatchedAt: serverTimestamp(),
      });
      toast.success(language === 'hi' ? 'लोड स्वीकार किया!' : 'Load accepted!');
      setLoads(prev => prev.filter(l => l.id !== load.id));
    } catch (error) {
      console.error('Error accepting load:', error);
      toast.error(language === 'hi' ? 'त्रुटि हुई' : 'Something went wrong');
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {language === 'hi' ? 'लोड बोर्ड' : 'Load Board'}
            </h1>
            <p className="text-white/80 text-sm">
              {language === 'hi'
                ? 'उपलब्ध लोड खोजें और स्वीकार करें'
                : 'Find and accept available loads'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-white/90 text-sm">
          <Package className="w-4 h-4" />
          <span>{loads.length} {language === 'hi' ? 'लोड उपलब्ध' : 'loads available'}</span>
        </div>
      </div>

      {/* Empty State */}
      {loads.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-white rounded-2xl border border-gray-100"
        >
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {language === 'hi' ? 'कोई लोड उपलब्ध नहीं' : 'No loads available'}
          </h3>
          <p className="text-gray-500">
            {language === 'hi'
              ? 'जल्दी फिर से जांचें'
              : 'Check back soon for new loads'}
          </p>
        </motion.div>
      )}

      {/* Load Cards */}
      <div className="grid gap-4">
        <AnimatePresence>
          {loads.map((load, index) => (
            <motion.div
              key={load.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Load Details */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <Package className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{load.crop}</h3>
                      <p className="text-sm text-gray-500">
                        {load.quantity} {load.unit} • {load.sellerName}
                      </p>
                    </div>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <MapPin className="w-4 h-4 text-green-500" />
                        <span>{load.pickupLocation}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600 mt-1">
                        <Navigation className="w-4 h-4 text-red-500" />
                        <span>{load.dropoffLocation}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payout */}
                <div className="text-right">
                  <div className="text-sm text-gray-500 mb-1">
                    {language === 'hi' ? 'पेआउट' : 'Payout'}
                  </div>
                  <div className="text-2xl font-bold text-amber-600">
                    ₹{load.transporterPayout.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    {language === 'hi' ? 'ट्रांसपोर्ट फीस:' : 'Total:'} ₹{load.transportFee.toLocaleString()}
                  </div>
                </div>

                {/* Accept Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAcceptLoad(load)}
                  disabled={acceptingId === load.id}
                  className="md:w-40 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {acceptingId === load.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {language === 'hi' ? 'लोड लें' : 'Accept Load'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}