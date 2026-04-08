import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { auth, signOut, db, doc, setDoc, isMockConfig } from '../lib/firebase';
import { collection, query, where, updateDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { User, Calendar, Sprout, Globe, LogOut, Package, MapPin, CheckCircle2, XCircle, Tractor, Edit2, Trash2 } from 'lucide-react';
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

  const fetchFarms = async () => {
    if (!user || isMockConfig) return;
    setFarmsLoading(true);
    try {
      const snap = await getDocs(query(collection(db, `users/${user.uid}/farms`)));
      setFarms(snap.docs.map(d => ({ id: d.id, ...d.data() } as FarmProfileData)));
    } catch (e) {
       console.error(e);
    } finally {
      setFarmsLoading(false);
    }
  };

  const handleDeleteFarm = async (farmId: string) => {
    if (isMockConfig || !user) return;
    if (!window.confirm(language === 'en' ? 'Are you sure you want to delete this farm?' : 'क्या आप वाकई इस खेत को हटाना चाहते हैं?')) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/farms`, farmId));
      toast.success(language === 'en' ? 'Farm deleted' : 'खेत हटा दिया गया');
      fetchFarms();
    } catch(e) {
      console.error(e);
      toast.error('Failed to delete farm');
    }
  };

  useEffect(() => {
    if (!user || isMockConfig) return;

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

    if (activeTab === 'farms' && isFarmerOrSeller) fetchFarms();
    if (activeTab === 'orders' && isBuyer) fetchOrders();
    if (activeTab === 'rentals' && isBuyer) fetchRentals();
    if (activeTab === 'history' && isFarmerOrSeller) fetchHistory();

  }, [activeTab, user, isBuyer, isFarmerOrSeller]);

  const handleCancelOrder = async (order: any) => {
    if (isMockConfig) return;
    if (!confirm(language === 'en' ? 'Cancel this order?' : 'क्या आप वाकई इस ऑर्डर को रद्द करना चाहते हैं?')) return;
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: 'Cancelled' });
      toast.success(language === 'en' ? 'Order Cancelled' : 'ऑर्डर रद्द कर दिया गया');
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Cancelled' } : o));

      if (order.sellerId) {
        await NotificationService.sendNotification(order.sellerId, {
          title: 'Order Cancelled',
          message: `An order was cancelled by the buyer.`,
          type: 'order',
          relatedId: order.id
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to cancel order');
    }
  };

  const handleCancelRental = async (rentalId: string) => {
    if (isMockConfig) return;
    if (!confirm(language === 'en' ? 'Cancel this rental?' : 'यह रेंटल रद्द करें?')) return;
    try {
      await updateDoc(doc(db, 'equipment_bookings', rentalId), { status: 'cancelled' });
      toast.success(language === 'en' ? 'Rental Cancelled' : 'रेंटल रद्द');
      setRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status: 'cancelled' } : r));
    } catch(e) {
      console.error(e);
      toast.error('Failed to cancel');
    }
  };

  const toggleLang = async () => {
    const next = language === 'en' ? 'hi' : 'en';
    setLanguage(next);
    if (userData && !isMockConfig && user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { ...userData, language: next }, { merge: true });
        setUserData({ ...userData, language: next });
      } catch (e) {
        console.error(e);
      }
    } else if (userData) {
      setUserData({ ...userData, language: next });
    }
    toast.success(next === 'hi' ? 'भाषा: हिंदी' : 'Language: English');
  };

  const handleSignOut = async () => {
    if (isMockConfig) {
      setUserData(null);
      navigate('/');
      return;
    }
    try {
      await signOut(auth);
      setUserData(null);
      navigate('/');
      toast.success(t('sign_out'));
    } catch (e) {
      console.error(e);
      toast.error(t('error'));
    }
  };

  const avatarUrl = user?.photoURL || undefined;
  const memberSince = userData?.createdAt ? formatDateHi(userData.createdAt) : '—';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="flex bg-white rounded-2xl p-1 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-gray-100 overflow-x-auto hide-scrollbar">
          <button onClick={() => setActiveTab('profile')} className={clsx('flex-1 px-6 py-3 rounded-xl font-medium text-sm transition-colors min-h-[44px] whitespace-nowrap', activeTab === 'profile' ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280]')}>
            {language === 'en' ? 'My Profile' : 'मेरी प्रोफाइल'}
          </button>
          {isBuyer && (
            <>
              <button onClick={() => setActiveTab('orders')} className={clsx('flex-1 px-6 py-3 rounded-xl font-medium text-sm transition-colors min-h-[44px] whitespace-nowrap', activeTab === 'orders' ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280]')}>
                {language === 'en' ? 'My Orders' : 'मेरे आदेश'}
              </button>
              <button onClick={() => setActiveTab('rentals')} className={clsx('flex-1 px-6 py-3 rounded-xl font-medium text-sm transition-colors min-h-[44px] whitespace-nowrap', activeTab === 'rentals' ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280]')}>
                {language === 'en' ? 'My Rentals' : 'मेरे किराये'}
              </button>
            </>
          )}
          {isFarmerOrSeller && (
            <>
            <button onClick={() => setActiveTab('farms')} className={clsx('flex-1 px-6 py-3 rounded-xl font-medium text-sm transition-colors min-h-[44px] whitespace-nowrap', activeTab === 'farms' ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280]')}>
              {language === 'en' ? 'My Farm' : 'मेरा खेत'}
            </button>
            <button onClick={() => setActiveTab('history')} className={clsx('flex-1 px-6 py-3 rounded-xl font-medium text-sm transition-colors min-h-[44px] whitespace-nowrap', activeTab === 'history' ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280]')}>
              {language === 'en' ? 'Buy/Sell History' : 'खरीद/बिक्री इतिहास'}
            </button>
            </>
          )}
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6 animate-fade-in">
          <div className="ds-card space-y-6 max-w-3xl mx-auto">
            <div className="flex flex-col items-center text-center gap-4">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-[#D1FAE5] shadow-md" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#1B4332]">
                  <User className="w-12 h-12" />
                </div>
              )}
              <div>
                <p className="text-xl font-bold text-[#111827]">{userData?.name || user?.displayName || 'User'}</p>
                <p className="text-gray-500 text-sm mt-1">{userData?.email || user?.email}</p>
                <span className="mt-3 inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-[#F59E0B]/20 text-[#1B4332] uppercase tracking-wider">
                  {userData?.role === 'farmer' ? t('farmer') : userData?.role === 'seller' ? 'Seller' : t('buyer')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#6B7280] text-sm bg-gray-50 px-4 py-2 rounded-xl mt-2">
                <Calendar className="w-4 h-4" />
                <span className="font-devanagari">{t('prof_member_since')}: {memberSince}</span>
              </div>
            </div>
          </div>

          <div className="ds-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-3xl mx-auto">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-[#D1FAE5] text-[#1B4332] rounded-full flex items-center justify-center"><Globe className="w-5 h-5"/></div>
               <div>
                 <p className="font-bold text-[#111827] font-devanagari">{t('prof_language')}</p>
                 <p className="text-sm text-gray-500">{language === 'en' ? 'English is active' : 'हिंदी सक्रिय है'}</p>
               </div>
             </div>
             <button type="button" className="btn-secondary min-w-[140px] justify-center" onClick={toggleLang}>
               {language === 'en' ? t('prof_switch_hi') : t('prof_switch_en')}
             </button>
          </div>

          <div className="max-w-3xl mx-auto">
            <button
              type="button"
              className="w-full rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 font-bold py-4 min-h-[44px] flex items-center justify-center gap-2 transition-colors border border-red-100"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5" />
              {t('prof_sign_out')}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'farms' && isFarmerOrSeller && (
        <div className="space-y-6 animate-fade-in">
           <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
             <h2 className="ds-section-title font-devanagari mb-0 flex items-center gap-2">
               <Sprout className="w-5 h-5 text-forest-600" />
               {language === 'en' ? 'My Farm Profile' : 'खेत प्रोफ़ाइल'}
             </h2>
             <button onClick={() => { setEditingFarm(null); setIsFarmFormOpen(true); }} className="btn-secondary px-4 py-2 text-sm">+ {language === 'en' ? 'Add Farm' : 'खेत जोड़ें'}</button>
           </div>

           {farmsLoading ? (
             <div className="skeleton h-32 w-full rounded-2xl" />
           ) : farms.length > 0 ? (
             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
               {farms.map(f => (
                 <div key={f.id} className="bg-white rounded-2xl shadow-sm flex flex-col gap-4 border border-gray-100 hover:shadow-md transition-shadow p-5">
                   <div className="flex justify-between items-start">
                     <div className="flex items-center gap-3">
                       <div className="w-12 h-12 bg-forest-50 text-forest-600 rounded-xl flex items-center justify-center shrink-0">
                         <MapPin className="w-6 h-6"/>
                       </div>
                       <div>
                         <h3 className="font-bold text-xl text-gray-900 leading-tight">{f.name}</h3>
                         <span className="text-sm text-gray-500 font-medium flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3"/> {formatLocationLine(f.district, f.state)}</span>
                       </div>
                     </div>
                     <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 text-xs shrink-0">
                       <button onClick={() => { setEditingFarm(f); setIsFarmFormOpen(true); }} className="flex items-center justify-center gap-1.5 text-gray-600 hover:text-forest-600 font-bold bg-white hover:bg-forest-50 px-3 py-2 rounded-xl transition-all border border-gray-200 hover:border-forest-200 w-full sm:w-auto shadow-sm">
                         <Edit2 className="w-3.5 h-3.5" /> Edit
                       </button>
                       <button onClick={() => f.id && handleDeleteFarm(f.id)} className="flex items-center justify-center gap-1.5 text-gray-600 hover:text-red-600 font-bold bg-white hover:bg-red-50 px-3 py-2 rounded-xl transition-all border border-gray-200 hover:border-red-200 w-full sm:w-auto shadow-sm">
                         <Trash2 className="w-3.5 h-3.5" /> Delete
                       </button>
                     </div>
                   </div>
                   
                   <div className="bg-gray-50/80 rounded-xl p-4 grid grid-cols-2 gap-y-4 gap-x-4 text-sm border border-gray-100">
                     <div className="col-span-2">
                       <p className="text-xs text-gray-500 font-medium mb-1.5">Primary Crops</p>
                       <div className="flex flex-wrap gap-1.5">
                         {f.crops?.length > 0 ? f.crops.map((c: string) => (
                           <span key={c} className="text-xs font-bold bg-white text-forest-700 border border-forest-100/60 px-2.5 py-1 rounded-md shadow-sm">{c}</span>
                         )) : (
                           <span className="text-xs font-bold bg-white text-forest-700 border border-forest-100/60 px-2.5 py-1 rounded-md shadow-sm">{(f as any).crop || 'Unknown'}</span>
                         )}
                       </div>
                     </div>
                     <div className="col-span-2">
                       <p className="text-xs text-gray-500 font-medium flex items-center justify-between">
                         <span>Date Added / Updated</span>
                         <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-100">{getDate(f.createdAt)}</span>
                       </p>
                     </div>
                     
                     <div className="bg-white p-3 rounded-lg border border-gray-100/50 shadow-sm flex flex-col gap-1">
                       <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">Season</p>
                       <p className="font-bold text-gray-900">{f.season || 'Kharif'}</p>
                     </div>
                     <div className="bg-white p-3 rounded-lg border border-gray-100/50 shadow-sm flex flex-col gap-1">
                       <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">Size</p>
                       <p className="font-bold text-gray-900">{f.area} Acres</p>
                     </div>
                     <div className="bg-white p-3 rounded-lg border border-gray-100/50 shadow-sm flex flex-col gap-1">
                       <p className="text-xs text-gray-500 font-medium">Soil Type</p>
                       <p className="font-bold text-gray-900">{f.soil}</p>
                     </div>
                     <div className="bg-white p-3 rounded-lg border border-gray-100/50 shadow-sm flex flex-col gap-1">
                       <p className="text-xs text-gray-500 font-medium">Irrigation</p>
                       <p className="font-bold text-gray-900">{f.irrigation}</p>
                     </div>
                     
                     {f.notes && (
                        <div className="col-span-2 pt-3 mt-1 border-t border-gray-200/60">
                          <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                          <p className="text-sm text-gray-700 italic bg-white p-3 rounded-lg border border-gray-100/50 leading-relaxed shadow-sm">{f.notes}</p>
                        </div>
                     )}
                   </div>
                 </div>
               ))}
             </div>
           ) : (
             <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
               <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-3" />
               <h3 className="text-lg font-bold text-gray-900 mb-1">{language === 'en' ? 'No farms added yet' : 'कोई खेत नहीं जोड़ा गया'}</h3>
               <p className="text-gray-500 mb-6">{language === 'en' ? 'Add your farm details to get personalized agricultural insights.' : 'व्यक्तिगत कृषि सलाह पाने के लिए अपने खेत का विवरण जोड़ें।'}</p>
               <button onClick={() => { setEditingFarm(null); setIsFarmFormOpen(true); }} className="btn-primary mx-auto">
                 {language === 'en' ? 'Add My Farm' : 'मेरा खेत जोड़ें'}
               </button>
             </div>
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

      {activeTab === 'rentals' && isBuyer && (
        <div className="space-y-4 animate-fade-in">
           {rentalsLoading ? (
               <div className="skeleton h-32 w-full rounded-2xl" />
           ) : rentals.length > 0 ? (
             rentals.map(rental => (
               <div key={rental.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
                 <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                   <div>
                     <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                       <Tractor className="w-5 h-5 text-orange-600" />
                       {rental.equipmentName}
                     </h3>
                     <p className="text-xs text-gray-500 flex items-center gap-1">
                       <Calendar className="w-3 h-3"/> booked on {new Date(rental.createdAt).toLocaleDateString()}
                     </p>
                   </div>
                   <span className={clsx(
                     "px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider", 
                     rental.status === 'active' ? 'bg-green-100 text-green-700' :
                     rental.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                     rental.status === 'returned' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-700'
                   )}>
                     {rental.status}
                   </span>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 text-sm bg-orange-50 border border-orange-100 p-4 rounded-xl">
                    <div>
                      <p className="text-xs text-orange-600/70 font-medium mb-1">Start Date</p>
                      <p className="font-bold text-orange-900">{new Date(rental.startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-orange-600/70 font-medium mb-1">Duration</p>
                      <p className="font-bold text-orange-900">{rental.durationDays} Days</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-orange-600/70 font-medium mb-1">Delivery Location</p>
                      <p className="font-bold text-orange-900">
                        {formatLocationLine(rental.district, rental.state) || rental.location || '—'}
                        {rental.villageOrLandmark ? ` · ${rental.villageOrLandmark}` : ''}
                      </p>
                    </div>
                 </div>
                 
                 <div className="flex justify-between items-center pt-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Contact Line</p>
                      <p className="font-bold text-gray-900 leading-none">{rental.contact}</p>
                    </div>
                    {rental.status === 'pending' && (
                       <button onClick={() => handleCancelRental(rental.id)} className="text-xs text-red-600 hover:text-red-700 font-bold border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg flex items-center gap-1 transition-colors">
                         <XCircle className="w-4 h-4"/> Cancel Rental
                       </button>
                    )}
                 </div>
               </div>
             ))
           ) : (
             <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
               <Tractor className="w-16 h-16 text-gray-200 mx-auto mb-4" />
               <p className="text-gray-500 text-lg font-medium">{language === 'en' ? 'No equipment rented yet.' : 'अभी तक कोई उपकरण किराए पर नहीं लिया गया।'}</p>
             </div>
           )}
        </div>
      )}

      {activeTab === 'history' && isFarmerOrSeller && (
        <div className="space-y-6 animate-fade-in">
          {historyLoading ? (
            <div className="skeleton h-32 w-full rounded-2xl" />
          ) : (
            <>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4">{language === 'en' ? 'Sales' : 'बिक्री'}</h3>
                {historySales.length === 0 ? (
                  <p className="text-sm text-gray-500">{language === 'en' ? 'No sales yet.' : 'अभी तक कोई बिक्री नहीं।'}</p>
                ) : (
                  <div className="space-y-3">
                    {historySales.map((l) => (
                      <div key={l.id} className="border border-gray-100 rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate">{l.crop}</p>
                            <p className="text-xs text-gray-500">{l.quantity} {l.unit}</p>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                            SOLD
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Amount</span>
                          <span className="font-bold text-gray-900">{formatRupee(Number(l.price) * Number(l.quantity || 1))}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {getDate(l.soldAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4">{language === 'en' ? 'Purchases' : 'खरीद'}</h3>
                {historyPurchases.length === 0 ? (
                  <p className="text-sm text-gray-500">{language === 'en' ? 'No purchases yet.' : 'अभी तक कोई खरीद नहीं।'}</p>
                ) : (
                  <div className="space-y-3">
                    {historyPurchases.map((o) => (
                      <div key={o.id} className="border border-gray-100 rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate">Order #{String(o.id).slice(-6).toUpperCase()}</p>
                            <p className="text-xs text-gray-500">{o.items?.length ? `${o.items.length} item(s)` : '—'}</p>
                          </div>
                          <span className={clsx(
                            "px-2.5 py-1 rounded-full text-xs font-bold",
                            o.status === 'Completed' ? 'bg-green-100 text-green-700' :
                            o.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          )}>
                            {o.status || 'Pending'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Amount</span>
                          <span className="font-bold text-gray-900">{formatRupee(o.total || 0)}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {getDate(o.createdAt)}
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

      <FarmFormModal 
        isOpen={isFarmFormOpen} 
        onClose={() => setIsFarmFormOpen(false)} 
        initialData={editingFarm}
        onSuccess={() => { setIsFarmFormOpen(false); fetchFarms(); }} 
      />
    </div>
  );
}
