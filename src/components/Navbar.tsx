import React, { useState, useEffect } from 'react';
import { Bell, User as UserIcon, Globe, X, Menu, Stethoscope, LayoutDashboard, Sprout, Store, Landmark, TrendingUp, ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { auth, signOut, db, isMockConfig } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from '../lib/firebase';
import CheckoutModal from './CheckoutModal';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { NotificationService } from '../lib/NotificationService';
import { timeAgo, formatDate } from '../utils/formatDate';

export default function Navbar() {
  const { user, userData, setUserData } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { items: cartItems, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, clearCart, total } = useCart();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; read?: boolean; title?: string; message?: string; createdAt?: any }[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user || isMockConfig) return;

    setNotifLoading(true);
    setNotifError(null);
    const q = query(collection(db, `notifications/${user.uid}/items`), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotifications(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; read?: boolean; title?: string; message?: string; createdAt?: any })));
        setNotifLoading(false);
      },
      (err) => {
        console.error('Notifications listener error:', err);
        setNotifError('Could not load notifications.');
        setNotifLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleSignOut = () => {
    if (isMockConfig) {
      setUserData(null);
      navigate('/');
      return;
    }
    signOut(auth).catch((e) => console.error(e));
  };

  const markAllAsRead = async () => {
    if (isMockConfig || !user) return;
    try {
      const batchDocs = notifications.filter(n => !n.read);
      for (const n of batchDocs) {
        await updateDoc(doc(db, `notifications/${user.uid}/items/${n.id}`), { read: true });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'hi' : 'en');
  };

  const markAsRead = async (id: string) => {
    if (isMockConfig || !user) return;
    try {
      await updateDoc(doc(db, `notifications/${user.uid}/items/${id}`), { read: true });
    } catch (error) {
      console.error('Error marking notification as read', error);
    }
  };

  const avatarSrc = user?.photoURL || undefined;

  return (
    <>
      <nav className="sticky top-0 z-40 glass w-full px-4 sm:px-6 lg:px-8 min-h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[#1B4332] hover:bg-[#D1FAE5]"
            aria-label={t('nav_menu')}
            onClick={() => setShowMobileMenu(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to={userData ? '/dashboard' : '/'} className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#1B4332] flex items-center justify-center text-white font-bold text-xl shrink-0">K</div>
            <span className="text-[#1B4332] font-bold text-lg sm:text-xl tracking-tight truncate">KisanMitra</span>
          </Link>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1 min-w-[44px] min-h-[44px] px-2 text-[#6B7280] hover:text-[#1B4332] transition-colors rounded-full hover:bg-[#D1FAE5] font-bold text-sm"
          >
            <Globe className="w-4 h-4" />
            <span>{language === 'en' ? 'EN' : 'HI'}</span>
          </button>
          
          {userData && (
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#6B7280] hover:text-[#1B4332] transition-colors rounded-full hover:bg-[#D1FAE5] relative"
              aria-label="Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItems.length > 0 && (
                <span className="absolute top-1 right-1 min-w-[20px] h-5 bg-[#1B4332] text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                  {cartItems.length}
                </span>
              )}
            </button>
          )}

          {userData && (
            <>
              <button
                type="button"
                onClick={() => setShowNotifications(true)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#6B7280] hover:text-[#1B4332] transition-colors rounded-full hover:bg-[#D1FAE5] relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#EF4444] border-2 border-white rounded-full" />
                )}
              </button>
              <div className="relative group">
                <button
                  type="button"
                  className="flex items-center gap-2 p-1 pr-2 sm:pr-3 rounded-full border border-gray-200 hover:border-[#1B4332] transition-colors bg-white min-h-[44px]"
                  aria-haspopup="true"
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="w-9 h-9 rounded-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#1B4332]">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-[#111827] hidden sm:block max-w-[100px] truncate">{userData.name.split(' ')[0]}</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <Link to="/profile" className="block w-full text-left px-4 py-3 text-sm text-[#111827] hover:bg-[#F9FAFB] rounded-t-2xl">
                    {t('nav_profile')}
                  </Link>
                  <button type="button" onClick={handleSignOut} className="w-full text-left px-4 py-3 text-sm text-[#EF4444] hover:bg-red-50 rounded-b-2xl">
                    {t('sign_out')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </nav>

      <AnimatePresence>
        {showMobileMenu && userData && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-50 md:hidden"
              onClick={() => setShowMobileMenu(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed top-0 left-0 bottom-0 w-[min(100%,280px)] bg-white shadow-xl z-[60] md:hidden flex flex-col pt-16 px-4 pb-8"
            >
              <button
                type="button"
                className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100"
                onClick={() => setShowMobileMenu(false)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <nav className="flex flex-col gap-2 font-devanagari">
                {[
                  { to: '/dashboard', icon: LayoutDashboard, label: t('nav_dashboard'), roles: ['farmer', 'buyer'] },
                  { to: '/advisory', icon: Sprout, label: t('nav_advisory'), roles: ['farmer'] },
                  { to: '/crop-doctor', icon: Stethoscope, label: t('nav_crop_doctor'), roles: ['farmer'] },
                  { to: '/market', icon: Store, label: t('nav_market'), roles: ['farmer', 'buyer'] },
                  { to: '/insights', icon: TrendingUp, label: t('nav_insights'), roles: ['buyer'] },
                  { to: '/schemes', icon: Landmark, label: t('nav_schemes'), roles: ['farmer'] },
                  { to: '/profile', icon: UserIcon, label: t('nav_profile'), roles: ['farmer', 'buyer'] },
                ]
                  .filter(item => item.roles.includes(userData?.role || 'farmer'))
                  .map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-[#D1FAE5] text-[#111827] min-h-[44px]"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      <item.icon className="w-5 h-5 text-[#1B4332]" />
                      {item.label}
                    </Link>
                  ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-[#F9FAFB]">
                <h2 className="font-bold text-[#111827] flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#1B4332]" /> {t('notifications')}
                </h2>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button type="button" onClick={markAllAsRead} className="text-sm text-[#1B4332] font-semibold hover:underline">
                      {language === 'en' ? 'Mark all as read' : 'सभी को पढ़ा हुआ मानें'}
                    </button>
                  )}
                  <button type="button" onClick={() => setShowNotifications(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-200 rounded-full text-[#6B7280]">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {notifLoading && notifications.length === 0 ? (
                  <div className="space-y-3">
                    <div className="skeleton h-20 w-full" />
                    <div className="skeleton h-20 w-full" />
                  </div>
                ) : notifError ? (
                  <div className="text-center py-8 text-[#EF4444] text-sm">{notifError}</div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-12 text-[#6B7280]">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>{t('no_notifications')}</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markAsRead(notif.id)}
                      className={clsx(
                        'p-4 rounded-2xl border transition-colors cursor-pointer shadow-[0_4px_24px_rgba(0,0,0,0.06)]',
                        notif.read ? 'bg-white border-gray-100 opacity-70' : 'bg-[#D1FAE5]/40 border-[#1B4332]/10'
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-[#111827] text-sm">{notif.title}</h3>
                        {!notif.read && <span className="w-2 h-2 bg-[#1B4332] rounded-full mt-1.5 shrink-0" />}
                      </div>
                      <p className="text-sm text-[#6B7280]">{notif.message}</p>
                      {notif.createdAt && (
                        <span
                          className="text-xs text-[#6B7280] mt-2 block cursor-help"
                          title={formatDate(notif.createdAt, { showTime: true })}
                        >
                          {timeAgo(notif.createdAt)}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-[#F9FAFB]">
                <h2 className="font-bold text-[#111827] flex items-center gap-2 text-lg">
                  <ShoppingCart className="w-5 h-5 text-[#1B4332]" /> {language === 'en' ? 'Your Cart' : 'आपकी कार्ट'}
                </h2>
                <button type="button" onClick={() => setIsCartOpen(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-200 rounded-full text-[#6B7280]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!userData ? (
                  <div className="text-center py-12 text-[#6B7280]">
                    <UserIcon className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                    <p className="text-lg">{language === 'en' ? 'Please log in to view your cart' : 'कृपया अपनी कार्ट देखने के लिए लॉग इन करें'}</p>
                    <button type="button" onClick={() => { setIsCartOpen(false); navigate('/'); }} className="btn-primary mt-6">
                      {language === 'en' ? 'Login' : 'लॉग इन करें'}
                    </button>
                  </div>
                ) : cartItems.length === 0 ? (
                  <div className="text-center py-12 text-[#6B7280]">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                    <p className="text-lg">{language === 'en' ? 'Your cart is empty' : 'आपकी कार्ट खाली है'}</p>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm">
                      <div className="flex-1">
                        <h3 className="font-bold text-[#111827] text-lg mb-1">{item.name}</h3>
                        <div className="text-[#1B4332] font-bold">₹{item.price}</div>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-gray-200">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 hover:bg-white rounded-md text-gray-600">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-bold w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:bg-white rounded-md text-gray-600">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {cartItems.length > 0 && (
                <div className="p-6 border-t border-gray-100 bg-[#F9FAFB]">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-600 font-medium">{language === 'en' ? 'Total' : 'कुल'}</span>
                    <span className="text-2xl font-bold text-[#111827]">₹{total}</span>
                  </div>
                  <button onClick={() => { setIsCartOpen(false); setShowCheckoutModal(true); }} className="w-full bg-[#1B4332] hover:bg-[#153326] text-white py-4 rounded-xl font-bold text-lg transition-colors shadow-lg shadow-[#1B4332]/20">
                    {language === 'en' ? 'Checkout' : 'चेकआउट करें'}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CheckoutModal isOpen={showCheckoutModal} onClose={() => setShowCheckoutModal(false)} />
    </>
  );
}
