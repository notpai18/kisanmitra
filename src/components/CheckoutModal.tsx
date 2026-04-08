import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { db, isMockConfig } from '../lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { NotificationService } from '../lib/NotificationService';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { user, userData } = useAuth();
  const { items: cartItems, total, clearCart } = useCart();
  const { language } = useLanguage();
  const [checkoutForm, setCheckoutForm] = useState({ address: '', payment: 'upi' });
  const [checkoutWorking, setCheckoutWorking] = useState(false);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || cartItems.length === 0 || isMockConfig) return;
    setCheckoutWorking(true);
    try {
      const orderRef = await addDoc(collection(db, 'orders'), {
        buyerId: user.uid,
        buyerName: userData?.name || 'Buyer',
        items: cartItems,
        total: total,
        status: 'Pending',
        address: checkoutForm.address,
        paymentMethod: 'cod',
        createdAt: serverTimestamp()
      });
       
      await NotificationService.sendNotification(user.uid, {
        title: language === 'hi' ? 'आदेश पक्का हुआ!' : 'Order Confirmed!',
        message: language === 'hi' 
          ? `आपका ₹${total} का आदेश सफलतापूर्वक दर्ज किया गया है।`
          : `Your order for ₹${total} has been successfully placed.`,
        type: 'order',
        relatedId: orderRef.id
      });

      toast.success(language === 'hi' ? 'आदेश सफलतापूर्वक रखा गया!' : 'Order placed successfully!');
      clearCart();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error(language === 'hi' ? 'त्रुटि हुई' : 'Checkout failed');
    } finally {
      setCheckoutWorking(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">{language === 'en' ? 'Checkout' : 'चेकआउट'}</h2>
              <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCheckout} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'en' ? 'Delivery Address' : 'डिलीवरी का पता'}</label>
                <textarea rows={3} required value={checkoutForm.address} onChange={(e) => setCheckoutForm({...checkoutForm, address: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-gray-200" placeholder="Street, Village, District..."></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'en' ? 'Payment Method' : 'भुगतान विधि'}</label>
                <div className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between">
                  <span className="font-medium text-gray-900">{language === 'en' ? 'Cash on Delivery (COD)' : 'कैश ऑन डिलीवरी (सीओडी)'}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 font-devanagari">
                  {language === 'en' 
                    ? '* Payment will be collected upon delivery.' 
                    : '* भुगतान डिलीवरी पर लिया जाएगा।'}
                </p>
              </div>
              <div className="pt-4 border-t border-gray-100 flex justify-between items-center mb-4 text-xl">
                <span className="font-medium text-gray-700">{language === 'en' ? 'Total' : 'कुल'}</span>
                <span className="font-bold text-[#1B4332]">₹{total}</span>
              </div>
              <button type="submit" disabled={checkoutWorking} className="w-full bg-[#1B4332] hover:bg-[#153326] disabled:bg-gray-400 text-white py-4 rounded-xl font-bold text-lg transition-colors">
                {checkoutWorking ? '...' : (language === 'en' ? 'Confirm Order' : 'आदेश पक्का करें')}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
