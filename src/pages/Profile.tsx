import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { auth, signOut, db, doc, setDoc, isMockConfig } from '../lib/firebase';
import { collection, query, where, updateDoc, getDocs, deleteDoc } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { 
  User, Calendar, Sprout, Globe, LogOut, Package, MapPin, 
  CheckCircle2, XCircle, Tractor, Edit2, Trash2, Scale, 
  ShoppingCart, Clock, TrendingUp, Phone, Home, Briefcase, 
  Award, ShieldCheck, Droplets, Landmark, Dog, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateHi, formatRupee } from '../lib/formatters';
import { clsx } from 'clsx';
import { NotificationService } from '../lib/NotificationService';
import FarmFormModal, { FarmProfileData } from '../components/FarmFormModal';
import { formatLocationLine } from '../utils/formatLocation';

const getDate = (ts: any) => {
  if (!ts) return "N/A";
  if (ts?.toDate) return ts.toDate().toLocaleString();
  if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleString();
  return new Date(ts).toLocaleString();
};

export default function Profile() {
  const { user, userData, setUserData } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const isBuyer = userData?.role === 'buyer';
  const isFarmer = userData?.role === 'farmer';
  const isFarmerOrSeller = userData?.role === 'farmer' || userData?.role === 'seller';

  const [activeTab, setActiveTab] = useState<'profile' | 'farms' | 'orders' | 'rentals' | 'history'>('profile');

  const [farms, setFarms] = useState<FarmProfileData[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [isFarmFormOpen, setIsFarmFormOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<FarmProfileData | null>(null);

  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [rentals, setRentals] = useState<any[]>([]);
  const [rentalsLoading, setRentalsLoading] = useState(false);

  const [historySales, setHistorySales] = useState<any[]>([]);
  const [historyPurchases, setHistoryPurchases] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [farmsInitialized, setFarmsInitialized] = useState(false);

  const fetchFarms = async () => {
    if (!user) return;
    if (isMockConfig) {
      if (!farmsInitialized) {
        setFarms([
          {
            id: 'mock-farm-1',
            name: 'Green Valley Farm',
            crops: ['Wheat'],
            area: 5,
            soil: 'Alluvial',
            state: 'Uttar Pradesh',
            district: 'Varanasi',
            irrigation: 'Tubewell',
            season: 'Rabi',
            createdAt: new Date().toISOString()
          }
        ]);
        setFarmsInitialized(true);
      }
      return;
    }
    setFarmsLoading(true);
    try {
      const snap = await getDocs(query(collection(db, `users/${user.uid}/farms`)));
      setFarms(snap.docs.map(d => ({ id: d.id, ...d.data() } as FarmProfileData)));
    } catch (e: any) {
       console.error(e);
       toast.error(language === 'en' ? `Failed to load farms: ${e.message}` : `खेत लोड करने में विफल: ${e.message}`);
    } finally {
      setFarmsLoading(false);
    }
  };

  const handleDeleteFarm = async (farmId: string) => {
    if (!user) return;
    if (!window.confirm(language === 'en' ? 'Are you sure you want to delete this farm?' : 'क्या आप वाकई इस खेत को हटाना चाहते हैं?')) return;
    
    if (isMockConfig) {
      setFarms(prev => prev.filter(f => f.id !== farmId));
      setFarmsInitialized(true); // Ensure we don't re-fetch mock data
      toast.success(language === 'en' ? 'Farm deleted' : 'खेत हटा दिया गया');
      return;
    }

    try {
      await deleteDoc(doc(db, `users/${user.uid}/farms`, farmId));
      setFarms(prev => prev.filter(f => f.id !== farmId));
      toast.success(language === 'en' ? 'Farm deleted' : 'खेत हटा दिया गया');
    } catch(e: any) {
      console.error(e);
      const msg = e?.message || 'Unknown error';
      toast.error(language === 'en' ? `Failed to delete farm: ${msg}` : `खेत हटाने में विफल: ${msg}`);
    }
  };

  useEffect(() => {
    if (!user) return;

    if (activeTab === 'farms' && isFarmerOrSeller) {
      fetchFarms();
    }

    if (isMockConfig) return;

    const fetchOrders = async () => {
      setOrdersLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'orders'), where('buyerId', '==', user.uid)));
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
         console.error(e);
      } finally {
        setOrdersLoading(false);
      }
    };

    const fetchRentals = async () => {
      setRentalsLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'equipment_bookings'), where('userId', '==', user.uid)));
        setRentals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
         console.error(e);
      } finally {
        setRentalsLoading(false);
      }
    };

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const salesSnap = await getDocs(
          query(collection(db, 'listings'), where('farmerId', '==', user.uid), where('status', '==', 'sold'))
        );
        setHistorySales(salesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const purchaseSnap = await getDocs(query(collection(db, 'orders'), where('buyerId', '==', user.uid)));
        setHistoryPurchases(purchaseSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setHistoryLoading(false);
      }
    };

    if (activeTab === 'orders' && isBuyer) fetchOrders();
    if (activeTab === 'rentals' && isBuyer) fetchRentals();
    if (activeTab === 'history' && isFarmerOrSeller) fetchHistory();

  }, [activeTab, user, isBuyer, isFarmerOrSeller]);

  const stats = useMemo(() => {
    const totalSales = historySales.reduce((acc, s) => acc + (Number(s.price) * Number(s.quantity || 1)), 0);
    const totalPurchases = historyPurchases.reduce((acc, p) => acc + (p.total || 0), 0);
    const crops = historySales.map(s => s.crop);
    const mainCrop = crops.length > 0 ? crops.sort((a,b) => crops.filter(v => v===a).length - crops.filter(v => v===b).length).pop() : 'N/A';
    
    return { totalSales, totalPurchases, mainCrop };
  }, [historySales, historyPurchases]);

  const handleCancelOrder = async (order: any) => {
    if (isMockConfig) return;
    if (!confirm(language === 'en' ? 'Cancel this order?' : 'क्या आप वाकई इस ऑर्डर को रद्द करना चाहते हैं?')) return;
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: 'Cancelled' });
      toast.success(language === 'en' ? 'Order Cancelled' : 'ऑर्डर रद्द कर दिया गया');
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Cancelled' } : o));
    } catch (e) {
      console.error(e);
      toast.error('Failed to cancel order');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUserData(null);
      navigate('/');
      toast.success(t('sign_out'));
    } catch (e) {
      console.error(e);
    }
  };

  const memberSince = userData?.createdAt ? formatDateHi(userData.createdAt) : '—';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100 overflow-x-auto hide-scrollbar sticky top-4 z-10">
          <button onClick={() => setActiveTab('profile')} className={clsx('flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all min-h-[44px] whitespace-nowrap', activeTab === 'profile' ? 'bg-forest-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50')}>
            {t('prof_my_profile')}
          </button>
          {isFarmerOrSeller && (
            <>
            <button onClick={() => setActiveTab('farms')} className={clsx('flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all min-h-[44px] whitespace-nowrap', activeTab === 'farms' ? 'bg-forest-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50')}>
              {t('prof_my_farm')}
            </button>
            <button onClick={() => setActiveTab('history')} className={clsx('flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all min-h-[44px] whitespace-nowrap', activeTab === 'history' ? 'bg-forest-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50')}>
              {t('prof_biz_history')}
            </button>
            </>
          )}
          {isBuyer && (
            <>
              <button onClick={() => setActiveTab('orders')} className={clsx('flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all min-h-[44px] whitespace-nowrap', activeTab === 'orders' ? 'bg-forest-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50')}>
                {language === 'en' ? 'My Orders' : 'मेरे आदेश'}
              </button>
            </>
          )}
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6 animate-fade-in">
          {/* Main User Card */}
          <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-forest-50 rounded-bl-[5rem] -mr-8 -mt-8 opacity-50" />
            
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full bg-forest-100 flex items-center justify-center text-forest-600 border-4 border-white shadow-lg overflow-hidden">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-16 h-16" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-2 rounded-full border-2 border-white shadow-md">
                   <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              <div className="text-center md:text-left space-y-2">
                <h1 className="text-3xl font-bold text-gray-900">{userData?.name || 'Farmer'}</h1>
                <p className="text-gray-500 font-medium flex items-center justify-center md:justify-start gap-2">
                  <Phone className="w-4 h-4 text-forest-600" /> {userData?.phone || 'No phone added'}
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                  <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 uppercase tracking-widest border border-amber-200">
                    {userData?.role === 'farmer' ? 'Verified Farmer' : 'Seller'}
                  </span>
                  <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-forest-100 text-forest-700 flex items-center gap-1.5 border border-forest-200">
                    <Calendar className="w-3.5 h-3.5" /> {t('prof_member_since')} {memberSince}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Personal Info */}
             <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 pb-3 border-b border-gray-50">
                 <Home className="w-5 h-5 text-forest-600" />
                 {t('prof_personal_details')}
               </h3>
               <div className="space-y-4 pt-2">
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-500 font-medium">{t('prof_village')}</span>
                   <span className="text-gray-900 font-bold">{userData?.village || 'Not Set'}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-500 font-medium">{t('prof_address')}</span>
                   <span className="text-gray-900 font-bold">{userData?.address || '—'}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-500 font-medium">{t('prof_aadhaar')}</span>
                   <span className="text-gray-900 font-bold">XXXX XXXX {userData?.aadhaarLast4 || '4928'}</span>
                 </div>
               </div>
             </div>

             {/* Professional Info */}
             <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 pb-3 border-b border-gray-50">
                 <Briefcase className="w-5 h-5 text-blue-600" />
                 {t('prof_professional_info')}
               </h3>
               <div className="space-y-4 pt-2">
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-500 font-medium">{t('prof_experience')}</span>
                   <span className="text-gray-900 font-bold">{userData?.experience || '10+'} {t('prof_years')}</span>
                 </div>
                 <div className="space-y-2">
                   <span className="text-gray-500 font-medium text-sm">{t('prof_expertise')}</span>
                   <div className="flex flex-wrap gap-2">
                     {userData?.expertise?.map(e => (
                       <span key={e} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">{e}</span>
                     )) || ['Wheat', 'Rice', 'Sugarcane'].map(e => (
                       <span key={e} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">{e}</span>
                     ))}
                   </div>
                 </div>
               </div>
             </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-12 h-12 bg-forest-50 text-forest-600 rounded-2xl flex items-center justify-center border border-forest-100">
                 <Globe className="w-6 h-6"/>
               </div>
               <div>
                 <p className="font-bold text-gray-900">{t('prof_app_lang')}</p>
                 <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{language === 'en' ? 'English (Global)' : 'हिंदी (भारत)'}</p>
               </div>
             </div>
             <button onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')} className="btn-secondary px-6 py-2.5 rounded-xl font-bold text-sm">
               {language === 'en' ? 'Switch to हिंदी' : 'Switch to English'}
             </button>
          </div>

          <button onClick={handleSignOut} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-4 rounded-3xl border border-red-100 transition-all flex items-center justify-center gap-2 group">
             <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
             {t('prof_sign_out_account')}
          </button>
        </div>
      )}

      {activeTab === 'farms' && isFarmerOrSeller && (
        <div className="space-y-6 animate-fade-in">
           <div className="flex justify-between items-center">
             <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
               <Sprout className="w-8 h-8 text-forest-600" />
               {t('prof_my_farm')}
             </h2>
             <button onClick={() => { setEditingFarm(null); setIsFarmFormOpen(true); }} className="btn-primary flex items-center gap-2 px-6 py-3">
               <Tractor className="w-5 h-5" />
               {language === 'en' ? 'Add New Farm' : 'नया खेत जोड़ें'}
             </button>
           </div>

           {farmsLoading ? (
             <div className="grid gap-6">
                <div className="skeleton h-64 w-full rounded-[2rem]" />
                <div className="skeleton h-64 w-full rounded-[2rem]" />
             </div>
           ) : farms.length > 0 ? (
             <div className="grid gap-8">
               {farms.map(f => (
                 <div key={f.id} className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-500">
                   <div className="bg-forest-600 p-8 text-white relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                     <div className="flex justify-between items-start relative z-10">
                       <div className="flex items-center gap-6">
                         <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/30">
                           <Tractor className="w-10 h-10"/>
                         </div>
                         <div>
                           <h3 className="text-3xl font-bold">{f.name}</h3>
                           <p className="flex items-center gap-1.5 text-white/80 font-medium mt-1">
                             <MapPin className="w-4 h-4"/> {formatLocationLine(f.district, f.state)}
                           </p>
                         </div>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => { setEditingFarm(f); setIsFarmFormOpen(true); }} className="p-3 bg-white/20 hover:bg-white/30 rounded-2xl backdrop-blur-sm transition-all border border-white/10">
                           <Edit2 className="w-5 h-5" />
                         </button>
                         <button onClick={() => f.id && handleDeleteFarm(f.id)} className="p-3 bg-white/20 hover:bg-red-500/40 rounded-2xl backdrop-blur-sm transition-all border border-white/10">
                           <Trash2 className="w-5 h-5" />
                         </button>
                       </div>
                     </div>
                   </div>
                   
                   <div className="p-8 space-y-8">
                     {/* Core Specs */}
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                       <div className="space-y-1">
                         <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('prof_land_area')}</p>
                         <p className="text-lg font-bold text-gray-900 flex items-center gap-2"><Scale className="w-5 h-5 text-blue-500"/> {f.area} {t('prof_acres')}</p>
                       </div>
                       <div className="space-y-1">
                         <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('prof_soil')}</p>
                         <p className="text-lg font-bold text-gray-900 flex items-center gap-2"><Sprout className="w-5 h-5 text-orange-500"/> {f.soil}</p>
                       </div>
                       <div className="space-y-1">
                         <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{language === 'en' ? 'Irrigation' : 'सिंचाई'}</p>
                         <p className="text-lg font-bold text-gray-900 flex items-center gap-2"><Droplets className="w-5 h-5 text-cyan-500"/> {f.irrigation}</p>
                       </div>
                       <div className="space-y-1">
                         <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{language === 'en' ? 'Season' : 'मौसम'}</p>
                         <p className="text-lg font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-forest-500"/> {f.season}</p>
                       </div>
                     </div>

                     {/* Advanced Specs */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-gray-50">
                        <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 flex items-center gap-4">
                           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-forest-600 shadow-sm"><Landmark className="w-6 h-6"/></div>
                           <div>
                             <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('prof_ownership')}</p>
                             <p className="font-bold text-gray-900">{f.landType || 'Owned'}</p>
                           </div>
                        </div>
                        <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 flex items-center gap-4">
                           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm"><Droplets className="w-6 h-6"/></div>
                           <div>
                             <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('prof_water_source')}</p>
                             <p className="font-bold text-gray-900">{f.waterSource || 'Tubewell'}</p>
                           </div>
                        </div>
                     </div>

                     {/* Machinery & Livestock */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                           <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                             <Tractor className="w-4 h-4 text-orange-600" />
                             {t('prof_machinery')}
                           </p>
                           <div className="flex flex-wrap gap-2">
                             {f.machinery?.length ? f.machinery.map(m => (
                               <span key={m} className="px-3 py-1.5 bg-orange-50 text-orange-700 text-xs font-bold rounded-xl border border-orange-100">{m}</span>
                             )) : <span className="text-gray-400 text-xs italic">No machinery listed</span>}
                           </div>
                        </div>
                        <div className="space-y-3">
                           <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                             <Dog className="w-4 h-4 text-forest-600" />
                             {t('prof_livestock')}
                           </p>
                           <div className="flex flex-wrap gap-2">
                             {f.livestock?.length ? f.livestock.map(l => (
                               <span key={l} className="px-3 py-1.5 bg-forest-50 text-forest-700 text-xs font-bold rounded-xl border border-forest-100">{l}</span>
                             )) : <span className="text-gray-400 text-xs italic">No livestock listed</span>}
                           </div>
                        </div>
                     </div>

                     {f.notes && (
                        <div className="p-6 bg-forest-50/50 rounded-3xl border border-forest-100 italic text-forest-800 text-sm flex gap-3">
                           <Info className="w-5 h-5 shrink-0 text-forest-400" />
                           "{f.notes}"
                        </div>
                     )}

                     <div className="flex items-center justify-between pt-6 border-t border-gray-50 text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
                       <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Last Modified: {getDate(f.createdAt)}</span>
                       {f.id && <span>FARM_UID: {f.id.slice(-8)}</span>}
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           ) : (
             <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-gray-200 shadow-sm">
               <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Sprout className="w-12 h-12 text-gray-300" />
               </div>
               <h3 className="text-xl font-bold text-gray-900 mb-2">{language === 'en' ? 'Your farm profile is empty' : 'आपका खेत प्रोफ़ाइल खाली है'}</h3>
               <p className="text-gray-500 mb-8 max-w-sm mx-auto">Add your land details to receive tailored advice and mandi price alerts.</p>
               <button onClick={() => setIsFarmFormOpen(true)} className="btn-primary px-8 py-3 rounded-2xl shadow-lg">
                 {language === 'en' ? 'Register My First Farm' : 'मेरा पहला खेत जोड़ें'}
               </button>
             </div>
           )}
        </div>
      )}

      {activeTab === 'history' && isFarmerOrSeller && (
        <div className="space-y-8 animate-fade-in">
          {historyLoading ? (
            <div className="skeleton h-96 w-full rounded-[2rem]" />
          ) : (
            <>
              {/* Business Dashboard Header */}
              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 overflow-hidden relative">
                <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-50 rounded-tl-full opacity-30" />
                <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                   <TrendingUp className="w-8 h-8 text-forest-600" />
                   {t('prof_biz_overview')}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                   <div className="bg-forest-50 p-6 rounded-3xl border border-forest-100 space-y-2">
                      <p className="text-xs font-bold text-forest-700 uppercase tracking-widest">{t('prof_total_sales')}</p>
                      <p className="text-3xl font-black text-forest-900">{formatRupee(stats.totalSales)}</p>
                      <div className="flex items-center gap-1 text-[10px] text-forest-600 font-bold">
                         <TrendingUp className="w-3 h-3"/> +12% from last season
                      </div>
                   </div>
                   <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 space-y-2">
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">{t('prof_total_purchases')}</p>
                      <p className="text-3xl font-black text-blue-900">{formatRupee(stats.totalPurchases)}</p>
                      <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold">
                         <ShoppingCart className="w-3 h-3"/> Seeds, Fertilizers & Tools
                      </div>
                   </div>
                   <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 space-y-2">
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">{t('prof_primary_crop')}</p>
                      <p className="text-3xl font-black text-amber-900">{stats.mainCrop}</p>
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                         <Award className="w-3 h-3"/> Most Sold Crop Item
                      </div>
                   </div>
                </div>
              </div>

              {/* Sales Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Sprout className="w-6 h-6 text-forest-600" />
                    {t('prof_sales_history')}
                  </h3>
                  <button className="text-forest-600 font-bold text-sm hover:underline">{t('prof_download_csv')}</button>
                </div>
                {historySales.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-100">
                    <p className="text-gray-400 font-medium">{language === 'en' ? 'No sales records found.' : 'कोई बिक्री रिकॉर्ड नहीं मिला।'}</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {historySales.map((l) => (
                      <div key={l.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-all">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-forest-100 text-forest-600 rounded-2xl flex items-center justify-center shrink-0 border border-forest-200">
                            <Package className="w-7 h-7" />
                          </div>
                          <div>
                            <p className="font-black text-gray-900 text-xl">{l.crop}</p>
                            <p className="text-sm text-gray-500 font-bold flex items-center gap-2 mt-1">
                               <Scale className="w-4 h-4 text-forest-500"/> {l.quantity} {l.unit} 
                               <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                               <MapPin className="w-4 h-4 text-red-400"/> {l.district}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col md:items-end gap-1.5 pt-4 md:pt-0 border-t md:border-t-0 border-gray-50">
                          <div className="flex items-center gap-2">
                             <span className="px-3 py-1 rounded-full text-[10px] font-black bg-green-100 text-green-700 uppercase tracking-widest border border-green-200">
                                COMPLETED
                             </span>
                             <p className="font-black text-2xl text-gray-900">{formatRupee(Number(l.price) * Number(l.quantity || 1))}</p>
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                             <Clock className="w-3.5 h-3.5"/> Sold on {getDate(l.soldAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Purchases Section */}
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                  {t('prof_purchase_history')}
                </h3>
                {historyPurchases.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-100">
                    <p className="text-gray-400 font-medium">{language === 'en' ? 'No purchase records found.' : 'कोई खरीद रिकॉर्ड नहीं मिला।'}</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {historyPurchases.map((o) => (
                      <div key={o.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-all">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 border border-blue-100">
                            <ShoppingCart className="w-7 h-7" />
                          </div>
                          <div>
                            <p className="font-black text-gray-900 text-xl">Order #{String(o.id).slice(-6).toUpperCase()}</p>
                            <p className="text-sm text-gray-500 font-bold mt-1">
                              {o.items?.length ? o.items.map((i: any) => i.name).join(', ') : 'Market Purchase'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col md:items-end gap-1.5 pt-4 md:pt-0 border-t md:border-t-0 border-gray-50">
                          <div className="flex items-center gap-2">
                             <span className={clsx(
                               "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                               o.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-200' :
                               o.status === 'Cancelled' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                             )}>
                               {o.status || 'Pending'}
                             </span>
                             <p className="font-black text-2xl text-gray-900">{formatRupee(o.total || 0)}</p>
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                             <Clock className="w-3.5 h-3.5"/> {getDate(o.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'orders' && isBuyer && (
        <div className="space-y-4 animate-fade-in">
           {ordersLoading ? (
               <div className="skeleton h-32 w-full rounded-2xl" />
           ) : orders.length > 0 ? (
             orders.map(order => (
               <div key={order.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
                 <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                   <div>
                     <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                       <Package className="w-5 h-5 text-forest-600" />
                       Order #{order.id.slice(-6).toUpperCase()}
                     </h3>
                     <p className="text-xs text-gray-500">{getDate(order.createdAt)}</p>
                   </div>
                   <span className={clsx(
                     "px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider", 
                     order.status === 'Completed' ? 'bg-green-100 text-green-700' :
                     order.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                   )}>
                     {order.status}
                   </span>
                 </div>
                 
                 <div className="space-y-2 text-sm bg-gray-50 border border-gray-100 p-3 rounded-xl">
                   {order.items?.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center">
                        <span className="font-medium text-gray-800">{item.quantity}x {item.name}</span>
                        <span className="font-bold text-gray-900">{formatRupee(item.price * item.quantity)}</span>
                      </div>
                   ))}
                 </div>
                 
                 <div className="flex justify-between items-center pt-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                      <p className="font-bold text-lg text-forest-900 leading-none">{formatRupee(order.total)}</p>
                    </div>
                    {!isFarmer && (order.status === 'Pending' || order.status === 'Confirmed') && (
                       <button onClick={() => handleCancelOrder(order)} className="text-xs text-red-600 hover:text-red-700 font-bold border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg flex items-center gap-1 transition-colors">
                         <XCircle className="w-4 h-4"/> Cancel Order
                       </button>
                    )}
                 </div>
               </div>
             ))
           ) : (
             <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
               <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
               <p className="text-gray-500 text-lg font-medium">{language === 'en' ? 'No orders found.' : 'कोई आदेश नहीं मिला।'}</p>
             </div>
           )}
        </div>
      )}

      <FarmFormModal 
        isOpen={isFarmFormOpen} 
        onClose={() => setIsFarmFormOpen(false)} 
        initialData={editingFarm}
        onSuccess={() => { setIsFarmFormOpen(false); fetchFarms(); }} 
      />
    </div>
  );
}
