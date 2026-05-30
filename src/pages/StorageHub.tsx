import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Warehouse, MapPin, Scale, IndianRupee, ThermometerSun, Thermometer, ArrowRight, Loader2, Package, Calendar, Clock, Info } from 'lucide-react';
import { db, isMockConfig } from '../lib/firebase';
import { collection, query, getDocs, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

interface Warehouse {
  id: string;
  name: string;
  location: string;
  district: string;
  state: string;
  storageType: 'cold' | 'dry';
  totalCapacity: number;
  availableCapacity: number;
  pricePerTonPerMonth: number;
  facilities: string[];
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouse: Warehouse | null;
  onSuccess: (receiptId: string) => void;
}

function BookingModal({ isOpen, onClose, warehouse, onSuccess }: BookingModalProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [cropType, setCropType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [duration, setDuration] = useState('3');

  const cropOptions = [
    { value: 'wheat', label: 'Wheat / गेहूं', labelHi: 'गेहूं' },
    { value: 'paddy', label: 'Paddy / धान', labelHi: 'धान' },
    { value: 'maize', label: 'Maize / मक्का', labelHi: 'मक्का' },
    { value: 'mustard', label: 'Mustard / सरसों', labelHi: 'सरसों' },
    { value: 'potato', label: 'Potato / आलू', labelHi: 'आलू' },
    { value: 'onion', label: 'Onion / प्याज', labelHi: 'प्याज' },
    { value: 'tomato', label: 'Tomato / टमाटर', labelHi: 'टमाटर' },
    { value: 'other', label: 'Other / अन्य', labelHi: 'अन्य' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !warehouse || !cropType || !quantity) {
      toast.error(language === 'hi' ? 'कृपया सभी जानकारी भरें' : 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const qty = parseFloat(quantity);
      if (qty > warehouse.availableCapacity) {
        toast.error(language === 'hi' ? 'क्षमता से अधिक मात्रा' : 'Quantity exceeds available capacity');
        setLoading(false);
        return;
      }

      const totalCost = qty * warehouse.pricePerTonPerMonth * parseInt(duration);

      // Create storage request (NOT a DWR yet - DWR is created by warehouse owner)
      const requestData = {
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        farmerId: user.uid,
        farmerName: userData?.name || 'Farmer',
        farmerPhone: userData?.phone || '',
        crop: cropType,
        quantity: qty,
        unit: 'tons',
        duration: parseInt(duration),
        totalCost,
        status: 'pending', // Warehouse owner must confirm
        createdAt: serverTimestamp(),
      };

      let requestId;

      if (isMockConfig) {
        requestId = 'mock-req-' + Date.now();
        toast.success(language === 'hi' ? 'बुकिंग अनुरोध भेजा गया! गोदाम मालिक से पुष्टि की प्रतीक्षा।' : 'Booking request sent! Waiting for warehouse owner confirmation.');
        onSuccess(requestId);
      } else {
        const docRef = await addDoc(collection(db, 'storage_requests'), requestData);
        requestId = docRef.id;
        toast.success(language === 'hi' ? 'बुकिंग अनुरोध भेजा गया! गोदाम मालिक से पुष्टि की प्रतीक्षा।' : 'Booking request sent! Waiting for warehouse owner confirmation.');
        onSuccess(requestId);
      }
    } catch (error) {
      console.error('Error booking storage:', error);
      toast.error(language === 'hi' ? 'त्रुटि हुई' : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const { userData } = useAuth();

  const estimatedCost = warehouse && quantity
    ? parseFloat(quantity || '0') * warehouse.pricePerTonPerMonth * parseInt(duration)
    : 0;

  return (
    <AnimatePresence>
      {isOpen && warehouse && (
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100"
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                  <Warehouse className="w-6 h-6 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {language === 'hi' ? 'जगह बुक करें' : 'Book Storage Space'}
                  </h2>
                  <p className="text-sm text-gray-500">{warehouse.name}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {language === 'hi' ? 'फसल का प्रकार' : 'Crop Type'}
                </label>
                <select
                  value={cropType}
                  onChange={(e) => setCropType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-sky-500 focus:outline-none"
                  required
                >
                  <option value="">{language === 'hi' ? 'फसल चुनें' : 'Select crop'}</option>
                  {cropOptions.map(crop => (
                    <option key={crop.value} value={crop.value}>
                      {language === 'hi' ? crop.labelHi : crop.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {language === 'hi' ? 'मात्रा (टन)' : 'Quantity (Tons)'}
                </label>
                <div className="relative">
                  <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max={warehouse.availableCapacity}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={`Max ${Number(warehouse.availableCapacity).toFixed(1)} tons`}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-100 focus:border-sky-500 focus:outline-none"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'hi' ? 'अधिकतम उपलब्ध:' : 'Max available:'} {Number(warehouse.availableCapacity).toFixed(1)} tons
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {language === 'hi' ? 'अवधि (महीने)' : 'Duration (Months)'}
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-sky-500 focus:outline-none"
                >
                  <option value="1">1 {language === 'hi' ? 'महीना' : 'Month'}</option>
                  <option value="3">3 {language === 'hi' ? 'महीने' : 'Months'}</option>
                  <option value="6">6 {language === 'hi' ? 'महीने' : 'Months'}</option>
                  <option value="12">12 {language === 'hi' ? 'महीने' : 'Months'}</option>
                </select>
              </div>

              {estimatedCost > 0 && (
                <div className="bg-sky-50 rounded-xl p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {language === 'hi' ? 'अनुमानित लागत:' : 'Estimated Cost:'}
                    </span>
                    <span className="font-bold text-sky-700">₹{estimatedCost.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3.5 rounded-xl font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={loading || !cropType || !quantity}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 px-6 py-3.5 rounded-xl font-bold text-white bg-sky-500 hover:bg-sky-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {language === 'hi' ? 'बुक करें' : 'Book Now'}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function StorageHub() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [generatedReceiptId, setGeneratedReceiptId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeDeposits, setActiveDeposits] = useState<any[]>([]);

  useEffect(() => {
    fetchWarehouses();
    fetchPendingRequests();
    fetchActiveDeposits();
  }, [user]);

  const fetchActiveDeposits = async () => {
    if (!user || isMockConfig) return;
    try {
      const q = query(
        collection(db, 'digital_receipts'),
        where('farmerId', '==', user.uid),
        where('status', '==', 'deposited')
      );
      const snapshot = await getDocs(q);
      const deposits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveDeposits(deposits);
    } catch (error) {
      console.error('Error fetching active deposits:', error);
    }
  };

  const fetchPendingRequests = async () => {
    if (!user || isMockConfig) return;
    try {
      const q = query(
        collection(db, 'storage_requests'),
        where('farmerId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingRequests(requests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  const fetchWarehouses = async () => {
    if (isMockConfig) {
      setWarehouses([
        {
          id: 'wh-1',
          name: 'Kisan Cold Storage',
          location: 'Azamgarh, UP',
          district: 'Azamgarh',
          state: 'Uttar Pradesh',
          storageType: 'cold',
          totalCapacity: 500,
          availableCapacity: 120,
          pricePerTonPerMonth: 800,
          facilities: ['Temperature Control', '24/7 Security', 'Power Backup'],
        },
        {
          id: 'wh-2',
          name: 'UP Farmers Dry Storage',
          location: 'Gorakhpur, UP',
          district: 'Gorakhpur',
          state: 'Uttar Pradesh',
          storageType: 'dry',
          totalCapacity: 1000,
          availableCapacity: 350,
          pricePerTonPerMonth: 400,
          facilities: ['Ventilated', 'Pest Control', 'Easy Access'],
        },
        {
          id: 'wh-3',
          name: 'Green Agri Warehouses',
          location: 'Varanasi, UP',
          district: 'Varanasi',
          state: 'Uttar Pradesh',
          storageType: 'dry',
          totalCapacity: 750,
          availableCapacity: 200,
          pricePerTonPerMonth: 500,
          facilities: ['Modern Silo', 'GPS Tracking', 'Insurance'],
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'warehouses'),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Warehouse[];
      setWarehouses(data);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookSpace = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setShowBookingModal(true);
  };

  const handleBookingSuccess = (receiptId: string) => {
    setGeneratedReceiptId(receiptId);
    setShowBookingModal(false);
    fetchPendingRequests();
  };

  const getStorageTypeLabel = (type: 'cold' | 'dry') => {
    if (type === 'cold') {
      return { label: language === 'hi' ? 'कोल्ड स्टोरेज' : 'Cold Storage', color: 'bg-blue-100 text-blue-700' };
    }
    return { label: language === 'hi' ? 'ड्राई स्टोरेज' : 'Dry Storage', color: 'bg-amber-100 text-amber-700' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {language === 'hi' ? 'स्टोरेज हब' : 'Storage Hub'}
            </h1>
            <p className="text-white/80 text-sm">
              {language === 'hi'
                ? 'अपनी फसल के लिए सुरक्षित भंडारण खोजें'
                : 'Find secure storage for your produce'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-white/90 text-sm">
          <Package className="w-4 h-4" />
          <span>{warehouses.length} {language === 'hi' ? 'गोदाम उपलब्ध' : 'warehouses available'}</span>
        </div>
      </div>

      {/* Success Message */}
      <AnimatePresence>
        {generatedReceiptId && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-800">
                {language === 'hi' ? 'बुकिंग अनुरोध भेजा गया!' : 'Booking Request Submitted!'}
              </p>
              <p className="text-sm text-amber-700">
                {language === 'hi'
                  ? 'गोदाम मालिक द्वारा पुष्टि की प्रतीक्षा। पुष्टि के बाद आपको DWR मिलेगा।'
                  : 'Waiting for warehouse owner confirmation. You will receive a DWR after approval.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Bookings Section */}
      {pendingRequests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">
            {language === 'hi' ? 'आपकी सक्रिय बुकिंग' : 'Your Active Bookings'}
          </h2>
          <div className="grid gap-4">
            {pendingRequests.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                      <Warehouse className="w-5 h-5 text-amber-600" />
                    </div>
                    <h3 className="font-bold text-gray-900">{request.warehouseName}</h3>
                  </div>
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
                    {language === 'hi' ? 'पुष्टि की प्रतीक्षा' : 'Pending Approval'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{language === 'hi' ? 'फसल' : 'Crop'}</p>
                    <p className="font-semibold text-slate-800 capitalize">{request.crop}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{language === 'hi' ? 'मात्रा' : 'Quantity'}</p>
                    <p className="font-semibold text-slate-800">{request.quantity} tons</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{language === 'hi' ? 'कुल लागत' : 'Total Cost'}</p>
                    <p className="font-semibold text-sky-600">₹{request.totalCost?.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl mt-4">
                  <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {language === 'hi' 
                      ? 'गोदाम मालिक आपके अनुरोध की समीक्षा कर रहा है। स्वीकृत होने के बाद, आपका डिजिटल वेयरहाउस रसीद (DWR) जनरेट किया जाएगा और आपके डिजिटल वॉल्ट में उपलब्ध होगा।' 
                      : 'The warehouse owner is reviewing your request. Once approved, your Digital Warehouse Receipt (DWR) will be generated and available in your Digital Vault.'}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Stored Goods Section (Active Deposits) */}
      {activeDeposits.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 mt-8">
            {language === 'hi' ? 'आपका जमा माल' : 'Your Stored Goods'}
          </h2>
          <div className="space-y-3">
            {activeDeposits.map((receipt) => {
              const startDate = receipt.createdAt?.toDate ? receipt.createdAt.toDate() : new Date();
              const endDate = new Date(startDate);
              endDate.setMonth(endDate.getMonth() + (receipt.storageDuration || 0));

              return (
                <motion.div
                  key={receipt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-4 bg-white rounded-xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow mb-3"
                >
                  {/* Column 1: Facility Info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Warehouse className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm leading-tight">
                        {receipt.warehouseName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {receipt.warehouseLocation || 'Location N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Column 2: Asset Volume */}
                  <div>
                    <p className="font-bold text-slate-800">{receipt.quantity} {receipt.unit || 'Tons'}</p>
                    <p className="text-xs text-slate-500 uppercase font-medium tracking-wider">
                      {receipt.crop}
                    </p>
                  </div>

                  {/* Column 3: Timeline */}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <Calendar className="w-3 h-3" />
                      <span>{language === 'hi' ? 'भंडारण समय' : 'Storage Timeline'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span>{startDate.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span>{endDate.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Column 4: Financials */}
                  <div className="flex justify-end md:justify-start">
                    <div className="bg-slate-50 text-slate-700 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 w-fit text-sm">
                      {language === 'hi' ? 'लागत' : 'Cost'}: ₹{receipt.totalCost?.toLocaleString()}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {warehouses.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-white rounded-2xl border border-gray-100"
        >
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Warehouse className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {language === 'hi' ? 'कोई गोदाम उपलब्ध नहीं' : 'No warehouses available'}
          </h3>
          <p className="text-gray-500">
            {language === 'hi' ? 'जल्दी फिर से जांचें' : 'Check back soon for new storage options'}
          </p>
        </motion.div>
      )}

      {/* Warehouse Cards */}
      <div className="grid gap-4">
        {warehouses.map((warehouse, index) => {
          const storageType = getStorageTypeLabel(warehouse.storageType);
          return (
            <motion.div
              key={warehouse.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Warehouse Info */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                      <Warehouse className="w-6 h-6 text-sky-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{warehouse.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin className="w-4 h-4" />
                        <span>{warehouse.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Storage Type & Capacity */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${storageType.color}`}>
                      {storageType.label}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                      {language === 'hi' ? 'क्षमता:' : 'Capacity:'} {Number(warehouse.availableCapacity).toFixed(1)}/{warehouse.totalCapacity} tons
                    </span>
                  </div>

                  {/* Facilities */}
                  <div className="flex flex-wrap gap-1">
                    {warehouse.facilities?.slice(0, 3).map((facility, i) => (
                      <span key={i} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                        {facility}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Price & Book Button */}
                <div className="text-right">
                  <div className="text-sm text-gray-500 mb-1">
                    {language === 'hi' ? 'प्रति टन/माह' : 'Per Ton/Month'}
                  </div>
                  <div className="text-2xl font-bold text-sky-600 mb-3">
                    ₹{warehouse.pricePerTonPerMonth}
                  </div>
                  <motion.button
                    whileHover={!pendingRequests.some(r => r.warehouseId === warehouse.id) ? { scale: 1.02 } : {}}
                    whileTap={!pendingRequests.some(r => r.warehouseId === warehouse.id) ? { scale: 0.98 } : {}}
                    onClick={() => handleBookSpace(warehouse)}
                    disabled={warehouse.availableCapacity === 0 || pendingRequests.some(r => r.warehouseId === warehouse.id)}
                    className={`px-6 py-2.5 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      pendingRequests.some(r => r.warehouseId === warehouse.id)
                        ? "bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200"
                        : "bg-sky-500 text-white hover:bg-sky-600 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    }`}
                  >
                    {pendingRequests.some(r => r.warehouseId === warehouse.id) ? (
                      <>
                        <Clock className="w-4 h-4" />
                        {language === 'hi' ? 'पुष्टि की प्रतीक्षा' : 'Waiting for Approval'}
                      </>
                    ) : (
                      <>
                        {language === 'hi' ? 'जगह बुक करें' : 'Book Space'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          setSelectedWarehouse(null);
        }}
        warehouse={selectedWarehouse}
        onSuccess={handleBookingSuccess}
      />
    </div>
  );
}