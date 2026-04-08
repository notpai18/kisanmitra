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
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentData,
  serverTimestamp,
  increment,
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
  status: 'active' | 'sold' | 'archived';
  createdAt: string;
  highestBid?: number;
}

interface Bid {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
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

  return (
    <div className="ds-card p-4 md:p-6 overflow-hidden flex flex-col hover:shadow-[0_8px_32px_rgba(0,0,0,0.1)] transition-shadow w-full">
      <div className="flex justify-between items-start gap-2 mb-4">
        <div className="min-w-0">
          <h3 className="ds-card-title text-[#111827]">{listing.crop}</h3>
          <p className="ds-caption flex items-center gap-1 mt-1 font-devanagari">
            <MapPin className="w-4 h-4 shrink-0" /> {formatLocationLine(listing.district, listing.state)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={clsx(
              'px-2 py-1 rounded-full text-xs font-bold uppercase',
              listing.status === 'active' ? 'bg-[#D1FAE5] text-[#065f46]' : 'bg-gray-100 text-gray-800'
            )}
          >
            {listing.status}
          </span>
          <button
            type="button"
            onClick={share}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border border-[#1B4332]/20 text-[#1B4332] hover:bg-[#D1FAE5]"
            aria-label="Share on WhatsApp"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm gap-2">
          <span className="text-[#6B7280] flex items-center gap-1">
            <Scale className="w-4 h-4 shrink-0" /> Quantity
          </span>
          <span className="font-medium font-devanagari">
            {listing.quantity} {listing.unit}
          </span>
        </div>
        <div className="flex justify-between text-sm gap-2">
          <span className="text-[#6B7280] flex items-center gap-1">
            <IndianRupee className="w-4 h-4 shrink-0" /> Price
          </span>
          <span className="font-medium">
            {formatRupee(listing.price)}/{listing.unit}
          </span>
        </div>
        <div className="flex justify-between text-sm gap-2">
          <span className="text-[#6B7280] flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Quality
          </span>
          <span
            className={clsx(
              'font-bold px-2 py-0.5 rounded text-xs',
              listing.grade === 'A' ? 'bg-[#D1FAE5] text-[#065f46]' : listing.grade === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
            )}
          >
            Grade {listing.grade}
          </span>
        </div>
      </div>

      {listing.isBidding && listing.highestBid != null && (
        <div className="bg-[#FEF3C7] text-[#92400e] p-2 rounded-xl text-sm flex justify-between items-center mb-2">
          <span className="font-medium">Highest Bid:</span>
          <span className="font-bold">
            {formatRupee(listing.highestBid)}/{listing.unit}
          </span>
        </div>
      )}

      {!isFarmer && listing.status === 'active' && (
        <div className="mt-auto pt-2 border-t border-gray-100 h-14 flex items-center justify-center">
          {listing.isBidding ? (
            <button
              type="button"
              onClick={() => onPlaceBid(listing)}
              className={clsx("w-full justify-center text-sm py-3 rounded-xl font-bold transition-all", hasBid ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "btn-primary")}
            >
              {hasBid ? 'Bid Again' : 'Place Bid'}
            </button>
          ) : (
            (() => {
              const cartItem = items.find((item) => item.id === listing.id);
              const count = cartItem ? cartItem.quantity : 0;
              
              if (count > 0) {
                return (
                  <div className="flex items-center justify-between bg-forest-50 border border-forest-200 rounded-xl px-4 py-2 w-full h-full">
                    <button onClick={() => count === 1 ? removeFromCart(listing.id) : updateQuantity(listing.id, count - 1)} className="text-forest-600 font-bold p-1 w-8 hover:bg-forest-100 rounded flex items-center justify-center transition-colors">−</button>
                    <span className="font-bold text-forest-900 text-center text-lg">{count}</span>
                    <button onClick={() => updateQuantity(listing.id, count + 1)} className="text-forest-600 font-bold p-1 w-8 hover:bg-forest-100 rounded flex items-center justify-center transition-colors">+</button>
                  </div>
                );
              }
              
              return (
                <button
                  type="button"
                  onClick={() => {
                    addToCart({
                      id: listing.id,
                      name: listing.crop,
                      price: listing.price,
                      category: 'Market'
                    });
                    toast.success('Added to Cart');
                  }}
                  className="bg-forest-600 hover:bg-forest-700 text-white w-full justify-center text-sm py-3 rounded-xl font-bold transition-colors"
                >
                  Buy Now
                </button>
              );
            })()
          )}
        </div>
      )}

      {isFarmer && listing.status === 'sold' && (
         <div className="mt-auto pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => onArchiveListing?.(listing.id)}
            className="w-full text-center text-sm font-bold text-gray-500 py-3 hover:text-red-500 transition-colors"
          >
            Clear Completed Listing
          </button>
         </div>
      )}
    </div>
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

const useMarketFilters = (listings: Listing[]) => {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [grade, setGrade] = useState("");
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [sortBy, setSortBy] = useState("newest");
  
  const filtered = useMemo(() => {
    return listings
      .filter(l => 
        l.crop.toLowerCase()
          .includes(search.toLowerCase()))
      .filter(l => !state || l.state === state)
      .filter(l => !grade || l.grade === grade)
      .filter(l => 
        l.price >= priceRange[0] && 
        l.price <= priceRange[1])
      .sort((a, b) => {
        if (sortBy === "newest") {
           const aTime = (a.createdAt as any)?.toMillis?.() || 0;
           const bTime = (b.createdAt as any)?.toMillis?.() || 0;
           return bTime - aTime;
        }
        if (sortBy === "price_asc") 
          return a.price - b.price;
        if (sortBy === "price_desc") 
          return b.price - a.price;
        if (sortBy === "most_bids") 
          return ((b as any).bidCount || 0) - ((a as any).bidCount || 0);
        return 0;
      });
  }, [listings, search, state, grade, priceRange, sortBy]);
  
  return { filtered, search, setSearch, state, setState,
           grade, setGrade, priceRange, setPriceRange,
           sortBy, setSortBy };
};

export default function Market() {
  const { user, userData } = useAuth();
  const { t, language } = useLanguage();
  const isFarmer = userData?.role === 'farmer';

  const [activeTab, setActiveTab] = useState<'listings' | 'bids'>('listings');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState<Listing | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);
  const { filtered, search, setSearch, state, setState, grade, setGrade, priceRange, setPriceRange, sortBy, setSortBy } = useMarketFilters(listings);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const lastVisibleRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [bids, setBids] = useState<Bid[]>([]);
  const [bidsLoading, setBidsLoading] = useState(true);
  const [bidsError, setBidsError] = useState<string | null>(null);

  const [filterCrop, setFilterCrop] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');

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
            isBidding: true, status: 'active', createdAt: new Date().toISOString()
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
      if (isFarmer) {
        constraints.push(where('farmerId', '==', user.uid));
      } else {
        constraints.push(where('status', '==', 'active'));
      }
      if (!isFarmer && filterCrop) constraints.push(where('crop', '==', filterCrop));

      const qList = query(collection(db, 'listings'), ...constraints);
      const snap = await getDocs(qList);
      let data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      data.sort((a: any, b: any) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      let filtered = data.filter((l: any) => l.status !== 'archived');
      if (!isFarmer && filterDistrict) {
        filtered = filtered.filter((l: any) => l.district === filterDistrict);
      }
      setListings(filtered as Listing[]);
      setHasMore(false);
    } catch (e) {
      console.error(e);
      setListingsError(UI.errorTitleEn);
      toast.error(UI.errorTitleEn);
    } finally {
      setListingsLoading(false);
    }
  }, [user, isFarmer, filterCrop, filterDistrict, isMockConfig]);

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
    if (isFarmer) {
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
  }, [user, isFarmer, isMockConfig]);

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setListingLocError({ district: '' });
    if (!newListing.district.trim()) {
      setListingLocError((p) => ({ ...p, district: t('loc_err_district') }));
      return;
    }
    if (!user || !userData || isMockConfig) {
      setShowAddModal(false);
      return;
    }
    try {
      await addDoc(collection(db, 'listings'), {
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
        createdAt: serverTimestamp(),
      });
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
    if (!user || !userData || !showBidModal || isMockConfig) {
      setShowBidModal(null);
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
    if (isMockConfig) return;
    try {
      await updateDoc(doc(db, 'bids', bid.id), { status: 'accepted' });
      await updateDoc(doc(db, 'listings', bid.listingId), {
        status: 'sold',
        soldTo: bid.buyerId,
        soldAt: serverTimestamp(),
      });

      await NotificationService.sendNotification(bid.buyerId, {
        title: 'Bid Accepted!',
        message: `Your bid of ₹${bid.amount} was accepted.`,
        type: 'bid',
        relatedId: bid.listingId
      });

      toast.success('Bid accepted');
    } catch (error) {
      console.error('Error accepting bid:', error);
      toast.error(UI.errorTitleEn);
    }
  };

  const handleDeclineBid = async (bidId: string, buyerId: string, amount: number, listingId: string) => {
    if (isMockConfig) return;
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
    try {
      await updateDoc(doc(db, 'bids', bidId), { status: 'archived' });
      setBids(prev => prev.filter(b => b.id !== bidId));
      toast.success('Bid Archived');
    } catch (e) {
      console.error(e);
      toast.error('Could not archive');
    }
  };

  const farmerBids = isFarmer ? bids.filter((b) => listings.some((l) => l.id === b.listingId)) : [];

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
    <div className="w-full space-y-6 overflow-x-hidden pb-12">
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
            onClick={() => setActiveTab('listings')}
            className={clsx(
              'flex-1 sm:flex-none px-6 py-3 rounded-xl font-medium text-sm transition-colors min-h-[44px]',
              activeTab === 'listings' ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280]'
            )}
          >
            {isFarmer ? t('mkt_farmer_tab') : t('mkt_buyer_tab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bids')}
            className={clsx(
              'flex-1 sm:flex-none px-6 py-3 rounded-xl font-medium text-sm transition-colors min-h-[44px]',
              activeTab === 'bids' ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280]'
            )}
          >
            {isFarmer ? t('mkt_bids_tab') : t('mkt_my_bids')}
          </button>
        </div>

        {isFarmer && activeTab === 'listings' && (
          <button type="button" onClick={handleOpenAddModal} className="btn-secondary w-full sm:w-auto justify-center gap-2 flex items-center">
            <Plus className="w-5 h-5" /> {t('mkt_add_listing')}
          </button>
        )}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'listings' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
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
              <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="shrink-0 snap-start bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
                >
                  <option value="newest">{language === 'en' ? 'Newest' : 'नवीनतम'}</option>
                  <option value="price_asc">{language === 'en' ? 'Price: Low to High' : 'कीमत: कम से ज्यादा'}</option>
                  <option value="price_desc">{language === 'en' ? 'Price: High to Low' : 'कीमत: ज्यादा से कम'}</option>
                  <option value="most_bids">{language === 'en' ? 'Most Bids' : 'सबसे ज्यादा बोलियां'}</option>
                </select>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="shrink-0 snap-start bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
                >
                  <option value="">{language === 'en' ? 'All Grades' : 'सभी ग्रेड'}</option>
                  <option value="A">Grade A</option>
                  <option value="B">Grade B</option>
                  <option value="C">Grade C</option>
                </select>
              </div>
            </div>

            {listingsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-64 w-full rounded-2xl" />
                ))}
              </div>
            ) : listingsError ? (
              <div className="ds-card text-center border border-[#EF4444]/20 bg-red-50">
                <p className="text-[#EF4444] mb-2">⚠️</p>
                <p className="font-devanagari text-[#111827] mb-1">{UI.errorTitleHi}</p>
                <p className="ds-caption mb-4">{UI.errorTitleEn}</p>
                <button type="button" className="btn-primary" onClick={retryListings}>
                  {UI.tryAgainHi} / {UI.tryAgainEn}
                </button>
              </div>
            ) : listings.length === 0 ? (
              <div className="ds-card text-center border border-dashed border-gray-200">
                <Store className="w-14 h-14 text-[#D1FAE5] mx-auto mb-4" />
                <p className="ds-section-title font-devanagari text-[#111827]">{UI.marketEmptyHi}</p>
                <p className="ds-caption mb-6">{UI.marketEmptyEn}</p>
                {isFarmer && (
                  <button type="button" className="btn-secondary" onClick={() => setShowAddModal(true)}>
                    {UI.addFirstListing}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} isFarmer={!!isFarmer} onPlaceBid={openBidModal} onArchiveListing={handleArchiveListing} hasBid={!isFarmer && bids.some(b => b.listingId === listing.id)} />
                  ))}
                </div>
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-gray-500 font-devanagari">
                    {language === 'en' ? 'No listings found matching your filters.' : 'आपके फ़िल्टर से मेल खाने वाली कोई लिस्टिंग नहीं मिली।'}
                  </div>
                )}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={loadingMore}
                      onClick={loadMoreListings}
                    >
                      {loadingMore ? 'Loading…' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'bids' && (
          <div className="ds-card overflow-hidden p-0">
            {bidsLoading ? (
              <div className="p-6 space-y-4">
                <div className="skeleton h-24 w-full" />
                <div className="skeleton h-24 w-full" />
              </div>
            ) : bidsError ? (
              <div className="p-8 text-center text-[#EF4444]">⚠️ {bidsError}</div>
            ) : (isFarmer ? farmerBids : bids).length === 0 ? (
              <div className="text-center py-12 px-4">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="ds-card-title">No bids yet</h3>
                <p className="ds-caption">When bids are placed, they will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(isFarmer ? farmerBids : bids).map((bid) => {
                  const listing = listings.find((l) => l.id === bid.listingId);
                  return (
                    <div
                      key={bid.id}
                      className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#F9FAFB]"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-bold text-lg text-[#111827]">{listing?.crop || 'Unknown Crop'}</h3>
                          <span
                            className={clsx(
                              'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase',
                              bid.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : bid.status === 'accepted'
                                  ? 'bg-[#D1FAE5] text-[#065f46]'
                                  : 'bg-red-100 text-red-800'
                            )}
                          >
                            {bid.status}
                          </span>
                        </div>
                        <p className="text-sm text-[#6B7280] mb-2">
                          {isFarmer ? `Bid from ${bid.buyerName}` : `Bid on ${listing?.farmerName}'s listing`}
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
                      {isFarmer && bid.status === 'pending' && (
                        <div className="flex gap-2 w-full justify-end sm:w-auto mt-3 md:mt-0 items-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAcceptBid(bid)}
                            className="min-h-[44px] px-4 rounded-full bg-[#10B981] text-white font-semibold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineBid(bid.id, bid.buyerId, bid.amount, bid.listingId)}
                            className="min-h-[44px] px-4 rounded-full border border-[#EF4444] text-[#EF4444] font-semibold flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" /> Decline
                          </button>
                        </div>
                      )}
                      
                      {!isFarmer && bid.status === 'accepted' && (
                        <div className="flex gap-4 mt-3 md:mt-0 w-full justify-end sm:w-auto shrink-0 border-l pl-4 border-gray-100 items-center">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#D1FAE5] text-[#065f46]">
                            Won! ✓
                          </span>
                          {listing && <RatingWidget bid={bid} listing={listing} />}
                          <button onClick={() => handleArchiveBid(bid.id)} className="text-gray-400 hover:text-red-500 font-bold text-sm">
                            Clear
                          </button>
                        </div>
                      )}

                      {!isFarmer && bid.status === 'declined' && (
                         <div className="flex gap-2 mt-3 md:mt-0 w-full justify-end sm:w-auto shrink-0 border-l pl-4 border-gray-100">
                           <button onClick={() => handleArchiveBid(bid.id)} className="text-gray-400 hover:text-red-500 font-bold text-sm">
                             Clear
                           </button>
                         </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
               <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex justify-between items-center z-10">
                <h2 className="text-xl font-bold text-[#111827]">Add New Listing</h2>
                <button type="button" onClick={() => setShowAddModal(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full">
                  <X className="w-6 h-6 text-[#6B7280]" />
                </button>
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
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Publish Listing
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBidModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-[#111827]">{showBidModal.isBidding ? 'Place a Bid' : 'Buy Now'}</h2>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {showBidModal.crop} from {showBidModal.farmerName}
                  </p>
                </div>
                <button type="button" onClick={() => setShowBidModal(null)} className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>
              <form onSubmit={handlePlaceBid} className="p-6 space-y-5">
                <div className="bg-[#F9FAFB] p-4 rounded-xl border border-gray-100 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Available:</span>
                    <span className="font-medium">
                      {showBidModal.quantity} {showBidModal.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Asking Price:</span>
                    <span className="font-medium">
                      {formatRupee(showBidModal.price)}/{showBidModal.unit}
                    </span>
                  </div>
                  {showBidModal.highestBid != null && (
                    <div className="flex justify-between text-[#92400e] font-medium">
                      <span>Highest Bid:</span>
                      <span>
                        {formatRupee(showBidModal.highestBid)}/{showBidModal.unit}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="ds-caption block mb-2">Your bid (₹ per {showBidModal.unit})</label>
                  <input
                    type="number"
                    required
                    min={showBidModal.isBidding ? (showBidModal.highestBid ? showBidModal.highestBid + 1 : 1) : showBidModal.price}
                    max={showBidModal.isBidding ? undefined : showBidModal.price}
                    readOnly={!showBidModal.isBidding}
                    value={newBid.amount}
                    onChange={(e) => setNewBid({ ...newBid, amount: Number(e.target.value) })}
                    className={clsx(
                      'w-full rounded-xl border border-gray-200 p-3 text-lg font-bold min-h-[44px]',
                      !showBidModal.isBidding && 'bg-[#F9FAFB]'
                    )}
                  />
                </div>
                <div>
                  <label className="ds-caption block mb-2">Quantity ({showBidModal.unit})</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={showBidModal.quantity}
                    value={newBid.quantity}
                    onChange={(e) => setNewBid({ ...newBid, quantity: Number(e.target.value) })}
                    className="w-full rounded-xl border border-gray-200 p-3 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="ds-caption block mb-2">Message (Optional)</label>
                  <textarea
                    rows={2}
                    value={newBid.message}
                    onChange={(e) => setNewBid({ ...newBid, message: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 p-3"
                  />
                </div>
                <button type="submit" className="btn-primary w-full justify-center text-base py-3">
                  {showBidModal.isBidding ? 'Submit Bid' : 'Confirm Purchase'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
