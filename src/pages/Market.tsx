import React, { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, doc, isMockConfig } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  limit,
  startAfter,
  getDocs,
  serverTimestamp,
  increment,
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import {
  Store,
  Plus,
  TrendingUp,
  TrendingDown,
  MapPin,
  Calendar,
  IndianRupee,
  Scale,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  X,
  Share2,
  Star,
  Shield,
  Truck,
  Phone,
  Sprout,
  PackageX,
  Search,
  Clock3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { formatRupee, formatDateHi } from '../lib/formatters';
import { UI } from '../constants/translations';
import { NotificationService } from '../lib/NotificationService';
import { useCart } from '../contexts/CartContext';
import { formatDate } from '../utils/formatDate';
import LocationSelector from '../components/LocationSelector';
import { formatLocationLine } from '../utils/formatLocation';
import { UP_DISTRICTS, UP_ONLY_STATE } from '../data/upDistricts';
import MandiTicker from '../components/MandiTicker';
import TransportModal from '../components/TransportModal';
import LogisticsFormModal from '../components/LogisticsFormModal';
import DeliveryConfirmModal from '../components/DeliveryConfirmModal';

interface Listing {
  id: string;
  farmerId: string;
  farmerName: string;
  crop: string;
  quantity: number;
  unit: string;
  grade: string;
  price: number;
  harvestDate: string;
  state?: string;
  district: string;
  description: string;
  imageUrl?: string;
  isBidding: boolean;
  status: 'active' | 'sold' | 'archived' | 'awaiting_logistics' | 'in_transit' | 'at_pickup' | 'heading_to_delivery' | 'at_delivery' | 'delivered';
  transportType?: 'buyer_pickup' | 'agent_transport';
  transportDetails?: {
    vehicleNumber: string;
    driverPhone: string;
    dispatchedAt: any;
  };
  createdAt: any;
  highestBid?: number;
  bidCount?: number;
  isForwardContract?: boolean;
  estimatedHarvest?: string;
  aiHealthScore?: number;
}

interface Bid {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  crop?: string;
  amount: number;
  quantity: number;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'archived';
  createdAt: string;
  farmerId?: string;
}

const CROP_TYPES = ['Wheat', 'Rice', 'Tomato', 'Potato', 'Sugarcane', 'Maize', 'Other'];

const MOCK_MANDI_PRICES = [
  { crop: { en: 'Wheat', hi: 'गेहूं' }, price: 2100, change: 2.5, trend: 'up' as const },
  { crop: { en: 'Rice', hi: 'धान' }, price: 1950, change: -1.2, trend: 'down' as const },
  { crop: { en: 'Potato', hi: 'आलू' }, price: 800, change: 5.0, trend: 'up' as const },
  { crop: { en: 'Tomato', hi: 'टमाटर' }, price: 1200, change: 10.5, trend: 'up' as const },
  { crop: { en: 'Sugarcane', hi: 'गन्ना' }, price: 350, change: 0, trend: 'flat' as const },
  { crop: { en: 'Maize', hi: 'मक्का' }, price: 1750, change: -0.5, trend: 'down' as const },
];

const PAGE_SIZE = 10;

// Framer Motion container variant for staggered animations
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } },
};

// Skeleton component for shimmer loading
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2">
          <div className="h-6 w-24 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-8 w-16 bg-gray-200 rounded-full animate-pulse" />
      </div>
      <div className="space-y-3 mb-4">
        <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="h-12 w-full bg-gray-100 rounded-xl animate-pulse" />
    </div>
  );
}

// Premium Empty State Component
function PremiumEmptyState({ onAddListing }: { onAddListing?: () => void }) {
  const { language } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div className="w-24 h-24 bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] rounded-full flex items-center justify-center mb-6">
        <PackageX className="w-12 h-12 text-[#065f46]" />
      </div>
      <h3 className="text-xl font-bold text-[#111827] mb-2 font-devanagari">
        {language === 'hi' ? 'कोई लिस्टिंग नहीं मिली' : 'No Listings Found'}
      </h3>
      <p className="text-[#6B7280] text-center max-w-sm mb-6 font-devanagari">
        {language === 'hi'
          ? 'अभी कोई फसल बिक्री के लिए उपलब्ध नहीं है। आप नई लिस्टिंग जोड़ सकते हैं।'
          : 'No crops are currently available for sale. You can add a new listing to get started.'}
      </p>
      {onAddListing && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onAddListing}
          className="px-6 py-3 bg-[#1B4332] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {language === 'hi' ? 'नई लिस्टिंग जोड़ें' : 'Add New Listing'}
        </motion.button>
      )}
    </motion.div>
  );
}

// Premium Filter Empty State
function NoResultsState() {
  const { language } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      <Search className="w-10 h-10 text-gray-300 mb-4" />
      <p className="text-[#6B7280] font-devanagari">
        {language === 'hi' ? 'आपके फ़िल्टर से मेल खाने वाली कोई लिस्टिंग नहीं मिली।' : 'No listings match your filters.'}
      </p>
    </motion.div>
  );
}

function InTransitCard({ listing, onConfirmDelivery, isBuyer }: { listing: Listing; onConfirmDelivery?: () => void; isBuyer?: boolean }) {
  const { language } = useLanguage();
  const transportDetails = listing.transportDetails;
  const status = listing.status;

  // Get status-specific message for farmer (seller)
  const getFarmerAlert = () => {
    switch (status) {
      case 'in_transit':
        return {
          icon: Truck,
          message: language === 'hi'
            ? 'ट्रांसपोर्टर ने लोड स्वीकार किया'
            : 'Transporter assigned to your load',
          color: 'text-blue-700',
          bg: 'bg-blue-50',
        };
      case 'at_pickup':
        return {
          icon: MapPin,
          message: language === 'hi'
            ? 'ट्रक आपके खेत पर पहुंच गया है!'
            : 'Truck arrived at your farm for pickup!',
          color: 'text-amber-700',
          bg: 'bg-amber-50',
        };
      case 'heading_to_delivery':
        return {
          icon: Truck,
          message: language === 'hi'
            ? 'ट्रक रास्ते में है - खरीदार की ओर जा रहा है'
            : 'Truck on the way to buyer',
          color: 'text-purple-700',
          bg: 'bg-purple-50',
        };
      case 'at_delivery':
        return {
          icon: CheckCircle2,
          message: language === 'hi'
            ? 'ट्रक खरीदार के गेट पर पहुंच गया है'
            : 'Truck arrived at buyer location',
          color: 'text-green-700',
          bg: 'bg-green-50',
        };
      default:
        return {
          icon: Truck,
          message: language === 'hi' ? 'रास्ते में' : 'In transit',
          color: 'text-gray-700',
          bg: 'bg-gray-50',
        };
    }
  };

  // Get status-specific message for buyer
  const getBuyerAlert = () => {
    switch (status) {
      case 'in_transit':
        return {
          icon: Truck,
          message: language === 'hi'
            ? 'ट्रक रवाना हो गया है'
            : 'Truck has departed',
          color: 'text-blue-700',
          bg: 'bg-blue-50',
        };
      case 'at_pickup':
        return {
          icon: Package,
          message: language === 'hi'
            ? 'ट्रक खेत पर है - लोड हो रहा है'
            : 'Truck at farm - loading in progress',
          color: 'text-amber-700',
          bg: 'bg-amber-50',
        };
      case 'heading_to_delivery':
        return {
          icon: Truck,
          message: language === 'hi'
            ? 'आपकी ओर आ रहा है'
            : 'Truck heading your way',
          color: 'text-purple-700',
          bg: 'bg-purple-50',
        };
      case 'at_delivery':
        return {
          icon: MapPin,
          message: language === 'hi'
            ? 'ट्रक आपके गेट पर पहुंच गया है!'
            : 'Truck arrived at your destination!',
          color: 'text-green-700',
          bg: 'bg-green-50',
        };
      default:
        return {
          icon: Truck,
          message: language === 'hi' ? 'रास्ते में' : 'In transit',
          color: 'text-gray-700',
          bg: 'bg-gray-50',
        };
    }
  };

  const alertInfo = isBuyer ? getBuyerAlert() : getFarmerAlert();
  const AlertIcon = alertInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 shadow-lg border ${alertInfo.bg}`}
    >
      {/* Status Alert */}
      <div className={`flex items-center gap-2 mb-3 ${alertInfo.color}`}>
        <AlertIcon className="w-5 h-5" />
        <span className="font-bold">{alertInfo.message}</span>
      </div>

      {/* Transport Details (for non-platform transport) */}
      {transportDetails && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#374151]">{language === 'hi' ? 'ट्रक नंबर:' : 'Vehicle:'}</span>
            <span className="font-mono font-bold text-[#111827] bg-white/60 px-2 py-1 rounded">
              {transportDetails.vehicleNumber}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#374151]">{language === 'hi' ? 'ड्राइवर:' : 'Driver:'}</span>
            <a
              href={`tel:${transportDetails.driverPhone}`}
              className="flex items-center gap-1 font-bold text-[#1B4332] hover:underline"
            >
              <Phone className="w-3 h-3" />
              {transportDetails.driverPhone}
            </a>
          </div>
        </div>
      )}

      {/* Platform Transport Info */}
      {listing.requiresPlatformTransport && listing.transporterId && (
        <div className="text-sm text-gray-600 mt-2">
          {language === 'hi' ? 'प्लेटफॉर्म ट्रांसपोर्ट' : 'Platform Transport'}
        </div>
      )}

      {/* Delivery Confirmation Button - Only when at_delivery */}
      {isBuyer && onConfirmDelivery && status === 'at_delivery' && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onConfirmDelivery}
          className="w-full mt-3 py-2.5 rounded-xl font-bold text-white bg-[#1B4332] shadow-md flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {language === 'hi' ? 'डिलीवरी पुष्टि करें' : 'Confirm Delivery'}
        </motion.button>
      )}

      {/* Waiting message for buyers not yet at delivery */}
      {isBuyer && onConfirmDelivery && status !== 'at_delivery' && (
        <div className="mt-3 py-2 px-3 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium text-center">
          {language === 'hi'
            ? 'ट्रक पहुंचने पर बटन सक्षम होगा'
            : 'Button will be enabled when truck arrives'}
        </div>
      )}
    </motion.div>
  );
}

function buildWhatsappUrl(listing: Listing): string {
  const loc = formatLocationLine(listing.district, listing.state);
  const shareText = `🌾 ${listing.crop} बिक्री के लिए उपलब्ध\nमात्रा: ${listing.quantity} ${listing.unit}\nकीमत: ${formatRupee(listing.price)}/${listing.unit}\nस्थान: ${loc}\nKisanMitra पर देखें`;
  return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
}

type ListingCardProps = {
  listing: Listing;
  isFarmer: boolean;
  onPlaceBid: (l: Listing) => void;
  onArchiveListing?: (id: string) => void;
  hasBid?: boolean;
};

const ListingCard = memo(function ListingCard({ listing, isFarmer, onPlaceBid, onArchiveListing, hasBid }: ListingCardProps) {
  const { items, addToCart, removeFromCart, updateQuantity } = useCart();
  const { language } = useLanguage();

  const share = () => {
    window.open(buildWhatsappUrl(listing), '_blank', 'noopener,noreferrer');
  };

  // Status badge with premium styling
  const getStatusBadge = () => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: 'bg-[#D1FAE5]', text: 'text-[#065f46]', label: language === 'hi' ? 'सक्रिय' : 'Active' },
      sold: { bg: 'bg-purple-100', text: 'text-purple-700', label: language === 'hi' ? 'बिक गया' : 'Sold' },
      awaiting_logistics: { bg: 'bg-blue-100', text: 'text-blue-700', label: language === 'hi' ? 'लॉजिस्टिक्स का इंतज़ार' : 'Awaiting Logistics' },
      in_transit: { bg: 'bg-blue-100', text: 'text-blue-700', label: language === 'hi' ? 'रास्ते में' : 'En Route' },
      at_pickup: { bg: 'bg-amber-100', text: 'text-amber-700', label: language === 'hi' ? 'पिकअप पर' : 'At Pickup' },
      heading_to_delivery: { bg: 'bg-purple-100', text: 'text-purple-700', label: language === 'hi' ? 'डिलीवरी की ओर' : 'Heading to Delivery' },
      at_delivery: { bg: 'bg-green-100', text: 'text-green-700', label: language === 'hi' ? 'डिलीवरी पर' : 'At Delivery' },
      delivered: { bg: 'bg-[#D1FAE5]', text: 'text-[#065f46]', label: language === 'hi' ? 'डिलीवर' : 'Delivered' },
    };
    const config = statusConfig[listing.status] || statusConfig.active;
    return (
      <span className={clsx('px-3 py-1.5 rounded-full text-xs font-bold', config.bg, config.text)}>
        {config.label}
      </span>
    );
  };

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 overflow-hidden flex flex-col w-full shadow-sm hover:shadow-lg"
    >
      <div className="flex justify-between items-start gap-2 mb-4">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-[#111827]">{listing.crop}</h3>
          <p className="text-sm text-[#6B7280] flex items-center gap-1 mt-1 font-devanagari">
            <MapPin className="w-4 h-4 shrink-0" /> {formatLocationLine(listing.district, listing.state)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={listing.status}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              {getStatusBadge()}
            </motion.div>
          </AnimatePresence>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={share}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border border-[#1B4332]/20 text-[#1B4332] hover:bg-[#D1FAE5] transition-colors"
            aria-label="Share on WhatsApp"
          >
            <Share2 className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-sm gap-2">
          <span className="text-[#6B7280] flex items-center gap-1">
            <Scale className="w-4 h-4 shrink-0" /> {language === 'hi' ? 'मात्रा' : 'Quantity'}
          </span>
          <span className="font-semibold text-[#111827] font-devanagari">
            {listing.quantity} {listing.unit}
          </span>
        </div>
        <div className="flex justify-between text-sm gap-2">
          <span className="text-[#6B7280] flex items-center gap-1">
            <IndianRupee className="w-4 h-4 shrink-0" /> {language === 'hi' ? 'कीमत' : 'Price'}
          </span>
          <span className="font-bold text-lg text-[#1B4332]">
            {formatRupee(listing.price)}/{listing.unit}
          </span>
        </div>
        <div className="flex justify-between text-sm gap-2">
          <span className="text-[#6B7280] flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {language === 'hi' ? 'गुणवत्ता' : 'Quality'}
          </span>
          <span
            className={clsx(
              'font-bold px-2.5 py-1 rounded-lg text-xs',
              listing.grade === 'A' ? 'bg-[#D1FAE5] text-[#065f46]' : listing.grade === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
            )}
          >
            {language === 'hi' ? 'ग्रेड' : 'Grade'} {listing.grade}
          </span>
        </div>
      </div>

      {listing.isBidding && listing.highestBid != null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[#FEF3C7] to-[#FDE68A] text-[#92400e] p-3 rounded-xl text-sm flex justify-between items-center mb-3"
        >
          <span className="font-semibold">{language === 'hi' ? 'उच्चतम बोली:' : 'Highest Bid:'}</span>
          <span className="font-bold text-lg">
            {formatRupee(listing.highestBid)}/{listing.unit}
          </span>
        </motion.div>
      )}

      {!isFarmer && listing.status === 'active' && (
        <div className="mt-auto pt-3 border-t border-gray-100 h-16 flex items-center justify-center">
          {listing.isBidding ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => onPlaceBid(listing)}
              className={clsx("w-full h-full justify-center text-sm py-3 rounded-xl font-bold transition-all", hasBid ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "bg-[#1B4332] text-white hover:bg-[#153326]")}
            >
              {hasBid ? (language === 'hi' ? 'फिर से बोली लगाएं' : 'Bid Again') : (language === 'hi' ? 'बोली लगाएं' : 'Place Bid')}
            </motion.button>
          ) : (
            (() => {
              const cartItem = items.find((item) => item.id === listing.id);
              const count = cartItem ? cartItem.quantity : 0;

              if (count > 0) {
                return (
                  <div className="flex items-center justify-between bg-[#D1FAE5] border border-[#A7F3D0] rounded-xl px-4 py-2 w-full h-full">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => count === 1 ? removeFromCart(listing.id) : updateQuantity(listing.id, count - 1)}
                      className="text-[#065f46] font-bold p-1 w-8 hover:bg-[#A7F3D0] rounded flex items-center justify-center transition-colors"
                    >
                      −
                    </motion.button>
                    <span className="font-bold text-[#065f46] text-center text-lg">{count}</span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateQuantity(listing.id, count + 1)}
                      className="text-[#065f46] font-bold p-1 w-8 hover:bg-[#A7F3D0] rounded flex items-center justify-center transition-colors"
                    >
                      +
                    </motion.button>
                  </div>
                );
              }

              return (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => {
                    addToCart({
                      id: listing.id,
                      name: listing.crop,
                      price: listing.price,
                      category: 'Market'
                    });
                    toast.success(language === 'hi' ? 'कार्ट में जोड़ा गया' : 'Added to Cart');
                  }}
                  className="bg-[#1B4332] hover:bg-[#153326] text-white w-full h-full justify-center text-sm py-3 rounded-xl font-bold transition-colors"
                >
                  {language === 'hi' ? 'अभी खरीदें' : 'Buy Now'}
                </motion.button>
              );
            })()
          )}
        </div>
      )}

      {isFarmer && (listing.status === 'sold' || listing.status === 'active') && (
         <div className="mt-auto pt-3 border-t border-gray-100">
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => {
              if (window.confirm(language === 'hi' ? 'क्या आप वाकई इस लिस्टिंग को संग्रहित करना चाहते हैं?' : 'Are you sure you want to archive this listing?')) {
                onArchiveListing?.(listing.id);
              }
            }}
            className="w-full text-center text-sm font-semibold text-gray-400 py-3 hover:text-red-500 transition-colors"
          >
            {listing.status === 'sold' ? (language === 'hi' ? 'पूर्ण लिस्टिंग हटाएं' : 'Clear Completed') : (language === 'hi' ? 'लिस्टिंग संग्रहित करें' : 'Archive Listing')}
          </motion.button>
         </div>
      )}
    </motion.div>
  );
});

const ForwardContractCard = memo(function ForwardContractCard({ listing, isFarmer, onPlaceBid, hasBid }: { listing: Listing; isFarmer: boolean; onPlaceBid: (l: Listing) => void; hasBid?: boolean }) {
  const { items, addToCart, removeFromCart, updateQuantity } = useCart();
  const { language } = useLanguage();

  const getHealthStatus = () => {
    const score = listing.aiHealthScore || 85;
    if (score >= 80) return { label: language === 'hi' ? 'स्वस्थ' : 'Healthy', color: 'text-emerald-600', bg: 'bg-emerald-100' };
    if (score >= 60) return { label: language === 'hi' ? 'ठीक है' : 'Fair', color: 'text-amber-600', bg: 'bg-amber-100' };
    return { label: language === 'hi' ? 'जोखिम' : 'At Risk', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const healthStatus = getHealthStatus();

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
      transition={{ duration: 0.2 }}
      className="bg-gradient-to-br from-fuchsia-50 to-purple-50 rounded-2xl border border-fuchsia-200 p-4 md:p-6 overflow-hidden flex flex-col w-full shadow-sm hover:shadow-lg"
    >
      <div className="flex justify-between items-start gap-2 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold text-[#111827]">{listing.crop}</h3>
            <span className="px-2.5 py-1 bg-fuchsia-100 text-fuchsia-700 text-xs font-bold rounded-full">
              {language === 'hi' ? 'प्री-हार्वेस्ट लॉक-इन' : 'Pre-Harvest Lock-in'}
            </span>
          </div>
          <p className="text-sm text-[#6B7280] flex items-center gap-1 mt-1 font-devanagari">
            <MapPin className="w-4 h-4 shrink-0" /> {formatLocationLine(listing.district, listing.state)}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-fuchsia-100 text-fuchsia-700">
          {language === 'hi' ? 'फॉरवर्ड' : 'Forward'}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-sm gap-2">
          <span className="text-[#6B7280] flex items-center gap-1">
            <Scale className="w-4 h-4 shrink-0" /> {language === 'hi' ? 'मात्रा' : 'Quantity'}
          </span>
          <span className="font-semibold text-[#111827] font-devanagari">
            {listing.quantity} {listing.unit}
          </span>
        </div>
        <div className="flex justify-between text-sm gap-2">
          <span className="text-[#6B7280] flex items-center gap-1">
            <IndianRupee className="w-4 h-4 shrink-0" /> {language === 'hi' ? 'लॉक-इन कीमत' : 'Locked Price'}
          </span>
          <span className="font-bold text-lg text-[#7C3AED]">
            {formatRupee(listing.price)}/{listing.unit}
          </span>
        </div>
        <div className="flex justify-between text-sm gap-2">
          <span className="text-[#6B7280] flex items-center gap-1">
            <Calendar className="w-4 h-4 shrink-0" /> {language === 'hi' ? 'अनुमानित कटाई' : 'Est. Harvest'}
          </span>
          <span className="font-semibold text-[#111827] font-devanagari">
            {listing.estimatedHarvest ? new Date(listing.estimatedHarvest).toLocaleDateString('hi-IN') : listing.harvestDate}
          </span>
        </div>
        <div className="flex justify-between text-sm gap-2">
          <span className="text-[#6B7280] flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {language === 'hi' ? 'AI स्वास्थ्य' : 'AI Health'}
          </span>
          <span className={clsx('font-bold px-2.5 py-1 rounded-lg text-xs', healthStatus.bg, healthStatus.color)}>
            {listing.aiHealthScore || 92}% - {healthStatus.label}
          </span>
        </div>
      </div>

      {!isFarmer && listing.status === 'active' && (
        <div className="mt-auto pt-3 border-t border-fuchsia-200 h-16 flex items-center justify-center">
          {(listing.isBidding || true) && (
            (() => {
              const cartItem = items.find((item) => item.id === listing.id);
              const count = cartItem ? cartItem.quantity : 0;

              if (count > 0) {
                return (
                  <div className="flex items-center justify-between bg-fuchsia-100 border border-fuchsia-200 rounded-xl px-4 py-2 w-full h-full">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => count === 1 ? removeFromCart(listing.id) : updateQuantity(listing.id, count - 1)}
                      className="text-fuchsia-700 font-bold p-1 w-8 hover:bg-fuchsia-200 rounded flex items-center justify-center transition-colors"
                    >
                      −
                    </motion.button>
                    <span className="font-bold text-fuchsia-700 text-center text-lg">{count}</span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateQuantity(listing.id, count + 1)}
                      className="text-fuchsia-700 font-bold p-1 w-8 hover:bg-fuchsia-200 rounded flex items-center justify-center transition-colors"
                    >
                      +
                    </motion.button>
                  </div>
                );
              }

              return (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => {
                    addToCart({
                      id: listing.id,
                      name: listing.crop,
                      price: listing.price,
                      category: 'Market'
                    });
                    toast.success(language === 'hi' ? 'कार्ट में जोड़ा गया' : 'Added to Cart');
                  }}
                  className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:from-[#6D28D9] hover:to-[#9333EA] text-white w-full h-full justify-center text-sm py-3 rounded-xl font-bold transition-colors"
                >
                  {language === 'hi' ? 'अनुबंध बुक करें' : 'Book Contract'}
                </motion.button>
              );
            })()
          )}
        </div>
      )}
    </motion.div>
  );
});

function RatingWidget({ bid, listing }: { bid: Bid, listing: Listing }) {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleRate = async (stars: number) => {
    if (isMockConfig) {
      setRating(stars);
      setSubmitted(true);
      toast.success('Thank you for rating!');
      return;
    }
    try {
      await addDoc(collection(db, 'ratings'), {
        bidId: bid.id,
        listingId: listing.id,
        farmerId: listing.farmerId,
        buyerId: bid.buyerId,
        stars,
        createdAt: serverTimestamp()
      });
      setRating(stars);
      setSubmitted(true);
      toast.success('Thank you for rating!');
    } catch(e) {
      console.error(e);
      toast.error('Could not submit rating');
    }
  };

  if (submitted) {
    return <span className="text-xs text-[#F59E0B] font-bold flex items-center gap-1"><Star className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" /> Rated {rating}</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500 mr-2">Rate:</span>
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} onClick={() => handleRate(star)} className="text-gray-300 hover:text-[#F59E0B] transition-colors">
          <Star className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}

const useMarketFilters = (listings: Listing[], initialDistrict: string = "") => {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState(initialDistrict);
  const [grade, setGrade] = useState("");
  const [priceRange, setPriceRange] = useState([0, 20000]);
  const [sortBy, setSortBy] = useState("newest");
  
  const filtered = useMemo(() => {
    return listings
      .filter(l => 
        l.crop.toLowerCase()
          .includes(search.toLowerCase()))
      .filter(l => !state || l.state === state)
      .filter(l => !district || l.district === district)
      .filter(l => !grade || l.grade === grade)
      .filter(l => 
        l.price >= priceRange[0] && 
        l.price <= priceRange[1])
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0);
        const bTime = b.createdAt?.toMillis?.() || (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0);

        if (sortBy === "newest") {
           // Handle serverTimestamp which might be a FieldValue or null initially
           const aVal = a.createdAt?.toMillis?.() || (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : Date.now());
           const bVal = b.createdAt?.toMillis?.() || (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : Date.now());
           return bVal - aVal;
        }
        if (sortBy === "price_asc") 
          return a.price - b.price;
        if (sortBy === "price_desc") 
          return b.price - a.price;
        if (sortBy === "most_bids") 
          return (b.bidCount || 0) - (a.bidCount || 0);
        return 0;
      });
  }, [listings, search, state, district, grade, priceRange, sortBy]);
  
  return { 
    filtered, search, setSearch, state, setState,
    district, setDistrict,
    grade, setGrade, priceRange, setPriceRange,
    sortBy, setSortBy 
  };
};

export default function Market() {
  const { user, userData, currentFarmerId } = useAuth();
  const isVillageAgent = userData?.role === 'village_agent';
  const { t, language } = useLanguage();
  const isFarmerOrSeller = userData?.role === 'farmer' || userData?.role === 'seller' || userData?.role === 'village_agent';

  // For village agent: use currentFarmerId if selected, else use agent's own ID
  const effectiveFarmerId = user ? (isVillageAgent ? (currentFarmerId || user.uid) : user.uid) : '';

  const [activeTab, setActiveTab] = useState<'market' | 'my_listings' | 'bids'>('market');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState<Listing | null>(null);
  const [showTransportModal, setShowTransportModal] = useState<Listing | null>(null);
  const [showLogisticsFormModal, setShowLogisticsFormModal] = useState<Listing | null>(null);
  const [showDeliveryConfirmModal, setShowDeliveryConfirmModal] = useState<Listing | null>(null);
  const [showForwardContracts, setShowForwardContracts] = useState(false);

  const [listings, setListings] = useState<Listing[]>([]);
  const { 
    filtered, search, setSearch, state, setState, 
    district: filterDistrict, setDistrict: setFilterDistrict, 
    grade, setGrade, priceRange, setPriceRange, 
    sortBy, setSortBy 
  } = useMarketFilters(listings);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const lastVisibleRef = useRef<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [bids, setBids] = useState<Bid[]>([]);
  const [bidsLoading, setBidsLoading] = useState(true);
  const [bidsError, setBidsError] = useState<string | null>(null);

  const [newListing, setNewListing] = useState({
    crop: 'Wheat',
    quantity: 10,
    unit: 'quintal',
    grade: 'A',
    price: 2000,
    harvestDate: new Date().toISOString().split('T')[0],
    state: UP_ONLY_STATE,
    district: '',
    description: '',
    isBidding: true,
  });
  const [listingLocError, setListingLocError] = useState({ district: '' });

  const [newBid, setNewBid] = useState({
    amount: 0,
    quantity: 0,
    message: '',
  });

  const [myFarms, setMyFarms] = useState<any[]>([]);
  const fetchMyFarms = async () => {
    if (!user || isMockConfig) return;
    const snap = await getDocs(query(collection(db, `users/${user.uid}/farms`)));
    setMyFarms(snap.docs.map(d => ({id: d.id, ...d.data()})));
  };

  const handleOpenAddModal = () => {
    setListingLocError({ district: '' });
    fetchMyFarms();
    setShowAddModal(true);
  };

  const fetchListings = useCallback(async () => {
    if (!user || isMockConfig) {
      if (isMockConfig) {
        setListings([
          {
            id: 'mock-1', farmerId: 'mock-uid', farmerName: 'Ramesh Singh', crop: 'Wheat',
            quantity: 50, unit: 'quintal', grade: 'A', price: 2150, harvestDate: '2023-10-10',
            district: 'Varanasi', state: 'Uttar Pradesh', description: 'Good quality wheat',
            isBidding: true, status: 'active', createdAt: new Date().toISOString(), isForwardContract: true, estimatedHarvest: '2026-06-15', aiHealthScore: 92
          },
          {
            id: 'mock-2', farmerId: 'other-uid', farmerName: 'Suresh Kumar', crop: 'Tomato',
            quantity: 200, unit: 'kg', grade: 'B', price: 20, harvestDate: '2023-11-01',
            district: 'Agra', state: 'Uttar Pradesh', description: 'Fresh tomatoes',
            isBidding: false, status: 'sold', createdAt: new Date().toISOString()
          }
        ]);
      } else {
        setListings([]);
      }
      setListingsLoading(false);
      return;
    }
    setListingsLoading(true);
    setListingsError(null);
    try {
      const constraints: QueryConstraint[] = [];

      if (activeTab === 'my_listings' || (activeTab === 'bids' && isFarmerOrSeller)) {
        constraints.push(where('farmerId', '==', user.uid));
      } else {
        // Buyers need to see listings they've won bids on (sold, awaiting_logistics, in_transit, delivered)
        if (!isFarmerOrSeller) {
          // Fetch all non-archived listings so buyers can see their won bids
          const qListAll = query(collection(db, 'listings'));
          const snap = await getDocs(qListAll);
          let data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setListings(data.filter((l: any) => l.status !== 'archived') as Listing[]);
          setHasMore(false);
          return;
        }
        constraints.push(where('status', '==', 'active'));
      }
      
      const qList = query(collection(db, 'listings'), ...constraints);
      const snap = await getDocs(qList);
      let data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setListings(data.filter((l: any) => l.status !== 'archived') as Listing[]);
      setHasMore(false);
    } catch (e) {
      console.error(e);
      setListingsError(UI.errorTitleEn);
      toast.error(UI.errorTitleEn);
    } finally {
      setListingsLoading(false);
    }
  }, [user, activeTab, isMockConfig, isFarmerOrSeller]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const loadMoreListings = () => {
    // Disabled pagination to avoid index errors
  };

  useEffect(() => {
    if (!user || isMockConfig) {
      if (isMockConfig) {
        setBids([
          {
            id: 'b1', listingId: 'mock-1', buyerId: 'buyer-uid', buyerName: 'Amit Patel',
            amount: 2200, quantity: 10, message: 'I need it fast', status: 'pending',
            createdAt: new Date().toISOString(), farmerId: 'mock-uid'
          },
          {
            id: 'b2', listingId: 'mock-2', buyerId: 'mock-uid', buyerName: 'Preview User',
            amount: 25, quantity: 200, message: 'Will pick up', status: 'accepted',
            createdAt: new Date().toISOString(), farmerId: 'other-uid'
          }
        ]);
      } else {
        setBids([]);
      }
      setBidsLoading(false);
      return;
    }
    
    setBidsLoading(true);
    setBidsError(null);
    let qBids;
    if (isFarmerOrSeller) {
      qBids = query(collection(db, 'bids'), where('farmerId', '==', user.uid));
    } else {
      qBids = query(collection(db, 'bids'), where('buyerId', '==', user.uid));
    }

    const unsub = onSnapshot(
      qBids,
      (snapshot) => {
        const loaded: Bid[] = [];
        snapshot.forEach((docSnap) => loaded.push({ id: docSnap.id, ...docSnap.data() } as Bid));
        setBids(loaded.filter(b => b.status !== 'archived'));
        setBidsLoading(false);
      },
      (err) => {
        console.error(err);
        setBidsError(UI.errorTitleEn);
        setBidsLoading(false);
      }
    );
    return () => unsub();
  }, [user, isFarmerOrSeller, isMockConfig]);

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setListingLocError({ district: '' });
    if (!newListing.district.trim()) {
      setListingLocError((p) => ({ ...p, district: t('loc_err_district') }));
      return;
    }
    if (!user || !userData) {
      setShowAddModal(false);
      return;
    }

    if (isMockConfig) {
      const mockNewListing: Listing = {
        id: `mock-${Date.now()}`,
        farmerId: user.uid,
        farmerName: userData.name || 'Farmer',
        crop: newListing.crop,
        quantity: Number(newListing.quantity),
        unit: newListing.unit,
        grade: newListing.grade,
        price: Number(newListing.price),
        harvestDate: newListing.harvestDate,
        state: UP_ONLY_STATE,
        district: newListing.district,
        description: newListing.description || '',
        isBidding: newListing.isBidding,
        status: 'active',
        highestBid: 0,
        bidCount: 0,
        createdAt: { toMillis: () => Date.now() },
      };
      setListings(prev => [mockNewListing, ...prev]);
      setShowAddModal(false);
      toast.success('Listing published (Mock Mode)');
      return;
    }

    try {
      if (!user) return;
      // For village agent: record both agentId and the farmer they're acting on behalf of
      const farmerId = isVillageAgent ? (currentFarmerId || user.uid) : user.uid;
      const listingData: any = {
        farmerId,
        farmerName: userData.name || 'Farmer',
        crop: newListing.crop,
        quantity: Number(newListing.quantity),
        unit: newListing.unit,
        grade: newListing.grade,
        price: Number(newListing.price),
        harvestDate: newListing.harvestDate,
        state: UP_ONLY_STATE,
        district: newListing.district,
        description: newListing.description || '',
        isBidding: newListing.isBidding,
        status: 'active',
        highestBid: 0,
        bidCount: 0,
        createdAt: serverTimestamp(),
      };

      // Add agent tracking if village agent is creating the listing
      if (isVillageAgent) {
        listingData.agentId = user.uid;
        listingData.actedAsAgent = true;
      }

      await addDoc(collection(db, 'listings'), listingData);
      setShowAddModal(false);
      toast.success('Listing published');
      fetchListings();
    } catch (error) {
      console.error('Error adding listing:', error);
      toast.error(UI.errorTitleEn);
    }
  };

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData || !showBidModal) {
      setShowBidModal(null);
      return;
    }

    if (isMockConfig) {
      const amount = Number(newBid.amount);
      const mockNewBid: Bid = {
        id: `bid-${Date.now()}`,
        listingId: showBidModal.id,
        farmerId: showBidModal.farmerId,
        buyerId: user.uid,
        buyerName: userData.name || 'Buyer',
        crop: showBidModal.crop,
        amount: amount,
        quantity: Number(newBid.quantity),
        message: newBid.message || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      setBids(prev => [mockNewBid, ...prev]);
      
      // Update listing in local state to reflect new bid
      setListings(prev => prev.map(l => {
        if (l.id === showBidModal.id) {
          return {
            ...l,
            bidCount: (l.bidCount || 0) + 1,
            highestBid: Math.max(l.highestBid || 0, amount)
          };
        }
        return l;
      }));

      setShowBidModal(null);
      toast.success('Bid placed (Mock Mode)');
      return;
    }

    try {
      const amount = Number(newBid.amount);

      // Check if this outbids someone
      if (showBidModal.highestBid && amount > showBidModal.highestBid) {
        const prevBidQ = query(collection(db, 'bids'), where('listingId', '==', showBidModal.id));
        const prevSnap = await getDocs(prevBidQ);
        let highestPrev: any = null;
        prevSnap.forEach(docSnap => {
          const b = docSnap.data();
          if (!highestPrev || b.amount > highestPrev.amount) highestPrev = b;
        });

        if (highestPrev && highestPrev.buyerId !== user.uid) {
          await NotificationService.sendNotification(highestPrev.buyerId, {
            title: 'You were outbid!',
            message: `Someone placed a higher bid on ${showBidModal.crop} listing.`,
            type: 'bid',
            relatedId: showBidModal.id
          });
        }
      }

      await addDoc(collection(db, 'bids'), {
        listingId: showBidModal.id,
        farmerId: showBidModal.farmerId,
        buyerId: user.uid,
        buyerName: userData.name || 'Buyer',
        crop: showBidModal.crop,
        amount: amount,
        quantity: Number(newBid.quantity),
        message: newBid.message || '',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      let updates: any = { bidCount: increment(1) };
      if (!showBidModal.highestBid || amount > showBidModal.highestBid) {
        updates.highestBid = amount;
      }
      await updateDoc(doc(db, 'listings', showBidModal.id), updates);

      // Notify seller
      await NotificationService.sendNotification(showBidModal.farmerId, {
        title: 'New Bid Received',
        message: `${userData.name} placed a bid of ₹${amount} on your ${showBidModal.crop} listing.`,
        type: 'bid',
        relatedId: showBidModal.id
      });
      
      setShowBidModal(null);
      toast.success('Bid placed');
    } catch (error) {
      console.error('Error placing bid:', error);
      toast.error(UI.errorTitleEn);
    }
  };

  const handleAcceptBid = async (bid: Bid) => {
    if (isMockConfig) {
      setBids(prev => prev.map(b => b.id === bid.id ? { ...b, status: 'accepted' } : (b.listingId === bid.listingId && b.status === 'pending' ? { ...b, status: 'declined' } : b)));
      setListings(prev => prev.map(l => l.id === bid.listingId ? { ...l, status: 'sold' } : l));
      toast.success('Bid accepted (Mock Mode)');
      return;
    }
    try {
      await updateDoc(doc(db, 'bids', bid.id), { status: 'accepted' });
      await updateDoc(doc(db, 'listings', bid.listingId), {
        status: 'sold',
        soldTo: bid.buyerId,
        soldAt: serverTimestamp(),
      });

      // Decline other pending bids for this listing
      const otherBidsQ = query(
        collection(db, 'bids'), 
        where('listingId', '==', bid.listingId),
        where('status', '==', 'pending')
      );
      const otherSnap = await getDocs(otherBidsQ);
      const batchPromises = otherSnap.docs
        .filter(d => d.id !== bid.id)
        .map(async (d) => {
          await updateDoc(doc(db, 'bids', d.id), { status: 'declined' });
          const bData = d.data();
          await NotificationService.sendNotification(bData.buyerId, {
            title: 'Bid Declined',
            message: `The item ${bid.listingId} was sold to another bidder.`,
            type: 'bid',
            relatedId: bid.listingId
          });
        });
      await Promise.all(batchPromises);

      await NotificationService.sendNotification(bid.buyerId, {
        title: 'Bid Accepted!',
        message: `Your bid of ₹${bid.amount} was accepted.`,
        type: 'bid',
        relatedId: bid.listingId
      });

      toast.success('Bid accepted and others declined');
    } catch (error) {
      console.error('Error accepting bid:', error);
      toast.error(UI.errorTitleEn);
    }
  };

  const handleDeclineBid = async (bidId: string, buyerId: string, amount: number, listingId: string) => {
    if (isMockConfig) {
      setBids(prev => prev.map(b => b.id === bidId ? { ...b, status: 'declined' } : b));
      toast.success('Bid declined (Mock Mode)');
      return;
    }
    try {
      await updateDoc(doc(db, 'bids', bidId), { status: 'declined' });

      await NotificationService.sendNotification(buyerId, {
        title: 'Bid Declined',
        message: `Your bid of ₹${amount} was declined by the seller.`,
        type: 'bid',
        relatedId: listingId
      });

      toast.success('Bid declined');
    } catch (error) {
      console.error('Error declining bid:', error);
      toast.error(UI.errorTitleEn);
    }
  };

  const handleArchiveListing = async (listingId: string) => {
    if (isMockConfig) {
      setListings(prev => prev.filter(l => l.id !== listingId));
      toast.success('Listing Archived (Mock Mode)');
      return;
    }
    try {
      await updateDoc(doc(db, 'listings', listingId), { status: 'archived' });
      setListings(prev => prev.filter(l => l.id !== listingId));
      toast.success('Listing Archived');
    } catch (e) {
      console.error(e);
      toast.error('Could not archive');
    }
  };

  const handleArchiveBid = async (bidId: string) => {
    if (isMockConfig) {
      setBids(prev => prev.filter(b => b.id !== bidId));
      toast.success('Bid Archived (Mock Mode)');
      return;
    }
    try {
      await updateDoc(doc(db, 'bids', bidId), { status: 'archived' });
      setBids(prev => prev.filter(b => b.id !== bidId));
      toast.success('Bid Archived');
    } catch (e) {
      console.error(e);
      toast.error('Could not archive');
    }
  };

  const farmerBids = isFarmerOrSeller ? bids.filter((b) => listings.some((l) => l.id === b.listingId)) : [];

  const openBidModal = (listing: Listing) => {
    setNewBid({ amount: listing.price, quantity: listing.quantity, message: '' });
    setShowBidModal(listing);
  };

  const retryListings = () => {
    lastVisibleRef.current = null;
    setHasMore(false);
    fetchListings();
  };

  return (
    <div className="w-full space-y-6 overflow-x-hidden pb-12 bg-gray-50 min-h-screen">
      <MandiTicker />
      <div className="max-w-6xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 ds-card flex items-center gap-4">
          <div className="w-14 h-14 bg-[#FEF3C7] text-[#F59E0B] rounded-2xl flex items-center justify-center shrink-0">
            <Store className="w-8 h-8" />
          </div>
          <div>
            <h1 className="ds-page-title font-devanagari">
              {t('mkt_title')}
            </h1>
            <p className="ds-caption mt-1 font-devanagari">{t('mkt_subtitle')}</p>
          </div>
        </div>

        <div className="lg:w-96 bg-[#1B4332] text-white p-6 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] w-full">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#F59E0B]" /> {t('mkt_today_mandi')}
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {MOCK_MANDI_PRICES.map((m) => (
              <div key={m.crop.en} className="flex justify-between items-center bg-white/10 px-3 py-2 rounded-xl">
                <span className="font-medium font-devanagari">{language === 'hi' ? m.crop.hi : m.crop.en}</span>
                <div className="flex items-center gap-1">
                  <span>{formatRupee(m.price)}</span>
                  {m.trend === 'up' && <TrendingUp className="w-3 h-3 text-[#10B981]" />}
                  {m.trend === 'down' && <TrendingDown className="w-3 h-3 text-[#EF4444]" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex bg-white rounded-2xl p-1 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-gray-100 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('market')}
            className={clsx(
              'flex-1 sm:flex-none px-6 py-3 rounded-xl font-medium text-sm transition-colors min-h-[44px]',
              activeTab === 'market' ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280]'
            )}
          >
            {language === 'en' ? 'Buy' : 'खरीदें'}
          </button>
          {isFarmerOrSeller && (
            <button
              type="button"
              onClick={() => setActiveTab('my_listings')}
              className={clsx(
                'flex-1 sm:flex-none px-6 py-3 rounded-xl font-medium text-sm transition-colors min-h-[44px]',
                activeTab === 'my_listings' ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280]'
              )}
            >
              {language === 'en' ? 'My Listings' : 'मेरी लिस्टिंग'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('bids')}
            className={clsx(
              'flex-1 sm:flex-none px-6 py-3 rounded-xl font-medium text-sm transition-colors min-h-[44px]',
              activeTab === 'bids' ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280]'
            )}
          >
            {isFarmerOrSeller ? t('mkt_bids_tab') : t('mkt_my_bids')}
          </button>
        </div>

        {isFarmerOrSeller && activeTab === 'my_listings' && (
          <button type="button" onClick={handleOpenAddModal} className="btn-secondary w-full sm:w-auto justify-center gap-2 flex items-center">
            <Plus className="w-5 h-5" /> {t('mkt_add_listing')}
          </button>
        )}
      </div>

      <div className="min-h-[400px]">
        {(activeTab === 'market' || activeTab === 'my_listings') && (
          <div className="space-y-6">
            <div className="space-y-4 mb-6 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder={language === 'en' ? 'Search crops...' : 'फसल खोजें...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
                  >
                    <option value="newest">{language === 'en' ? 'Newest' : 'नवीनतम'}</option>
                    <option value="price_asc">{language === 'en' ? 'Price: Low to High' : 'कीमत: कम से ज्यादा'}</option>
                    <option value="price_desc">{language === 'en' ? 'Price: High to Low' : 'कीमत: ज्यादा से कम'}</option>
                    <option value="most_bids">{language === 'en' ? 'Most Bids' : 'सबसे ज्यादा बोलियां'}</option>
                  </select>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
                  >
                    <option value="">{language === 'en' ? 'All Grades' : 'सभी ग्रेड'}</option>
                    <option value="A">Grade A</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowForwardContracts(!showForwardContracts)}
                    className={clsx(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all min-h-[44px]',
                      showForwardContracts
                        ? 'bg-fuchsia-50 border-fuchsia-300 text-fuchsia-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    <Clock3 className="w-4 h-4" />
                    {language === 'en' ? 'Forward Contracts' : 'फॉरवर्ड कॉन्ट्रैक्ट'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-gray-50">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">District</label>
                  <select
                    value={filterDistrict}
                    onChange={(e) => setFilterDistrict(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                  >
                    <option value="">{language === 'en' ? 'All Districts' : 'सभी जिले'}</option>
                    {UP_DISTRICTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                    Price Range: {formatRupee(priceRange[0])} - {formatRupee(priceRange[1])}
                  </label>
                  <div className="flex gap-4 items-center">
                    <input
                      type="range"
                      min="0"
                      max="10000"
                      step="100"
                      value={priceRange[1]}
                      onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                      className="flex-1 accent-[#1B4332]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {listingsLoading ? (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </motion.div>
            ) : listingsError ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-[#EF4444]/20 rounded-2xl p-8 text-center"
              >
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-[#EF4444]" />
                </div>
                <p className="font-devanagari text-[#111827] text-lg mb-2">{UI.errorTitleHi}</p>
                <p className="text-[#6B7280] mb-6">{UI.errorTitleEn}</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  className="px-6 py-3 bg-[#1B4332] text-white font-bold rounded-xl"
                  onClick={retryListings}
                >
                  {language === 'hi' ? 'पुनः प्रयास करें' : 'Try Again'}
                </motion.button>
              </motion.div>
            ) : listings.length === 0 ? (
              <PremiumEmptyState onAddListing={isFarmerOrSeller ? () => setShowAddModal(true) : undefined} />
            ) : (
              <>
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {filtered.map((listing) => (
                    listing.isForwardContract ? (
                      <ForwardContractCard
                        key={listing.id}
                        listing={listing}
                        isFarmer={user?.uid === listing.farmerId}
                        onPlaceBid={openBidModal}
                        hasBid={!isFarmerOrSeller && bids.some(b => b.listingId === listing.id)}
                      />
                    ) : (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        isFarmer={user?.uid === listing.farmerId}
                        onPlaceBid={openBidModal}
                        onArchiveListing={handleArchiveListing}
                        hasBid={!isFarmerOrSeller && bids.some(b => b.listingId === listing.id)}
                      />
                    )
                  ))}
                </motion.div>
                {filtered.length === 0 && <NoResultsState />}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      className="px-6 py-3 text-[#1B4332] font-semibold hover:bg-[#D1FAE5] rounded-xl transition-colors"
                      disabled={loadingMore}
                      onClick={loadMoreListings}
                    >
                      {loadingMore ? (language === 'hi' ? 'लोड हो रहा है...' : 'Loading...') : (language === 'hi' ? 'और लोड करें' : 'Load More')}
                    </motion.button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'bids' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {bidsLoading ? (
              <div className="p-6 space-y-4">
                <div className="skeleton h-24 w-full" />
                <div className="skeleton h-24 w-full" />
              </div>
            ) : bidsError ? (
              <div className="p-8 text-center text-[#EF4444]">⚠️ {bidsError}</div>
            ) : (isFarmerOrSeller ? farmerBids : bids).length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16 px-4"
              >
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-[#111827] mb-2">{language === 'hi' ? 'अभी कोई बोली नहीं' : 'No Bids Yet'}</h3>
                <p className="text-[#6B7280]">{language === 'hi' ? 'जब बोलियां आएंगी, वे यहां दिखाई देंगी।' : 'When bids are placed, they will appear here.'}</p>
              </motion.div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(isFarmerOrSeller ? farmerBids : bids).map((bid) => {
                  const listing = listings.find((l) => l.id === bid.listingId);
                  return (
                    <motion.div
                      key={bid.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#F9FAFB] transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-bold text-lg text-[#111827]">{listing?.crop || bid.crop || 'Unknown Crop'}</h3>
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={bid.status}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className={clsx(
                                'px-3 py-1 rounded-full text-xs font-bold',
                                bid.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : bid.status === 'accepted'
                                    ? 'bg-[#D1FAE5] text-[#065f46]'
                                    : 'bg-red-100 text-red-800'
                              )}
                            >
                              {bid.status === 'pending' ? (language === 'hi' ? 'लंबित' : 'Pending') :
                               bid.status === 'accepted' ? (language === 'hi' ? 'स्वीकृत' : 'Accepted') :
                               (language === 'hi' ? 'अस्वीकृत' : 'Declined')}
                            </motion.span>
                          </AnimatePresence>
                        </div>
                        <p className="text-sm text-[#6B7280] mb-3 font-devanagari">
                          {isFarmerOrSeller ? `${bid.buyerName} से बोली` : `${listing?.farmerName} की लिस्टिंग पर बोली`}
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <span className="flex items-center gap-1 text-[#6B7280]">
                            <IndianRupee className="w-4 h-4" />{' '}
                            <strong className="text-[#111827]">{formatRupee(bid.amount)}</strong>/{listing?.unit}
                          </span>
                          <span className="flex items-center gap-1 text-[#6B7280]">
                            <Scale className="w-4 h-4" />{' '}
                            <strong className="text-[#111827]">{bid.quantity}</strong> {listing?.unit}
                          </span>
                          <span className="flex items-center gap-1 text-[#6B7280] font-devanagari">
                            <Calendar className="w-4 h-4" /> {formatDate(bid.createdAt)}
                          </span>
                        </div>
                        {bid.message && (
                          <div className="mt-3 text-sm bg-[#F9FAFB] border border-gray-100 p-3 rounded-xl text-[#374151] italic">
                            &ldquo;{bid.message}&rdquo;
                          </div>
                        )}
                      </div>
                      {isFarmerOrSeller && listing && bid.status === 'accepted' && (
                        <div className="flex flex-col gap-2 mt-2">
                          {listing.status === 'awaiting_logistics' && listing.transportType === 'agent_transport' && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setShowLogisticsFormModal(listing)}
                              className="px-4 py-3 rounded-xl font-bold text-white bg-[#1B4332] shadow-lg flex items-center justify-center gap-2"
                            >
                              <Truck className="w-4 h-4" />
                              {language === 'hi' ? 'ट्रक भेजें' : 'Dispatch Truck'}
                            </motion.button>
                          )}
                          {listing.status === 'awaiting_logistics' && listing.transportType === 'buyer_pickup' && (
                            <div className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg font-medium">
                              {language === 'hi' ? 'खरीदार के ट्रक का इंतज़ार है।' : "Awaiting buyer's truck."}
                            </div>
                          )}
                          {['in_transit', 'at_pickup', 'heading_to_delivery', 'at_delivery'].includes(listing.status) && (
                            <InTransitCard listing={listing} isBuyer={false} />
                          )}
                          {listing.status === 'delivered' && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="px-4 py-2 rounded-xl bg-[#D1FAE5] text-[#065f46] font-bold text-sm flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {language === 'hi' ? 'डिलीवर हो चुका' : 'Delivered'}
                            </motion.div>
                          )}
                          {listing.status === 'awaiting_logistics' && !listing.transportType && (
                            <div className="text-xs text-gray-500 font-devanagari">
                              {language === 'hi' ? 'खरीदार ट्रांसपोर्ट चुन रहा है...' : 'Buyer selecting transport...'}
                            </div>
                          )}
                        </div>
                      )}
                      {isFarmerOrSeller && bid.status === 'pending' && (
                        <div className="flex gap-2 w-full justify-end sm:w-auto mt-3 md:mt-0 items-center shrink-0">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => handleAcceptBid(bid)}
                            className="min-h-[44px] px-5 rounded-full bg-[#10B981] text-white font-semibold flex items-center gap-2 hover:bg-[#059669] transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" /> {language === 'hi' ? 'स्वीकृत करें' : 'Accept'}
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => handleDeclineBid(bid.id, bid.buyerId, bid.amount, bid.listingId)}
                            className="min-h-[44px] px-5 rounded-full border border-[#EF4444] text-[#EF4444] font-semibold flex items-center gap-2 hover:bg-red-50 transition-colors"
                          >
                            <XCircle className="w-4 h-4" /> {language === 'hi' ? 'अस्वीकृत करें' : 'Decline'}
                          </motion.button>
                        </div>
                      )}

                      {!isFarmerOrSeller && bid.status === 'accepted' && listing && (
                        <div className="flex flex-col gap-3 mt-3 md:mt-0 w-full sm:w-auto shrink-0">
                          {['active', 'sold', 'awaiting_logistics'].includes(listing.status) && !listing.transportType && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setShowTransportModal(listing)}
                              className="px-5 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-[#10B981] to-[#059669] shadow-lg flex items-center justify-center gap-2"
                            >
                              <Shield className="w-4 h-4" />
                              {language === 'hi' ? 'फंड सिक्योर करें' : 'Secure Funds'}
                            </motion.button>
                          )}
                          {listing.status === 'awaiting_logistics' && listing.transportType && (
                            <div className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg font-medium">
                              {listing.transportType === 'buyer_pickup'
                                ? (language === 'hi' ? 'खरीदार के ट्रक का इंतज़ार है...' : "Awaiting buyer's truck...")
                                : (language === 'hi' ? 'एजेंट डिस्पैच का इंतज़ार है...' : 'Awaiting agent dispatch...')}
                            </div>
                          )}
                          {['in_transit', 'at_pickup', 'heading_to_delivery', 'at_delivery'].includes(listing.status) && (
                            <InTransitCard listing={listing} onConfirmDelivery={() => setShowDeliveryConfirmModal(listing)} isBuyer={true} />
                          )}
                          {listing.status === 'delivered' && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="px-4 py-2 rounded-xl bg-[#D1FAE5] text-[#065f46] font-bold text-sm flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {language === 'hi' ? 'डिलीवर हो चुका' : 'Delivered'}
                            </motion.div>
                          )}
                          {listing.status === 'sold' && !listing.transportType && (
                            <div className="text-xs text-gray-500 font-devanagari">
                              {language === 'hi' ? 'फंड सिक्योर करने के लिए बटन दबाएं' : 'Click above to secure funds'}
                            </div>
                          )}
                        </div>
                      )}

                      {!isFarmerOrSeller && bid.status === 'declined' && (
                         <div className="flex gap-2 mt-3 md:mt-0 w-full justify-end sm:w-auto shrink-0 border-l pl-4 border-gray-100">
                           <motion.button
                             whileTap={{ scale: 0.95 }}
                             onClick={() => handleArchiveBid(bid.id)} className="text-gray-400 hover:text-red-500 font-semibold text-sm px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
                             {language === 'hi' ? 'हटाएं' : 'Clear'}
                           </motion.button>
                         </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100"
            >
               <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex justify-between items-center z-10 rounded-t-2xl">
                <h2 className="text-xl font-bold text-[#111827]">{language === 'hi' ? 'नई लिस्टिंग जोड़ें' : 'Add New Listing'}</h2>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full"
                >
                  <X className="w-6 h-6 text-[#6B7280]" />
                </motion.button>
              </div>
              <form onSubmit={handleAddListing} className="p-6 space-y-6">
                
                {myFarms.length > 0 && (
                  <div className="mb-4">
                    <label className="ds-caption block mb-2">Select Registered Farm (Optional)</label>
                    <select
                      onChange={(e) => {
                        const farm = myFarms.find((f) => f.id === e.target.value);
                        if (farm) {
                          const c = farm.crops?.length ? farm.crops[0] : (farm as { crop?: string }).crop;
                          setNewListing({
                            ...newListing,
                            crop: c || newListing.crop,
                            state: UP_ONLY_STATE,
                            district: farm.district || '',
                          });
                        }
                      }}
                      className="w-full rounded-xl border border-gray-200 p-3 min-h-[44px] bg-[#F9FAFB]"
                    >
                      <option value="">-- Choose Farm --</option>
                      {myFarms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.crops?.[0] || (f as { crop?: string }).crop}) — {formatLocationLine(f.district, f.state)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="ds-caption block mb-2">Crop</label>
                    <select
                      value={newListing.crop}
                      onChange={(e) => setNewListing({ ...newListing, crop: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 p-3 min-h-[44px]"
                    >
                      {CROP_TYPES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <LocationSelector
                      label
                      selectedState={newListing.state}
                      selectedDistrict={newListing.district}
                      onStateChange={() => setNewListing({ ...newListing, state: UP_ONLY_STATE })}
                      onDistrictChange={(district) => setNewListing({ ...newListing, district })}
                      districtError={listingLocError.district}
                    />
                  </div>
                  <div>
                    <label className="ds-caption block mb-2">Quantity</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        required
                        min={1}
                        value={newListing.quantity}
                        onChange={(e) => setNewListing({ ...newListing, quantity: Number(e.target.value) })}
                        className="flex-1 rounded-xl border border-gray-200 p-3 min-h-[44px]"
                      />
                      <select
                        value={newListing.unit}
                        onChange={(e) => setNewListing({ ...newListing, unit: e.target.value })}
                        className="w-28 rounded-xl border border-gray-200 p-3 bg-[#F9FAFB] min-h-[44px]"
                      >
                        <option value="kg">kg</option>
                        <option value="quintal">Quintal</option>
                        <option value="ton">Ton</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="ds-caption block mb-2">Expected Price (₹ per {newListing.unit})</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newListing.price}
                      onChange={(e) => setNewListing({ ...newListing, price: Number(e.target.value) })}
                      className="w-full rounded-xl border border-gray-200 p-3 min-h-[44px]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="ds-caption block mb-2">Quality Grade</label>
                    <div className="flex gap-4 flex-wrap">
                      {['A', 'B', 'C'].map((grade) => (
                        <label key={grade} className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                          <input
                            type="radio"
                            name="grade"
                            value={grade}
                            checked={newListing.grade === grade}
                            onChange={(e) => setNewListing({ ...newListing, grade: e.target.value })}
                            className="text-[#1B4332]"
                          />
                          <span>Grade {grade}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="ds-caption block mb-2">Harvest Date</label>
                    <input
                      type="date"
                      required
                      value={newListing.harvestDate}
                      onChange={(e) => setNewListing({ ...newListing, harvestDate: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 p-3 min-h-[44px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="ds-caption block mb-2">Description (Optional)</label>
                  <textarea
                    rows={3}
                    value={newListing.description}
                    onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 p-3"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-3 rounded-xl font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors min-h-[44px]"
                  >
                    {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    className="px-6 py-3 rounded-xl font-bold text-white bg-[#1B4332] hover:bg-[#153326] shadow-lg transition-all min-h-[44px]"
                  >
                    {language === 'hi' ? 'लिस्टिंग प्रकाशित करें' : 'Publish Listing'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBidModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-start rounded-t-2xl">
                <div>
                  <h2 className="text-xl font-bold text-[#111827]">{language === 'hi' ? 'बोली लगाएं' : 'Place a Bid'}</h2>
                  <p className="text-sm text-[#6B7280] mt-1 font-devanagari">
                    {showBidModal.crop} - {showBidModal.farmerName}
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowBidModal(null)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </motion.button>
              </div>
              <form onSubmit={handlePlaceBid} className="p-6 space-y-5">
                <div className="bg-gradient-to-br from-[#F9FAFB] to-[#F3F4F6] p-4 rounded-xl border border-gray-100 text-sm space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">{language === 'hi' ? 'उपलब्ध:' : 'Available:'}</span>
                    <span className="font-semibold text-[#111827] font-devanagari">
                      {showBidModal.quantity} {showBidModal.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">{language === 'hi' ? 'मांग कीमत:' : 'Asking Price:'}</span>
                    <span className="font-semibold text-[#111827]">
                      {formatRupee(showBidModal.price)}/{showBidModal.unit}
                    </span>
                  </div>
                  {showBidModal.highestBid != null && (
                    <div className="flex justify-between text-[#92400e] font-semibold bg-[#FEF3C7]/50 p-2 rounded-lg">
                      <span>{language === 'hi' ? 'उच्चतम बोली:' : 'Highest Bid:'}</span>
                      <span className="font-bold">
                        {formatRupee(showBidModal.highestBid)}/{showBidModal.unit}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{language === 'hi' ? `आपकी बोली (₹ प्रति ${showBidModal.unit})` : `Your bid (₹ per ${showBidModal.unit})`}</label>
                  <input
                    type="number"
                    required
                    min={showBidModal.highestBid ? showBidModal.highestBid + 1 : 1}
                    value={newBid.amount}
                    onChange={(e) => setNewBid({ ...newBid, amount: Number(e.target.value) })}
                    className="w-full rounded-xl border border-gray-200 p-3 text-lg font-bold min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{language === 'hi' ? `मात्रा (${showBidModal.unit})` : `Quantity (${showBidModal.unit})`}</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={showBidModal.quantity}
                    value={newBid.quantity}
                    onChange={(e) => setNewBid({ ...newBid, quantity: Number(e.target.value) })}
                    className="w-full rounded-xl border border-gray-200 p-3 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{language === 'hi' ? 'संदेश (वैकल्पिक)' : 'Message (Optional)'}</label>
                  <textarea
                    rows={2}
                    value={newBid.message}
                    onChange={(e) => setNewBid({ ...newBid, message: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  className="w-full justify-center text-base py-4 rounded-xl font-bold text-white bg-[#1B4332] hover:bg-[#153326] shadow-lg transition-all min-h-[48px]"
                >
                  {language === 'hi' ? 'बोली सबमिट करें' : 'Submit Bid'}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTransportModal && (
          <TransportModal
            isOpen={!!showTransportModal}
            onClose={() => setShowTransportModal(null)}
            listing={showTransportModal}
            onSuccess={() => {
              setShowTransportModal(null);
              fetchListings();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogisticsFormModal && (
          <LogisticsFormModal
            isOpen={!!showLogisticsFormModal}
            onClose={() => setShowLogisticsFormModal(null)}
            listing={showLogisticsFormModal}
            transportType={showLogisticsFormModal.transportType || 'agent_transport'}
            onSuccess={() => {
              setShowLogisticsFormModal(null);
              fetchListings();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeliveryConfirmModal && (
          <DeliveryConfirmModal
            isOpen={!!showDeliveryConfirmModal}
            onClose={() => setShowDeliveryConfirmModal(null)}
            listing={showDeliveryConfirmModal}
            onSuccess={() => {
              setShowDeliveryConfirmModal(null);
              fetchListings();
            }}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
