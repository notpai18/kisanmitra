import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Package, X, Loader2, AlertTriangle } from 'lucide-react';
import { db, isMockConfig } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, runTransaction, increment } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

interface DeliveryConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: any;
  onSuccess: () => void;
}

const CROP_PLATFORM_COMMISSION_RATE = 0.03; // 3% platform fee on crop sale
const TRANSPORT_COMMISSION_RATE = 0.05; // 5% transport commission

export default function DeliveryConfirmModal({
  isOpen,
  onClose,
  listing,
  onSuccess
}: DeliveryConfirmModalProps) {
  const { user, userData } = useAuth();
  const { language } = useLanguage();
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!user || isMockConfig) {
      // Mock mode - just close
      onSuccess();
      return;
    }

    // Only allow confirmation if status is at_delivery
    if (listing.status !== 'at_delivery') {
      toast.error(
        language === 'hi'
          ? 'ट्रक पहुंचने का इंतज़ार करें'
          : 'Please wait for truck to arrive at delivery location'
      );
      return;
    }

    setSubmitting(true);

    try {
      console.log('[DeliveryConfirm] Starting transaction for listing:', listing.id);

      // Use Firestore transaction for atomic update of revenue
      await runTransaction(db, async (transaction) => {
        // Step A: Read the listing document to get fresh data
        const listingRef = doc(db, 'listings', listing.id);
        const listingDoc = await transaction.get(listingRef);

        if (!listingDoc.exists()) {
          console.error('[DeliveryConfirm] Listing not found:', listing.id);
          throw new Error('Listing not found');
        }

        const listingData = listingDoc.data();
        console.log('[DeliveryConfirm] Listing data:', listingData);

        // Extract and validate required fields
        const sellerId = listingData?.farmerId;
        const agentId = listingData?.agentId;
        const transporterId = listingData?.transporterId;
        const price = Number(listingData?.price) || 0;
        const quantity = Number(listingData?.quantity) || 0;
        const transportFee = Number(listingData?.transportFee) || 0;

        if (!sellerId) {
          console.error('[DeliveryConfirm] No sellerId found');
          throw new Error('Seller not found');
        }

        // Step B: Calculate payouts precisely
        const escrowAmount = price * quantity;
        const cropPlatformCommission = escrowAmount * CROP_PLATFORM_COMMISSION_RATE;
        const sellerPayout = escrowAmount - cropPlatformCommission;

        const transportPlatformCommission = transportFee * TRANSPORT_COMMISSION_RATE;
        const transporterPayout = transportFee - transportPlatformCommission;

        console.log('[DeliveryConfirm] Calculations:', {
          escrowAmount,
          cropPlatformCommission,
          sellerPayout,
          transportFee,
          transportPlatformCommission,
          transporterPayout,
        });

        // Step C: Execute the atomic batch write

        // 1. Update listing status to delivered
        transaction.update(listingRef, {
          status: 'delivered',
          deliveredAt: serverTimestamp(),
          escrowReleasedAt: serverTimestamp(),
          escrowAmount,
          cropPlatformCommission,
          sellerPayout,
          transportPlatformCommission,
          transporterPayout,
        });
        console.log('[DeliveryConfirm] Updated listing to delivered');

        // 2. Update seller's totalRevenue
        const sellerRef = doc(db, 'users', sellerId);
        transaction.update(sellerRef, {
          totalRevenue: increment(sellerPayout),
        });
        console.log('[DeliveryConfirm] Updated seller revenue:', sellerPayout);

        // 3. If there's an agent, increment their commissionRevenue
        if (agentId) {
          const agentRef = doc(db, 'users', agentId);
          transaction.update(agentRef, {
            commissionRevenue: increment(cropPlatformCommission),
          });
          console.log('[DeliveryConfirm] Updated agent commission:', cropPlatformCommission);
        }

        // 4. If there's a transporter, distribute transport revenue
        if (transporterId && transportFee > 0) {
          const transporterRef = doc(db, 'users', transporterId);
          transaction.update(transporterRef, {
            totalRevenue: increment(transporterPayout),
            completedTrips: increment(1),
          });
          console.log('[DeliveryConfirm] Updated transporter revenue:', transporterPayout, 'trips:', 1);

          // 5. Track platform's transport commission
          const platformRef = doc(db, 'users', 'platform');
          try {
            const platformDoc = await transaction.get(platformRef);
            if (platformDoc.exists()) {
              transaction.update(platformRef, {
                commissionRevenue: increment(transportPlatformCommission),
              });
            }
          } catch (e) {
            console.warn('[DeliveryConfirm] Platform doc update skipped:', e);
          }
          console.log('[DeliveryConfirm] Platform transport commission:', transportPlatformCommission);
        }

        console.log('[DeliveryConfirm] Transaction completed successfully');
      });

      toast.success(
        language === 'hi'
          ? 'डिलीवरी पुष्टि! पैसे सैलर और ट्रांसपोर्टर को रिलीज़ हुए।'
          : 'Delivery confirmed! Funds released to seller and transporter.'
      );
      onSuccess();
    } catch (e: any) {
      console.error('[DeliveryConfirm] Transaction failed:', e);
      toast.error(language === 'hi' ? 'त्रुटि हुई' : e?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  // Check if truck has arrived at delivery location
  const canConfirmDelivery = listing?.status === 'at_delivery';

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
            <div className="p-6 border-b border-gray-100 rounded-t-2xl">
              <div className="flex items-center justify-center mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                  className="w-20 h-20 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-2xl flex items-center justify-center shadow-lg"
                >
                  <Package className="w-10 h-10 text-white" />
                </motion.div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center">
                {language === 'hi' ? 'डिलीवरी की पुष्टि करें' : 'Confirm Delivery'}
              </h2>
              <p className="text-sm text-gray-500 text-center mt-2 font-devanagari">
                {listing.crop} - {listing.quantity} {listing.unit}
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Status-based messaging */}
              {canConfirmDelivery ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] rounded-xl p-5 text-center"
                >
                  <p className="text-[#065f46] font-bold text-lg">
                    {language === 'hi'
                      ? 'ट्रक पहुंच गया है?'
                      : 'Has the truck arrived?'}
                  </p>
                  <p className="text-sm text-[#065f46] mt-2 font-devanagari">
                    {language === 'hi'
                      ? 'डिलीवरी पुष्टि करने पर पैसे सैलर और ट्रांसपोर्टर को मिल जाएंगे।'
                      : 'Confirm to release funds to seller and transporter.'}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center"
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <p className="text-amber-800 font-bold">
                      {language === 'hi' ? 'ट्रक अभी नहीं पहुंचा' : 'Truck not yet arrived'}
                    </p>
                  </div>
                  <p className="text-sm text-amber-700 font-devanagari">
                    {language === 'hi'
                      ? 'ट्रक के डेस्टिनेशन पर पहुंचने का इंतज़ार करें।'
                      : 'Waiting for transporter to arrive at delivery location.'}
                  </p>
                </motion.div>
              )}

              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3.5 rounded-xl font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors min-h-[48px]"
                >
                  {language === 'hi' ? 'अभी नहीं' : 'Not Yet'}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting || !canConfirmDelivery}
                  whileHover={canConfirmDelivery ? { scale: 1.02 } : {}}
                  whileTap={canConfirmDelivery ? { scale: 0.97 } : {}}
                  className={`flex-1 px-6 py-3.5 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 min-h-[48px] ${
                    canConfirmDelivery
                      ? 'text-white bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857]'
                      : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {submitting ? (
                    language === 'hi' ? 'सबमिट हो रहा है...' : 'Processing...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      {language === 'hi' ? 'डिलीवरी पुष्टि करें' : 'Confirm Delivery'}
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}