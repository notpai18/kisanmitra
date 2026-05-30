import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, DollarSign, CheckCircle2, Package, MapPin, Navigation, Phone, ArrowRight, Loader2, Clock, Play, MapPinned } from 'lucide-react';
import { db, isMockConfig } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// Granular logistics status types
type LogisticsStatus = 'in_transit' | 'at_pickup' | 'heading_to_delivery' | 'at_delivery' | 'delivered';

interface ActiveTrip {
  id: string;
  crop: string;
  quantity: number;
  unit: string;
  pickupLocation: string;
  dropoffLocation: string;
  sellerName: string;
  sellerPhone?: string;
  buyerName: string;
  buyerPhone?: string;
  transporterPayout: number;
  acceptedAt: any;
  status: LogisticsStatus;
}

export default function TransporterDashboard() {
  const { user, userData } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [completedTrips, setCompletedTrips] = useState<number>(0);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTransporterData();
  }, [user?.uid]);

  const fetchTransporterData = async () => {
    if (!user && !isMockConfig) {
      setLoading(false);
      return;
    }

    if (isMockConfig) {
      setActiveTrips([
        {
          id: 'mock-1',
          crop: 'Wheat',
          quantity: 5,
          unit: 'tons',
          pickupLocation: 'Azamgarh, UP',
          dropoffLocation: 'Kanpur, UP',
          sellerName: 'Ramesh Kumar',
          buyerName: 'Grain Traders Ltd',
          transporterPayout: 4275,
          acceptedAt: new Date(),
          status: 'in_transit' as LogisticsStatus,
        },
      ]);
      setCompletedTrips(12);
      setTotalEarnings(48500);
      setLoading(false);
      return;
    }

    try {
      // Fetch active trips (any granular status with this transporter)
      const activeStatuses = ['in_transit', 'at_pickup', 'heading_to_delivery', 'at_delivery'];
      const tripsQuery = query(
        collection(db, 'listings'),
        where('transporterId', '==', user?.uid),
        where('status', 'in', activeStatuses)
      );
      const tripsSnapshot = await getDocs(tripsQuery);
      const trips = tripsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        status: doc.data().status || 'in_transit'
      })) as ActiveTrip[];
      setActiveTrips(trips);

      // Fetch user data for stats
      if (user) {
        const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)));
        if (!userDoc.empty) {
          const data = userDoc.docs[0].data();
          setTotalEarnings(data.totalRevenue || 0);
          setCompletedTrips(data.completedTrips || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching transporter data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle granular status updates
  const updateTripStatus = async (trip: ActiveTrip, newStatus: LogisticsStatus) => {
    if (!user || isMockConfig) {
      // Mock mode
      const statusLabels: Record<LogisticsStatus, string> = {
        in_transit: 'Started journey',
        at_pickup: 'Arrived at pickup',
        heading_to_delivery: 'Crop loaded - journey started',
        at_delivery: 'Arrived at delivery',
        delivered: 'Delivered',
      };
      toast.success(statusLabels[newStatus] || 'Status updated!');

      // For mock, remove if delivered
      if (newStatus === 'delivered' || newStatus === 'at_delivery') {
        setActiveTrips(prev => prev.filter(t => t.id !== trip.id));
        setCompletedTrips(prev => prev + 1);
      } else {
        setActiveTrips(prev => prev.map(t => t.id === trip.id ? { ...t, status: newStatus } : t));
      }
      return;
    }

    setUpdatingId(trip.id);
    try {
      const updateData: any = {
        status: newStatus,
      };

      // Add timestamp for each status transition
      switch (newStatus) {
        case 'at_pickup':
          updateData.arrivedAtPickup = serverTimestamp();
          break;
        case 'heading_to_delivery':
          updateData.loadedAndDispatched = serverTimestamp();
          break;
        case 'at_delivery':
          updateData.arrivedAtDelivery = serverTimestamp();
          break;
      }

      await updateDoc(doc(db, 'listings', trip.id), updateData);

      // If reached at_delivery, keep it there for buyer confirmation
      // If delivered, remove from active list
      if (newStatus === 'delivered') {
        setActiveTrips(prev => prev.filter(t => t.id !== trip.id));
        setCompletedTrips(prev => prev + 1);
      } else {
        setActiveTrips(prev => prev.map(t => t.id === trip.id ? { ...t, status: newStatus } : t));
      }

      toast.success(
        language === 'hi'
          ? 'स्थिति अपडेट हुई!'
          : 'Status updated!'
      );
    } catch (error) {
      console.error('Error updating trip status:', error);
      toast.error(language === 'hi' ? 'त्रुटि हुई' : 'Something went wrong');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 text-white"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <span className="text-white/80 text-sm">
              {language === 'hi' ? 'सक्रिय यात्राएं' : 'Active Trips'}
            </span>
          </div>
          <div className="text-3xl font-bold">{activeTrips.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-gray-500 text-sm">
              {language === 'hi' ? 'पूर्ण यात्राएं' : 'Completed Trips'}
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{completedTrips}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-gray-500 text-sm">
              {language === 'hi' ? 'कुल कमाई' : 'Total Earnings'}
            </span>
          </div>
          <div className="text-3xl font-bold text-amber-600">₹{totalEarnings.toLocaleString()}</div>
        </motion.div>
      </div>

      {/* Load Board Button */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => navigate('/load-board')}
        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg"
      >
        <Truck className="w-6 h-6" />
        {language === 'hi' ? 'नए लोड खोजें' : 'Find New Loads'}
        <ArrowRight className="w-5 h-5" />
      </motion.button>

      {/* Active Trips Section */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          {language === 'hi' ? 'सक्रिय यात्राएं' : 'Active Trips'}
        </h2>

        {activeTrips.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 bg-white rounded-2xl border border-gray-100"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Truck className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500">
              {language === 'hi' ? 'कोई सक्रिय यात्रा नहीं' : 'No active trips'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {activeTrips.map((trip, index) => {
              // Status configuration
              const getStatusInfo = (status: LogisticsStatus) => {
                const statusMap: Record<LogisticsStatus, { label: string; bg: string; text: string; icon: any }> = {
                  in_transit: {
                    label: language === 'hi' ? 'रास्ते में' : 'En Route',
                    bg: 'bg-blue-100',
                    text: 'text-blue-700',
                    icon: Truck
                  },
                  at_pickup: {
                    label: language === 'hi' ? 'पिकअप पर पहुंचे' : 'At Pickup',
                    bg: 'bg-amber-100',
                    text: 'text-amber-700',
                    icon: MapPinned
                  },
                  heading_to_delivery: {
                    label: language === 'hi' ? 'डिलीवरी की ओर' : 'Heading to Delivery',
                    bg: 'bg-purple-100',
                    text: 'text-purple-700',
                    icon: Play
                  },
                  at_delivery: {
                    label: language === 'hi' ? 'डिलीवरी पर पहुंचे' : 'At Delivery',
                    bg: 'bg-green-100',
                    text: 'text-green-700',
                    icon: CheckCircle2
                  },
                  delivered: {
                    label: language === 'hi' ? 'डिलीवर' : 'Delivered',
                    bg: 'bg-green-100',
                    text: 'text-green-700',
                    icon: CheckCircle2
                  },
                };
                return statusMap[status] || statusMap.in_transit;
              };

              const statusInfo = getStatusInfo(trip.status);
              const StatusIcon = statusInfo.icon;

              // Get next action based on current status
              const getNextAction = () => {
                switch (trip.status) {
                  case 'in_transit':
                    return {
                      label: language === 'hi' ? 'पिकअप पर पहुंचे' : 'Reached at Pickup',
                      nextStatus: 'at_pickup' as LogisticsStatus,
                      color: 'bg-amber-500 hover:bg-amber-600',
                    };
                  case 'at_pickup':
                    return {
                      label: language === 'hi' ? 'लोड हुआ - यात्रा शुरू' : 'Crop Loaded - Start Journey',
                      nextStatus: 'heading_to_delivery' as LogisticsStatus,
                      color: 'bg-purple-500 hover:bg-purple-600',
                    };
                  case 'heading_to_delivery':
                    return {
                      label: language === 'hi' ? 'डिलीवरी स्थान पर पहुंचे' : 'Reached at Delivery',
                      nextStatus: 'at_delivery' as LogisticsStatus,
                      color: 'bg-green-500 hover:bg-green-600',
                    };
                  case 'at_delivery':
                    return {
                      label: language === 'hi' ? 'डिलीवरी पूर्ण' : 'Delivery Complete',
                      nextStatus: 'delivered' as LogisticsStatus,
                      color: 'bg-gray-500 hover:bg-gray-600',
                    };
                  default:
                    return null;
                }
              };

              const nextAction = getNextAction();

              return (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Trip Details */}
                  <div className="flex-1 space-y-3">
                    {/* Status Badge */}
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.text}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusInfo.label}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                        <Package className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{trip.crop}</h3>
                        <p className="text-sm text-gray-500">
                          {trip.quantity} {trip.unit}
                        </p>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <MapPin className="w-4 h-4 text-green-500" />
                          <span>{trip.pickupLocation}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600 mt-1">
                          <Navigation className="w-4 h-4 text-red-500" />
                          <span>{trip.dropoffLocation}</span>
                        </div>
                      </div>
                    </div>

                    {/* Seller Info */}
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{trip.sellerName}</span>
                      {' → '}
                      <span className="font-medium">{trip.buyerName}</span>
                    </div>
                  </div>

                  {/* Payout & Actions */}
                  <div className="text-right">
                    <div className="text-sm text-gray-500 mb-1">
                      {language === 'hi' ? 'पेआउट' : 'Payout'}
                    </div>
                    <div className="text-xl font-bold text-green-600 mb-3">
                      ₹{trip.transporterPayout.toLocaleString()}
                    </div>
                    {nextAction && trip.status !== 'at_delivery' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => updateTripStatus(trip, nextAction.nextStatus)}
                        disabled={updatingId === trip.id}
                        className={`w-full md:w-auto px-4 py-2 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 ${nextAction.color}`}
                      >
                        {updatingId === trip.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            {nextAction.label}
                            <CheckCircle2 className="w-4 h-4" />
                          </>
                        )}
                      </motion.button>
                    )}
                    {trip.status === 'at_delivery' && (
                      <div className="text-sm text-amber-600 font-medium">
                        {language === 'hi'
                          ? 'खरीदार की पुष्टि का इंतज़ार'
                          : 'Waiting for buyer confirmation'}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}