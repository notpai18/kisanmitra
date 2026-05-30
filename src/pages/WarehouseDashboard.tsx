import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Warehouse, Package, DollarSign, TrendingUp, ArrowRight, Loader2, X, MapPin, Thermometer, Scale, IndianRupee, CheckCircle2, Clock, FileText, Trash2, Eye, EyeOff, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { db, isMockConfig } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp, runTransaction, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface WarehouseFacility {
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
  ownerId: string;
  isActive: boolean;
  createdAt: any;
}

interface StorageRequest {
  id: string;
  warehouseId: string;
  warehouseName: string;
  farmerId: string;
  farmerName: string;
  farmerPhone?: string;
  crop: string;
  quantity: number;
  unit: string;
  duration: number;
  totalCost: number;
  status: 'pending' | 'deposited' | 'rejected' | 'withdrawn';
  createdAt: any;
}

function AddWarehouseModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: (warehouse: WarehouseFacility) => void }) {
  const { user, userData } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    district: '',
    state: 'Uttar Pradesh',
    storageType: 'dry' as 'cold' | 'dry',
    totalCapacity: '',
    pricePerTonPerMonth: '',
    facilities: [] as string[],
  });

  const facilityOptions = [
    'Temperature Control', '24/7 Security', 'Power Backup', 'Ventilated',
    'Pest Control', 'Easy Access', 'GPS Tracking', 'Insurance', 'Cold Chain'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name || !formData.totalCapacity || !formData.pricePerTonPerMonth) {
      toast.error(language === 'hi' ? 'कृपया सभी फ़ील्ड भरें' : 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const warehouseData = {
        name: formData.name,
        location: `${formData.district || ''}, ${formData.state}`.trim(),
        district: formData.district,
        state: formData.state,
        storageType: formData.storageType,
        totalCapacity: parseInt(formData.totalCapacity),
        availableCapacity: parseInt(formData.totalCapacity),
        pricePerTonPerMonth: parseInt(formData.pricePerTonPerMonth),
        facilities: formData.facilities,
        ownerId: user.uid,
        isActive: true,
        createdAt: serverTimestamp(),
      };

      if (isMockConfig) {
        const mockWarehouse: WarehouseFacility = {
          id: 'mock-wh-' + Date.now(),
          ...warehouseData,
          location: `${formData.district}, ${formData.state}`,
        };
        toast.success(language === 'hi' ? 'गोदाम पंजीकृत!' : 'Warehouse registered!');
        onSuccess(mockWarehouse);
      } else {
        const docRef = await addDoc(collection(db, 'warehouses'), warehouseData);
        const newWarehouse: WarehouseFacility = {
          id: docRef.id,
          ...warehouseData,
          location: `${formData.district}, ${formData.state}`,
        };
        toast.success(language === 'hi' ? 'गोदाम पंजीकृत!' : 'Warehouse registered!');
        onSuccess(newWarehouse);
      }
      setFormData({ name: '', district: '', state: 'Uttar Pradesh', storageType: 'dry', totalCapacity: '', pricePerTonPerMonth: '', facilities: [] });
    } catch (error) {
      console.error('Error registering warehouse:', error);
      toast.error(language === 'hi' ? 'त्रुटि हुई' : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const toggleFacility = (facility: string) => {
    setFormData(prev => ({
      ...prev,
      facilities: prev.facilities.includes(facility)
        ? prev.facilities.filter(f => f !== facility)
        : [...prev.facilities, facility]
    }));
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {language === 'hi' ? 'नया गोदाम पंजीकृत करें' : 'Register New Warehouse'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {language === 'hi' ? 'गोदाम का नाम' : 'Facility Name'}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={language === 'hi' ? 'जैसे: किसान कोल्ड स्टोरेज' : 'e.g., Kisan Cold Storage'}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-sky-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                {language === 'hi' ? 'जिला' : 'District'}
              </label>
              <input
                type="text"
                value={formData.district}
                onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                placeholder={language === 'hi' ? 'जैसे: अजमेर' : 'e.g., Azamgarh'}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-sky-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                {language === 'hi' ? 'राज्य' : 'State'}
              </label>
              <select
                value={formData.state}
                onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-sky-500 focus:outline-none"
              >
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="Bihar">Bihar</option>
                <option value="Madhya Pradesh">Madhya Pradesh</option>
                <option value="Punjab">Punjab</option>
                <option value="Haryana">Haryana</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {language === 'hi' ? 'स्टोरेज प्रकार' : 'Storage Type'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, storageType: 'dry' }))}
                className={`p-3 rounded-xl border-2 transition-all ${formData.storageType === 'dry' ? 'border-sky-500 bg-sky-50' : 'border-gray-100'}`}
              >
                <Thermometer className="w-5 h-5 mx-auto mb-1 text-amber-600" />
                <span className="text-sm font-medium">{language === 'hi' ? 'ड्राई वेयरहाउस' : 'Dry Warehouse'}</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, storageType: 'cold' }))}
                className={`p-3 rounded-xl border-2 transition-all ${formData.storageType === 'cold' ? 'border-sky-500 bg-sky-50' : 'border-gray-100'}`}
              >
                <Thermometer className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                <span className="text-sm font-medium">{language === 'hi' ? 'कोल्ड स्टोरेज' : 'Cold Storage'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                {language === 'hi' ? 'कुल क्षमता (टन)' : 'Total Capacity (Tons)'}
              </label>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  value={formData.totalCapacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalCapacity: e.target.value }))}
                  placeholder="100"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-100 focus:border-sky-500 focus:outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                {language === 'hi' ? 'दर (₹/टन/माह)' : 'Rate (₹/Ton/Month)'}
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  value={formData.pricePerTonPerMonth}
                  onChange={(e) => setFormData(prev => ({ ...prev, pricePerTonPerMonth: e.target.value }))}
                  placeholder="500"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-100 focus:border-sky-500 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {language === 'hi' ? 'सुविधाएं' : 'Facilities'}
            </label>
            <div className="flex flex-wrap gap-2">
              {facilityOptions.map(facility => (
                <button
                  key={facility}
                  type="button"
                  onClick={() => toggleFacility(facility)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                    formData.facilities.includes(facility)
                      ? 'bg-sky-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {facility}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50"
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-sky-500 hover:bg-sky-600 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {language === 'hi' ? 'पंजीकृत करें' : 'Register'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

interface DigitalReceipt {
  id: string;
  farmerName: string;
  crop: string;
  quantity: number;
  storageDuration: number;
  totalCost: number;
  createdAt: any;
  status: string;
}

function WarehouseCard({ 
  warehouse, 
  pendingRequests, 
  onDelete, 
  onToggleStatus, 
  onIssueDWR, 
  processingRequestId 
}: { 
  warehouse: WarehouseFacility; 
  pendingRequests: StorageRequest[];
  onDelete: (w: WarehouseFacility) => void;
  onToggleStatus: (w: WarehouseFacility) => void;
  onIssueDWR: (r: StorageRequest) => void;
  processingRequestId: string | null;
}) {
  const { language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeDeposits, setActiveDeposits] = useState<DigitalReceipt[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);

  useEffect(() => {
    if (isExpanded && activeDeposits.length === 0) {
      fetchActiveDeposits();
    }
  }, [isExpanded]);

  const fetchActiveDeposits = async () => {
    if (isMockConfig) {
      setActiveDeposits([
        { id: 'rec-1', farmerName: 'Ramesh Kumar', crop: 'wheat', quantity: 15, createdAt: { toDate: () => new Date() }, status: 'deposited' },
        { id: 'rec-2', farmerName: 'Suresh Yadav', crop: 'paddy', quantity: 22.5, createdAt: { toDate: () => new Date() }, status: 'deposited' },
      ]);
      return;
    }

    setLoadingDeposits(true);
    try {
      const q = query(
        collection(db, 'digital_receipts'),
        where('warehouseId', '==', warehouse.id),
        where('status', '==', 'deposited')
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DigitalReceipt));
      setActiveDeposits(docs);
    } catch (error) {
      console.error('Error fetching deposits:', error);
    } finally {
      setLoadingDeposits(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative group transition-opacity ${!warehouse.isActive ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center">
            <Warehouse className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">{warehouse.name}</h3>
              {!warehouse.isActive && (
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                  {language === 'hi' ? 'निष्क्रिय - छिपा हुआ' : 'Inactive - Hidden'}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {warehouse.location}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleStatus(warehouse)}
            className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${
              warehouse.isActive 
                ? 'text-emerald-600 hover:bg-emerald-50' 
                : 'text-slate-400 hover:bg-slate-50'
            }`}
            title={warehouse.isActive ? 'Hide from Marketplace' : 'Show in Marketplace'}
          >
            {warehouse.isActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            {warehouse.isActive 
              ? (language === 'hi' ? 'सक्रिय' : 'Active') 
              : (language === 'hi' ? 'निष्क्रिय' : 'Inactive')}
          </button>

          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            warehouse.storageType === 'cold' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {warehouse.storageType === 'cold'
              ? (language === 'hi' ? 'कोल्ड स्टोरेज' : 'Cold Storage')
              : (language === 'hi' ? 'ड्राई वेयरहाउस' : 'Dry Warehouse')}
          </span>
          
          <button
            onClick={() => onDelete(warehouse)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            title={language === 'hi' ? 'गोदाम हटाएं' : 'Delete Warehouse'}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">
              {language === 'hi' ? 'किराया दर' : 'Rental Rate'}
            </p>
            <p className="text-xl font-bold text-sky-600">₹{warehouse.pricePerTonPerMonth}<span className="text-sm text-gray-400 font-normal">/ton/month</span></p>
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div className="bg-sky-50 rounded-xl p-4 border border-sky-100">
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs text-sky-600 uppercase tracking-wider font-semibold">{language === 'hi' ? 'कुल क्षमता' : 'Total Capacity'}</p>
              <Scale className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-2xl font-bold text-sky-700">{warehouse.totalCapacity} <span className="text-sm font-normal">tons</span></p>
          </div>
          <div className={`rounded-xl p-4 border transition-colors ${
            warehouse.availableCapacity < 10 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
          }`}>
            <div className="flex justify-between items-center mb-1">
              <p className={`text-xs uppercase tracking-wider font-semibold ${
                warehouse.availableCapacity < 10 ? 'text-red-600' : 'text-green-600'
              }`}>
                {language === 'hi' ? 'उपलब्ध' : 'Available'}
              </p>
              <CheckCircle2 className={`w-4 h-4 ${
                warehouse.availableCapacity < 10 ? 'text-red-400' : 'text-green-400'
              }`} />
            </div>
            <p className={`text-2xl font-bold ${
              warehouse.availableCapacity < 10 ? 'text-red-700' : 'text-green-700'
            }`}>
              {Math.max(0, Number(warehouse.availableCapacity)).toFixed(1)} <span className="text-sm font-normal">tons</span>
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Active Deposits Ledger */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-sky-600 transition-colors"
        >
          <Users className="w-4 h-4" />
          {language === 'hi' ? 'सक्रिय जमा देखें' : 'View Active Deposits'}
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-2">
                {loadingDeposits ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{language === 'hi' ? 'लोड हो रहा है...' : 'Loading deposits...'}</span>
                  </div>
                ) : activeDeposits.length > 0 ? (
                  activeDeposits.map((deposit) => {
                    const startDate = deposit.createdAt?.toDate() || new Date();
                    const endDate = new Date(startDate);
                    endDate.setMonth(endDate.getMonth() + (deposit.storageDuration || 0));
                    
                    const isExpiringSoon = (endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) < 7;
                    const farmerInitials = deposit.farmerName ? deposit.farmerName.charAt(0).toUpperCase() : 'F';
                    const startDateStr = startDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                    const endDateStr = endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

                    return (
                      <div key={deposit.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-4 bg-white rounded-xl border border-slate-200/70 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all duration-200 mb-3 group/row">
                        {/* Column 1: Farmer Profile & Crop */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                            {farmerInitials}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800">{deposit.farmerName}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md mt-1 w-fit uppercase font-medium tracking-wide">
                              {deposit.crop}
                            </span>
                          </div>
                        </div>

                        {/* Column 2: Volume & Duration */}
                        <div className="flex flex-col">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                            {language === 'hi' ? 'जमा आकार' : 'Deposit Size'}
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {deposit.quantity} Tons 
                            <span className="text-xs font-normal text-slate-500 ml-1">
                              ({deposit.storageDuration} Mo)
                            </span>
                          </p>
                        </div>

                        {/* Column 3: Timeline */}
                        <div className="flex flex-col">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                            {language === 'hi' ? 'अनुबंध अवधि' : 'Contract Period'}
                          </p>
                          <div className="flex items-center text-sm font-medium text-slate-700 gap-2">
                            <span className="bg-slate-50 px-2 py-1 rounded-md border border-slate-100 text-[11px]">
                              {startDateStr}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <div className="relative">
                              <span className={`bg-slate-50 px-2 py-1 rounded-md border text-[11px] ${
                                isExpiringSoon ? "border-amber-200 text-amber-700 bg-amber-50" : "border-slate-100"
                              }`}>
                                {endDateStr}
                              </span>
                              {isExpiringSoon && (
                                <span className="absolute -top-6 left-0 text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold whitespace-nowrap shadow-sm">
                                  {language === 'hi' ? 'जल्द समाप्त' : 'Expiring Soon'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Column 4: Revenue Pill */}
                        <div className="flex flex-col md:items-end">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                            {language === 'hi' ? 'अनुमानित राजस्व' : 'Est. Revenue'}
                          </p>
                          <div className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-lg border border-emerald-100 w-fit text-sm">
                            ₹{deposit.totalCost?.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-400 py-4 italic">
                    {language === 'hi' ? 'वर्तमान में कोई सक्रिय जमा नहीं है।' : 'No active deposits currently stored.'}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pending Requests for this Warehouse */}
      {pendingRequests.filter(r => r.warehouseId === warehouse.id).length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            {language === 'hi' ? 'लंबित अनुरोध' : 'Pending Requests'} ({pendingRequests.filter(r => r.warehouseId === warehouse.id).length})
          </h4>
          <div className="space-y-3">
            {pendingRequests.filter(r => r.warehouseId === warehouse.id).map((request) => (
              <div key={request.id} className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900 capitalize">{request.crop}</span>
                    <span className="text-gray-500 text-sm">• {request.quantity} tons</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{request.farmerName}</span> • {request.duration} {language === 'hi' ? 'महीने' : 'months'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sky-700 text-sm">₹{request.totalCost.toLocaleString()}</span>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onIssueDWR(request)}
                    disabled={processingRequestId === request.id}
                    className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {processingRequestId === request.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <FileText className="w-3 h-3" />
                        {language === 'hi' ? 'DWR जारी करें' : 'Issue DWR'}
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function WarehouseDashboard() {
  const { user, userData } = useAuth();
  const { language } = useLanguage();
  const { createNotification } = useNotifications();
  const [warehouses, setWarehouses] = useState<WarehouseFacility[]>([]);
  const [pendingRequests, setPendingRequests] = useState<StorageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    if (isMockConfig) {
      // Mock data
      setWarehouses([
        {
          id: 'mock-wh-1',
          name: 'Kisan Storage Hub',
          location: 'Azamgarh, Uttar Pradesh',
          district: 'Azamgarh',
          state: 'Uttar Pradesh',
          storageType: 'dry',
          totalCapacity: 500,
          availableCapacity: 350,
          pricePerTonPerMonth: 400,
          facilities: ['24/7 Security', 'Power Backup', 'Pest Control'],
          ownerId: user.uid,
          createdAt: new Date(),
        }
      ]);
      setPendingRequests([
        {
          id: 'req-1',
          warehouseId: 'mock-wh-1',
          warehouseName: 'Kisan Storage Hub',
          farmerId: 'farmer-1',
          farmerName: 'Ramesh Kumar',
          farmerPhone: '9876543210',
          crop: 'wheat',
          quantity: 5,
          unit: 'tons',
          duration: 3,
          totalCost: 6000,
          status: 'pending',
          createdAt: new Date(),
        },
        {
          id: 'req-2',
          warehouseId: 'mock-wh-1',
          warehouseName: 'Kisan Storage Hub',
          farmerId: 'farmer-2',
          farmerName: 'Suresh Yadav',
          farmerPhone: '9876543211',
          crop: 'paddy',
          quantity: 8,
          unit: 'tons',
          duration: 6,
          totalCost: 19200,
          status: 'pending',
          createdAt: new Date(),
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      // Fetch warehouses owned by this user
      const warehouseQuery = query(
        collection(db, 'warehouses'),
        where('ownerId', '==', user.uid)
      );
      const warehouseSnap = await getDocs(warehouseQuery);
      const warehouseList = warehouseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarehouseFacility));
      setWarehouses(warehouseList);

      if (warehouseList.length > 0) {
        // Fetch pending storage requests for all of owner's warehouses
        const whIds = warehouseList.map(wh => wh.id);
        const requestsQuery = query(
          collection(db, 'storage_requests'),
          where('warehouseId', 'in', whIds),
          where('status', '==', 'pending')
        );
        const requestsSnap = await getDocs(requestsQuery);
        const requests = requestsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StorageRequest[];
        setPendingRequests(requests);
      } else {
        setPendingRequests([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteWarehouse = async (warehouse: WarehouseFacility) => {
    // Data Integrity Guard: Check if warehouse is empty
    if (warehouse.availableCapacity < warehouse.totalCapacity) {
      toast.error(
        language === 'hi' 
          ? 'गोदाम नहीं हटा सकते। आपके पास सक्रिय किसान जमा हैं।' 
          : 'Cannot delete warehouse. You currently have active farmer deposits.'
      );
      return;
    }

    if (!window.confirm(language === 'hi' ? 'क्या आप निश्चित रूप से इस गोदाम को हटाना चाहते हैं?' : 'Are you sure you want to delete this warehouse?')) {
      return;
    }

    try {
      if (isMockConfig) {
        setWarehouses(prev => prev.filter(w => w.id !== warehouse.id));
      } else {
        await deleteDoc(doc(db, 'warehouses', warehouse.id));
        setWarehouses(prev => prev.filter(w => w.id !== warehouse.id));
      }
      toast.success(language === 'hi' ? 'गोदाम हटा दिया गया!' : 'Warehouse deleted successfully!');
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      toast.error(language === 'hi' ? 'हटाने में विफल' : 'Failed to delete warehouse');
    }
  };

  const toggleWarehouseStatus = async (warehouse: WarehouseFacility) => {
    const newStatus = !warehouse.isActive;
    try {
      if (isMockConfig) {
        setWarehouses(prev => prev.map(w => w.id === warehouse.id ? { ...w, isActive: newStatus } : w));
      } else {
        await updateDoc(doc(db, 'warehouses', warehouse.id), { isActive: newStatus });
        setWarehouses(prev => prev.map(w => w.id === warehouse.id ? { ...w, isActive: newStatus } : w));
      }
      toast.success(newStatus 
        ? (language === 'hi' ? 'गोदाम अब सक्रिय है!' : 'Warehouse is now active!')
        : (language === 'hi' ? 'गोदाम अब निष्क्रिय है!' : 'Warehouse is now inactive!')
      );
    } catch (error) {
      console.error('Error updating warehouse status:', error);
      toast.error(language === 'hi' ? 'स्थिति अपडेट करने में विफल' : 'Failed to update status');
    }
  };

  const handleIssueDWR = async (request: StorageRequest) => {
    const warehouse = warehouses.find(w => w.id === request.warehouseId);
    if (!warehouse) return;
    setProcessingRequestId(request.id);

    try {
      if (isMockConfig) {
        // Mock: just update local state
        setPendingRequests(prev => prev.filter(r => r.id !== request.id));
        toast.success(language === 'hi' ? 'DWR जारी किया!' : 'DWR Issued!');
        setProcessingRequestId(null);
        return;
      }

      // Sanitize all fields to prevent Firestore rejection of undefined values
      const sanitizedRequest = {
        farmerId: request.farmerId || 'unknown',
        farmerName: request.farmerName || 'Unknown Farmer',
        farmerPhone: request.farmerPhone || 'N/A',
        warehouseId: request.warehouseId || '',
        warehouseName: request.warehouseName || 'Unknown Warehouse',
        crop: request.crop || 'unknown',
        quantity: request.quantity || 0,
        unit: request.unit || 'tons',
        duration: request.duration || 0,
        totalCost: request.totalCost || 0,
      };

      // Use transaction to ensure atomicity
      await runTransaction(db, async (transaction) => {
        // READS FIRST: Get warehouse document first
        const warehouseRef = doc(db, 'warehouses', warehouse.id);
        const warehouseDoc = await transaction.get(warehouseRef);
        const currentAvailable = warehouseDoc.data()?.availableCapacity || 0;

        // WRITES: All writes come after reads
        // 1. Update storage request status to 'deposited'
        const requestRef = doc(db, 'storage_requests', request.id);
        transaction.update(requestRef, {
          status: 'deposited',
          depositedAt: serverTimestamp(),
        });

        // 2. Create the Digital Warehouse Receipt
        const receiptData = {
          farmerId: sanitizedRequest.farmerId,
          farmerName: sanitizedRequest.farmerName,
          farmerPhone: sanitizedRequest.farmerPhone,
          warehouseId: sanitizedRequest.warehouseId,
          warehouseName: sanitizedRequest.warehouseName,
          warehouseLocation: warehouse.location || '',
          crop: sanitizedRequest.crop,
          quantity: sanitizedRequest.quantity,
          unit: sanitizedRequest.unit,
          storageDuration: sanitizedRequest.duration,
          totalCost: sanitizedRequest.totalCost,
          pricePerTonPerMonth: warehouse.pricePerTonPerMonth || 0,
          marketValueAtDeposit: sanitizedRequest.totalCost || 0,
          status: 'deposited',
          pledgeStatus: 'unpledged',
          bookingDate: serverTimestamp(),
          createdAt: serverTimestamp(),
        };

        const receiptRef = collection(db, 'digital_receipts');
        transaction.set(doc(receiptRef), receiptData);

        // 3. Update warehouse available capacity (after the read)
        transaction.update(warehouseRef, {
          availableCapacity: currentAvailable - sanitizedRequest.quantity,
        });
      });

      // Update local state
      setPendingRequests(prev => prev.filter(r => r.id !== request.id));
      setWarehouses(prev => prev.map(w => 
        w.id === warehouse.id 
          ? { ...w, availableCapacity: w.availableCapacity - sanitizedRequest.quantity } 
          : w
      ));

      toast.success(language === 'hi' ? 'DWR जारी किया! किसान अब गिरवी लोन ले सकता है।' : 'DWR Issued! Farmer can now use it for collateralized loan.');

      // Send notification to farmer
      await createNotification(
        sanitizedRequest.farmerId,
        language === 'hi' ? 'DWR जारी किया!' : 'DWR Issued',
        language === 'hi'
          ? `${sanitizedRequest.quantity} टन ${sanitizedRequest.crop} सुरक्षित रूप से संग्रहीत।`
          : `${sanitizedRequest.quantity} tons of ${sanitizedRequest.crop} securely stored.`,
        'success',
        '/vault'
      );
    } catch (error: any) {
      console.error('Firebase Write Error:', error);
      const errorMessage = error?.message || (language === 'hi' ? 'अज्ञात त्रुटि' : 'Unknown error');
      toast.error(errorMessage);
    } finally {
      setProcessingRequestId(null);
    }
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
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {language === 'hi' ? 'गोदाम डैशबोर्ड' : 'Warehouse Dashboard'}
            </h1>
            <p className="text-white/80 text-sm">
              {language === 'hi' ? 'अपने भंडारण व्यवसाय का प्रबंधन करें' : 'Manage your storage business'}
            </p>
          </div>
        </div>
      </div>

      {/* My Warehouses Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          {language === 'hi' ? 'मेरे गोदाम' : 'My Warehouses'}
        </h2>
        {warehouses.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 bg-sky-500 text-white text-sm font-bold rounded-xl flex items-center gap-2"
          >
            <Warehouse className="w-4 h-4" />
            {language === 'hi' ? '+ गोदाम' : '+ Add Warehouse'}
          </motion.button>
        )}
      </div>

      {warehouses.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {warehouses.map((warehouse) => (
            <WarehouseCard
              key={warehouse.id}
              warehouse={warehouse}
              pendingRequests={pendingRequests}
              onDelete={deleteWarehouse}
              onToggleStatus={toggleWarehouseStatus}
              onIssueDWR={handleIssueDWR}
              processingRequestId={processingRequestId}
            />
          ))}
        </div>
      ) : (
        /* No Warehouses - Show Registration Empty State */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-12 border-2 border-dashed border-gray-200 text-center"
        >
          <div className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Warehouse className="w-10 h-10 text-sky-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {language === 'hi' ? 'अपना पहला गोदाम पंजीकृत करें' : 'Register Your First Warehouse'}
          </h2>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">
            {language === 'hi'
              ? 'अपनी भंडारण सुविधा पंजीकृत करें और स्थानीय किसानों को सुरक्षित स्टोरेज प्रदान करना शुरू करें।'
              : 'Register your storage facility and start providing secure storage to local farmers.'}
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowRegisterModal(true)}
            className="px-8 py-4 bg-sky-500 text-white font-bold rounded-2xl flex items-center gap-2 mx-auto shadow-lg shadow-sky-100"
          >
            <Warehouse className="w-5 h-5" />
            {language === 'hi' ? 'गोदाम पंजीकृत करें' : 'Register Warehouse'}
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      )}
      {/* Register Modal */}
      <AddWarehouseModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={(warehouse) => {
          setWarehouses(prev => [...prev, warehouse]);
          setShowRegisterModal(false);
          fetchData();
        }}
      />
    </div>
  );
}