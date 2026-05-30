import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Package, Calendar, IndianRupee, MapPin, ArrowRight, Loader2, ShieldCheck, Lock, RefreshCw, TrendingUp, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { db, isMockConfig } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import CreditApplyModal from '../components/CreditApplyModal';
import { getCurrentMandiPrices, createPriceTrigger, fetchTriggerForReceipt, getCropPrice, fetchUserActiveTriggers } from '../services/PriceTriggerService';
import { PriceTrigger } from '../types';

interface DigitalReceipt {
  id: string;
  farmerId: string;
  farmerName: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  crop: string;
  quantity: number;
  unit: string;
  storageDuration: number;
  totalCost: number;
  pricePerTonPerMonth: number;
  marketValueAtDeposit?: number;
  status: 'deposited' | 'withdrawn';
  pledgeStatus: 'unpledged' | 'pledged_to_bank' | 'pledged_to_contract';
  createdAt: any;
  depositedAt?: any;
  activeTrigger?: PriceTrigger | null;
}

export default function DigitalVault() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [receipts, setReceipts] = useState<DigitalReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<DigitalReceipt | null>(null);
  const [triggerForm, setTriggerForm] = useState({ targetPrice: '', quantity: '' });
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number>(0);
  const [mandiPrices, setMandiPrices] = useState<Record<string, number>>({});
  const [submittingTrigger, setSubmittingTrigger] = useState(false);

  useEffect(() => {
    if (user) {
      fetchReceipts();
    }
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReceipts();
    setRefreshing(false);
  };

  const fetchReceipts = async () => {
    if (!user) return;
    setLoading(true);

    if (isMockConfig) {
      // Mock data for demo
      setReceipts([
        {
          id: 'dwr-1',
          farmerId: user.uid,
          farmerName: 'Ramesh Kumar',
          warehouseId: 'wh-1',
          warehouseName: 'Kisan Storage Hub',
          warehouseLocation: 'Azamgarh, Uttar Pradesh',
          crop: 'Wheat',
          quantity: 5,
          unit: 'tons',
          storageDuration: 3,
          totalCost: 6000,
          pricePerTonPerMonth: 400,
          marketValueAtDeposit: 75000,
          status: 'deposited',
          pledgeStatus: 'unpledged',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'dwr-2',
          farmerId: user.uid,
          farmerName: 'Ramesh Kumar',
          warehouseId: 'wh-2',
          warehouseName: 'AgriCold Solutions',
          warehouseLocation: 'Varanasi, Uttar Pradesh',
          crop: 'Potato',
          quantity: 10,
          unit: 'tons',
          storageDuration: 6,
          totalCost: 18000,
          pricePerTonPerMonth: 300,
          marketValueAtDeposit: 150000,
          status: 'deposited',
          pledgeStatus: 'pledged_to_bank',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      // Parallelize fetching Mandi prices, Digital Receipts, and User Triggers
      const [prices, receiptsSnapshot, userTriggers] = await Promise.all([
        getCurrentMandiPrices(),
        getDocs(query(
          collection(db, 'digital_receipts'),
          where('farmerId', '==', user.uid)
        )),
        fetchUserActiveTriggers(user.uid)
      ]);

      setMandiPrices(prices);

      // Map triggers for O(1) lookup
      const triggerMap = new Map(userTriggers.map(t => [t.receiptId, t]));

      const data = receiptsSnapshot.docs
        .map(doc => {
          const r = doc.data();
          return {
            id: doc.id,
            ...r,
            quantity: r.quantity || 0,
            activeTrigger: triggerMap.get(doc.id) || null
          } as DigitalReceipt;
        })
        .filter(r => r.status === 'deposited')
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });

      console.log('Fetched receipts optimized:', data);
      setReceipts(data);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const openTriggerModal = async (receipt: DigitalReceipt) => {
    setSelectedReceipt(receipt);
    const price = mandiPrices[receipt.crop.toLowerCase()] || getCropPrice(receipt.crop, mandiPrices);
    setCurrentMarketPrice(price);
    setTriggerForm({ targetPrice: '', quantity: '' });
    setShowTriggerModal(true);
  };

  const handleCreateTrigger = async () => {
    if (!selectedReceipt || !user || !triggerForm.targetPrice || !triggerForm.quantity) return;

    setSubmittingTrigger(true);
    try {
      const price = mandiPrices[selectedReceipt.crop.toLowerCase()] || getCropPrice(selectedReceipt.crop, mandiPrices);
      await createPriceTrigger({
        receiptId: selectedReceipt.id,
        farmerId: user.uid,
        crop: selectedReceipt.crop,
        warehouseId: selectedReceipt.warehouseId,
        warehouseName: selectedReceipt.warehouseName,
        targetPrice: Number(triggerForm.targetPrice),
        currentMarketPrice: price,
        quantity: Number(triggerForm.quantity),
      });

      setShowTriggerModal(false);
      // Refresh receipts to show the new trigger
      await fetchReceipts();
    } catch (error) {
      console.error('Error creating trigger:', error);
    } finally {
      setSubmittingTrigger(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const totalValue = receipts.reduce((sum, r) => sum + (r.marketValueAtDeposit || r.totalCost), 0);
  const availableForLoan = receipts.filter(r => r.pledgeStatus === 'unpledged').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-emerald-600 to-green-700 rounded-2xl p-6 text-white"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {language === 'hi' ? 'डिजिटल वॉल्ट' : 'Digital Vault'}
              </h1>
              <p className="text-white/80 text-sm">
                {language === 'hi' ? 'अपने भंडारित परिसंपत्तियां देखें' : 'View your stored assets'}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors disabled:opacity-50"
            title={language === 'hi' ? 'रिफ्रेश करें' : 'Refresh'}
          >
            <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-white/70 text-xs">{language === 'hi' ? 'कुल रसीदें' : 'Total Receipts'}</p>
            <p className="text-2xl font-bold">{receipts.length}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-white/70 text-xs">{language === 'hi' ? 'कुल मूल्य' : 'Total Value'}</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-white/70 text-xs">{language === 'hi' ? 'उपलब्ध गिरवी' : 'Available for Loan'}</p>
            <p className="text-2xl font-bold">{availableForLoan}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-white/70 text-xs">{language === 'hi' ? 'गिरवी में' : 'Pledged'}</p>
            <p className="text-2xl font-bold">{receipts.length - availableForLoan}</p>
          </div>
        </div>
      </motion.div>

      {/* Receipts List */}
      {receipts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-12 border border-gray-100 text-center"
        >
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-12 h-12 text-emerald-300" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {language === 'hi' ? 'कोई रसीद नहीं मिली' : 'No Receipts Found'}
          </h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            {language === 'hi'
              ? 'आपने अभी तक कोई गोदाम रसीद नहीं बनवाई है। अपनी उपज भंडारित करें और डिजिटल रसीद प्राप्त करें।'
              : "You haven't generated any warehouse receipts yet. Store your produce to get digital receipts."}
          </p>
          <Link
            to="/storage-hub"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
          >
            {language === 'hi' ? 'भंडारण खोजें' : 'Find Storage'}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {receipts.map((receipt, index) => (
              <motion.div
                key={receipt.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border-2 border-emerald-100 overflow-hidden hover:border-emerald-300 transition-all shadow-lg"
              >
                {/* Header with Pledge Status */}
                <div className={`px-5 py-4 flex items-center justify-between ${
                  receipt.pledgeStatus === 'unpledged'
                    ? 'bg-gradient-to-r from-emerald-500 to-green-600'
                    : 'bg-gradient-to-r from-amber-500 to-orange-600'
                }`}>
                  <div className="flex items-center gap-2">
                    {receipt.pledgeStatus === 'unpledged' ? (
                      <ShieldCheck className="w-5 h-5 text-white" />
                    ) : (
                      <Lock className="w-5 h-5 text-white" />
                    )}
                    <span className="text-white font-bold text-sm">
                      {receipt.pledgeStatus === 'unpledged'
                        ? (language === 'hi' ? 'गिरवी के लिए उपलब्ध' : 'Available for Loan')
                        : (language === 'hi' ? 'बैंक में गिरवी' : 'Pledged to Bank')}
                    </span>
                  </div>
                  <div className="text-white/80 text-xs">
                    {receipt.storageDuration} {language === 'hi' ? 'माह' : 'months'}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4">
                  {/* Warehouse & Crop */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        {language === 'hi' ? 'गोदाम' : 'Warehouse'}
                      </p>
                      <p className="font-bold text-gray-900 text-lg">{receipt.warehouseName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        {language === 'hi' ? 'फसल' : 'Crop'}
                      </p>
                      <p className="font-semibold text-emerald-700 text-lg capitalize">{receipt.crop}</p>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3">
                    <Package className="w-8 h-8 text-emerald-600" />
                    <div>
                      <p className="text-sm text-emerald-600">{language === 'hi' ? 'मात्रा' : 'Quantity'}</p>
                      <p className="text-xl font-bold text-emerald-800">
                        {receipt.quantity} {receipt.unit}
                      </p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-xs">{language === 'hi' ? 'जमा तिथि' : 'Deposited'}</span>
                      </div>
                      <p className="font-semibold text-gray-900 text-sm">{formatDate(receipt.createdAt)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="text-xs">{language === 'hi' ? 'स्थान' : 'Location'}</span>
                      </div>
                      <p className="font-semibold text-gray-900 text-xs truncate">{receipt.warehouseLocation?.split(',')[0] || '-'}</p>
                    </div>
                  </div>

                  {/* Market Value */}
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <IndianRupee className="w-4 h-4" />
                        <span className="text-sm">{language === 'hi' ? 'वर्तमान मूल्य' : 'Current Value'}</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700">
                        {formatCurrency(receipt.marketValueAtDeposit || receipt.totalCost)}
                      </p>
                    </div>
                  </div>

                  {/* Active Trigger Badge */}
                  {receipt.activeTrigger && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800">
                        ⚡ {language === 'hi' ? 'ऑटो-सेल सक्रिय' : 'Auto-Sell Active'}: {receipt.activeTrigger.quantity}t @ ₹{receipt.activeTrigger.targetPrice}/q
                      </span>
                    </div>
                  )}

                  {/* Auto-Sell Trigger Button */}
                  {!receipt.activeTrigger && (
                    <button
                      onClick={() => openTriggerModal(receipt)}
                      className="w-full py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors border border-amber-200"
                    >
                      <TrendingUp className="w-4 h-4" />
                      {language === 'hi' ? 'ऑटो-सेल ट्रिगर सेट करें' : 'Set Auto-Sell Trigger'}
                    </button>
                  )}

                  {/* Action Button */}
                  {receipt.pledgeStatus === 'unpledged' && (
                    <button
                      onClick={() => setShowCreditModal(true)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      <IndianRupee className="w-4 h-4" />
                      {language === 'hi' ? 'गिरवी लोन लें' : 'Apply for Loan'}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Credit Apply Modal */}
      <CreditApplyModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
      />

      {/* Auto-Sell Trigger Modal */}
      <AnimatePresence>
        {showTriggerModal && selectedReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => setShowTriggerModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {language === 'hi' ? 'ऑटो-सेल ट्रिगर' : 'Auto-Sell Trigger'}
                      </h2>
                      <p className="text-white/80 text-sm">
                        {selectedReceipt.crop} @ {selectedReceipt.quantity} {selectedReceipt.unit}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTriggerModal(false)}
                    className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="p-6 space-y-4">
                {/* Current Market Price */}
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 font-medium">{language === 'hi' ? 'वर्तमान बाज़ार भाव' : 'Current Market Price'}</span>
                    <span className="text-2xl font-bold text-emerald-800">₹{currentMarketPrice}/q</span>
                  </div>
                </div>

                {/* Target Price Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {language === 'hi' ? 'लक्ष्य भाव (₹/क्विंटल)' : 'Target Price (₹/Quintal)'}
                  </label>
                  <input
                    type="number"
                    value={triggerForm.targetPrice}
                    onChange={(e) => setTriggerForm(prev => ({ ...prev, targetPrice: e.target.value }))}
                    placeholder={language === 'hi' ? 'जैसे: 2500' : 'e.g., 2500'}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-amber-500 focus:outline-none text-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {language === 'hi'
                      ? 'जब बाज़ार भाव इस से ऊपर पहुंचे, तो ऑटोमैटिक बिक्री होगी'
                      : 'When market price reaches this, your crop will be auto-listed'}
                  </p>
                </div>

                {/* Quantity Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {language === 'hi' ? 'बेचने की मात्रा (टन)' : 'Quantity to Auto-Sell (Tons)'}
                  </label>
                  <input
                    type="number"
                    value={triggerForm.quantity}
                    onChange={(e) => setTriggerForm(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder={`Max: ${selectedReceipt.quantity}`}
                    max={selectedReceipt.quantity}
                    min={1}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-amber-500 focus:outline-none text-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {language === 'hi'
                      ? `अधिकतम: ${selectedReceipt.quantity} टन`
                      : `Maximum: ${selectedReceipt.quantity} tons`}
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleCreateTrigger}
                  disabled={submittingTrigger || !triggerForm.targetPrice || !triggerForm.quantity}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {submittingTrigger ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <TrendingUp className="w-5 h-5" />
                      {language === 'hi' ? 'ट्रिगर सेट करें' : 'Set Trigger'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}