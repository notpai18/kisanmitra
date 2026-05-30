import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { groupListingService } from '../lib/GroupListingService';
import type { GroupListing, GroupListingItem, DigitalReceipt } from '../types';
import { Users, Plus, X, MapPin, Package, IndianRupee, CheckCircle, Loader2, TrendingUp, Building2, Warehouse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const CROP_OPTIONS = ['Wheat', 'Rice', 'Maize', 'Sugarcane', 'Potato', 'Tomato', 'Soybean', 'Mustard', 'Cotton', 'Pulses', 'Other'];

interface CreateListingForm {
  groupName: string;
  groupType: GroupListing['groupType'];
  crop: string;
  variety: string;
  quantity: number;
  minPrice: number;
  maxPrice: number;
  minQuality: GroupListing['minQuality'];
  deliveryLocation: string;
  deliveryDate: string;
  maxMembers: number;
  deadline: string;
}

interface JoinForm {
  quantity: number;
  quality: GroupListingItem['quality'];
  pricePerUnit: number;
}

export default function GroupListings() {
  const { user, userData } = useAuth();
  const { language } = useLanguage();
  const [listings, setListings] = useState<GroupListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail' | 'contracts'>('list');
  const [selectedListing, setSelectedListing] = useState<GroupListing | null>(null);
  const [listingItems, setListingItems] = useState<GroupListingItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Corporate Contracts state
  const [activeContracts, setActiveContracts] = useState<any[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [availableReceipts, setAvailableReceipts] = useState<DigitalReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<DigitalReceipt | null>(null);
  const [pledging, setPledging] = useState(false);

  const [createForm, setCreateForm] = useState<CreateListingForm>({
    groupName: '',
    groupType: 'fpo',
    crop: '',
    variety: '',
    quantity: 10,
    minPrice: 1500,
    maxPrice: 2000,
    minQuality: 'B',
    deliveryLocation: '',
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    maxMembers: 50,
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const [joinForm, setJoinForm] = useState<JoinForm>({
    quantity: 5,
    quality: 'B',
    pricePerUnit: 1700,
  });

  const [saving, setSaving] = useState(false);

  const district = userData?.district || '';

  // Load listings on mount
  useEffect(() => {
    console.log('=== GroupListings mounted, loading data ===');

    // Load initial data
    groupListingService.getActiveListings().then(data => {
      console.log('=== Initial load got:', data.length, 'listings ===');
      setListings(data);
      setLoading(false);
    }).catch(err => {
      console.error('Error loading listings:', err);
      setLoading(false);
    });

    // Subscribe to updates
    const unsubscribe = groupListingService.subscribeToAllListings((data) => {
      console.log('=== Subscription update:', data.length, 'listings ===');
      setListings(data);
      setLoading(false);
    });

    return () => {
      console.log('=== Cleanup subscription ===');
      unsubscribe();
    };
  }, []);

  // Fetch corporate contracts for farmers
  useEffect(() => {
    if (userData?.role === 'farmer' || userData?.role === 'seller') {
      setContractsLoading(true);
      groupListingService.getActiveContractsForFarmer()
        .then(contracts => {
          setActiveContracts(contracts);
        })
        .catch(err => console.error('Error fetching contracts:', err))
        .finally(() => setContractsLoading(false));
    }
  }, [userData?.role, user]);

  // Create listing
  const handleCreateListing = async () => {
    if (!user || !userData) return;

    if (!createForm.groupName || !createForm.crop || createForm.quantity <= 0) {
      toast.error(language === 'hi' ? 'कृपया सभी आवश्यक फ़ील्ड भरें' : 'Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      await groupListingService.createListing({
        groupName: createForm.groupName,
        groupType: createForm.groupType,
        organizerId: user.uid,
        organizerName: userData.name,
        district,
        state: 'Uttar Pradesh',
        crop: createForm.crop,
        cropCategory: 'cereal',
        variety: createForm.variety,
        quantity: createForm.quantity,
        minPrice: createForm.minPrice,
        maxPrice: createForm.maxPrice,
        minQuality: createForm.minQuality,
        deliveryLocation: createForm.deliveryLocation || district || 'Varanasi',
        deliveryDate: createForm.deliveryDate,
        maxMembers: createForm.maxMembers,
        deadline: createForm.deadline,
      });

      toast.success(language === 'hi' ? 'ग्रुप लिस्टिंग बनाई गई' : 'Group listing created!');
      setShowCreateModal(false);
      setViewMode('list');

      // Force reload - the subscription should catch it but let's be sure
      const data = await groupListingService.getActiveListings();
      setListings(data);

    } catch (err) {
      console.error('Error creating listing:', err);
      toast.error(language === 'hi' ? 'त्रुटि हुई' : 'Error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Join listing
  const handleJoinListing = async () => {
    if (!user || !userData || !selectedListing) return;

    if (joinForm.quantity <= 0 || joinForm.pricePerUnit <= 0) {
      toast.error('Please enter valid quantity and price');
      return;
    }

    if (joinForm.pricePerUnit < selectedListing.minPrice || joinForm.pricePerUnit > selectedListing.maxPrice) {
      toast.error(`Price must be between ₹${selectedListing.minPrice} and ₹${selectedListing.maxPrice}`);
      return;
    }

    setSaving(true);
    try {
      await groupListingService.joinListing(selectedListing.id, {
        userId: user.uid,
        userName: userData.name,
        quantity: joinForm.quantity,
        quality: joinForm.quality,
        pricePerUnit: joinForm.pricePerUnit,
      });
      toast.success(language === 'hi' ? 'सफलतापूर्वक जुड़ गए!' : 'Successfully joined!');
      setShowJoinModal(false);
    } catch (err) {
      console.error('Error joining listing:', err);
      toast.error('Failed to join');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN')}`;

  const getProgress = (listing: GroupListing) => {
    return Math.min(100, (listing.currentQuantity / listing.quantity) * 100);
  };

  const getDeadlineStatus = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { text: 'Expired', class: 'bg-red-100 text-red-800' };
    if (daysLeft <= 3) return { text: `${daysLeft} days left`, class: 'bg-yellow-100 text-yellow-800' };
    return { text: `${daysLeft} days left`, class: 'bg-green-100 text-green-800' };
  };

  // Open pledge modal for a contract
  const openPledgeModal = async (contract: any) => {
    if (!user) return;
    setSelectedContract(contract);
    setSelectedReceipt(null);
    setReceiptsLoading(true);
    setShowPledgeModal(true);

    try {
      const receipts = await groupListingService.getUnpledgedReceiptsForCrop(user.uid, contract.crop);
      setAvailableReceipts(receipts);
    } catch (err) {
      console.error('Error fetching receipts:', err);
      toast.error('Failed to load receipts');
    } finally {
      setReceiptsLoading(false);
    }
  };

  // Handle pledge action
  const handlePledge = async () => {
    if (!user || !selectedContract || !selectedReceipt) return;

    setPledging(true);
    try {
      const result = await groupListingService.pledgeDWRToContract(
        user.uid,
        selectedContract.id,
        selectedReceipt.id,
        selectedReceipt.quantity
      );

      if (result.success) {
        toast.success(language === 'hi' ? 'सफलतापूर्वक गिरवी रखा गया!' : 'Successfully pledged to contract!');
        setShowPledgeModal(false);
        setAvailableReceipts(prev => prev.filter(r => r.id !== selectedReceipt.id));
      } else {
        toast.error(result.error || 'Failed to pledge');
      }
    } catch (err) {
      console.error('Error pledging:', err);
      toast.error('Error occurred');
    } finally {
      setPledging(false);
    }
  };

  const getContractStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-yellow-100 text-yellow-700';
      case 'fulfilled': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-forest-100 text-forest-600 rounded-2xl flex items-center justify-center">
              {viewMode === 'contracts' ? <Building2 className="w-8 h-8" /> : <Users className="w-8 h-8" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {viewMode === 'contracts'
                  ? (language === 'hi' ? 'कॉर्पोरेट अनुबंध' : 'Corporate Contracts')
                  : (language === 'hi' ? 'ग्रुप लिस्टिंग' : 'Group Listings')}
              </h1>
              <p className="text-gray-500">
                {viewMode === 'contracts'
                  ? (language === 'hi' ? 'कॉर्पोरेट खरीदारों से अनुबंध' : 'Contracts from corporate buyers')
                  : (language === 'hi' ? 'FPO/सहकारी थोक खरीद' : 'FPO/Cooperative Bulk Buying')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab Switcher for Farmers */}
            {(userData?.role === 'farmer' || userData?.role === 'seller') && (
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    viewMode === 'list' ? 'bg-white text-forest-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Users className="w-4 h-4 inline mr-1" />
                  {language === 'hi' ? 'ग्रुप' : 'Group'}
                </button>
                <button
                  onClick={() => setViewMode('contracts')}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    viewMode === 'contracts' ? 'bg-white text-forest-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Building2 className="w-4 h-4 inline mr-1" />
                  {language === 'hi' ? 'अनुबंध' : 'Contracts'}
                </button>
              </div>
            )}

            {viewMode === 'list' && (userData?.role === 'seller' || userData?.role === 'farmer') && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-forest-600 hover:bg-forest-700 text-white px-5 py-3 rounded-xl font-medium"
              >
                <Plus className="w-5 h-5" />
                {language === 'hi' ? 'नई लिस्टिंग' : 'Create Listing'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-forest-600 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && viewMode === 'list' && listings.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No group listings yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-forest-600 text-white rounded-xl"
          >
            Create First Listing
          </button>
        </div>
      )}

      {/* Corporate Contracts View (for Farmers) */}
      {viewMode === 'contracts' && (
        <>
          {contractsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-forest-600 animate-spin" />
            </div>
          ) : activeContracts.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {language === 'hi' ? 'कोई सक्रिय अनुबंध नहीं' : 'No active contracts available'}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {activeContracts.map((contract, index) => {
                const progress = (contract.committedQuantity / contract.targetQuantity) * 100;
                const remaining = contract.targetQuantity - contract.committedQuantity;

                return (
                  <motion.div
                    key={contract.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden"
                  >
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-white" />
                          <span className="text-white font-semibold">{contract.buyerOrganization}</span>
                        </div>
                        <span className={clsx('text-xs px-2 py-1 rounded-full bg-white/20 text-white')}>
                          {contract.status}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{contract.crop}</h3>
                        {contract.variety && (
                          <p className="text-sm text-gray-500">{contract.variety}</p>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">
                            {language === 'hi' ? 'प्रगति' : 'Progress'}
                          </span>
                          <span className="font-bold text-gray-900">
                            {contract.committedQuantity} / {contract.targetQuantity} tons
                          </span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className={clsx(
                              'h-full rounded-full',
                              progress >= 100 ? 'bg-green-500' : progress > 50 ? 'bg-indigo-500' : 'bg-yellow-500'
                            )}
                          />
                        </div>
                        {remaining > 0 && (
                          <p className="text-sm text-gray-500 mt-1">
                            {remaining} tons {language === 'hi' ? 'शेष' : 'remaining'}
                          </p>
                        )}
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">
                            {language === 'hi' ? 'मूल्य/टन' : 'Price/Ton'}
                          </p>
                          <p className="font-bold text-gray-900">₹{contract.unitPrice.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">
                            {language === 'hi' ? 'डिलीवरी' : 'Delivery'}
                          </p>
                          <p className="font-bold text-gray-900 text-xs">{contract.deliveryLocation}</p>
                        </div>
                      </div>

                      {/* Pledge Button */}
                      {remaining > 0 && (
                        <button
                          onClick={() => openPledgeModal(contract)}
                          className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                        >
                          <Warehouse className="w-5 h-5" />
                          {language === 'hi' ? 'वॉल्ट से गिरवी रखें' : 'Pledge from Vault'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Listings Grid */}
      {viewMode === 'list' && !loading && listings.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {listings.map((listing) => (
            <motion.div
              key={listing.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md"
              onClick={() => { setSelectedListing(listing); setViewMode('detail'); }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{listing.groupName}</h3>
                  <span className="text-sm text-forest-600 bg-forest-50 px-2 py-1 rounded-full">
                    {listing.crop}
                  </span>
                </div>
                <span className={clsx('text-xs px-2 py-1 rounded-full', getDeadlineStatus(listing.deadline).class)}>
                  {getDeadlineStatus(listing.deadline).text}
                </span>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium">{listing.currentQuantity}/{listing.quantity} quintals</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${getProgress(listing)}%` }}
                    className={clsx('h-3 rounded-full', getProgress(listing) >= 100 ? 'bg-green-500' : 'bg-forest-500')}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <IndianRupee className="w-4 h-4" />
                  <span>{formatPrice(listing.minPrice)} - {formatPrice(listing.maxPrice)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>Max {listing.maxMembers}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Create Group Listing</h2>
                <button onClick={() => setShowCreateModal(false)}><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Group Name *</label>
                  <input
                    type="text"
                    value={createForm.groupName}
                    onChange={e => setCreateForm({ ...createForm, groupName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                    placeholder="e.g. Varanasi Farmers Union"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Crop *</label>
                    <select
                      value={createForm.crop}
                      onChange={e => setCreateForm({ ...createForm, crop: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                    >
                      <option value="">-- Select --</option>
                      {CROP_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity (quintals)</label>
                    <input
                      type="number"
                      value={createForm.quantity}
                      onChange={e => setCreateForm({ ...createForm, quantity: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Min Price (₹)</label>
                    <input
                      type="number"
                      value={createForm.minPrice}
                      onChange={e => setCreateForm({ ...createForm, minPrice: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Max Price (₹)</label>
                    <input
                      type="number"
                      value={createForm.maxPrice}
                      onChange={e => setCreateForm({ ...createForm, maxPrice: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={createForm.deliveryDate}
                    onChange={e => setCreateForm({ ...createForm, deliveryDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Registration Deadline</label>
                  <input
                    type="date"
                    value={createForm.deadline}
                    onChange={e => setCreateForm({ ...createForm, deadline: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateListing}
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-xl bg-forest-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join Modal */}
      <AnimatePresence>
        {showJoinModal && selectedListing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowJoinModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Join: {selectedListing.groupName}</h2>
                <button onClick={() => setShowJoinModal(false)}><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Your Quantity (quintals)</label>
                  <input
                    type="number"
                    value={joinForm.quantity}
                    onChange={e => setJoinForm({ ...joinForm, quantity: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Your Price (₹/quintal)</label>
                  <input
                    type="number"
                    value={joinForm.pricePerUnit}
                    onChange={e => setJoinForm({ ...joinForm, pricePerUnit: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowJoinModal(false)} className="flex-1 py-3 rounded-xl border">Cancel</button>
                <button
                  onClick={handleJoinListing}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-forest-600 text-white disabled:opacity-50"
                >
                  {saving ? '...' : 'Join'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail View */}
      {viewMode === 'detail' && selectedListing && (
        <div className="space-y-6">
          <button onClick={() => { setViewMode('list'); setSelectedListing(null); }} className="text-forest-600">
            ← Back to Listings
          </button>

          <div className="bg-white rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-4">{selectedListing.groupName}</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-500">Crop</p>
                <p className="font-bold">{selectedListing.crop}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-500">Price Range</p>
                <p className="font-bold">₹{selectedListing.minPrice} - ₹{selectedListing.maxPrice}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-500">Progress</p>
                <p className="font-bold">{selectedListing.currentQuantity}/{selectedListing.quantity} q</p>
              </div>
            </div>

            {user && user.uid !== selectedListing.organizerId && selectedListing.status === 'active' && (
              <button
                onClick={() => setShowJoinModal(true)}
                className="w-full py-4 bg-forest-600 text-white rounded-xl font-bold"
              >
                Join This Listing
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pledge DWR Modal */}
      <AnimatePresence>
        {showPledgeModal && selectedContract && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowPledgeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold">
                    {language === 'hi' ? 'वॉल्ट से गिरवी रखें' : 'Pledge from Vault'}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedContract.buyerOrganization}</p>
                </div>
                <button onClick={() => setShowPledgeModal(false)}><X className="w-5 h-5" /></button>
              </div>

              <div className="bg-indigo-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold">{selectedContract.crop}</span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {selectedContract.targetQuantity - selectedContract.committedQuantity} tons available
                </div>
              </div>

              {receiptsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                </div>
              ) : availableReceipts.length === 0 ? (
                <div className="text-center py-8">
                  <Warehouse className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">
                    {language === 'hi'
                      ? 'इस फसल के लिए कोई उपलब्ध रसीद नहीं'
                      : 'No available receipts for this crop'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {language === 'hi'
                      ? 'पहले गोदाम में अपनी उपज जमा करें'
                      : 'Deposit your produce in a warehouse first'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 mb-4">
                  <p className="text-sm font-medium text-gray-700">
                    {language === 'hi' ? 'अपनी रसीद चुनें:' : 'Select your receipt:'}
                  </p>
                  {availableReceipts.map((receipt) => (
                    <div
                      key={receipt.id}
                      onClick={() => setSelectedReceipt(receipt)}
                      className={clsx(
                        'p-4 rounded-xl border-2 cursor-pointer transition-all',
                        selectedReceipt?.id === receipt.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{receipt.warehouseName}</p>
                          <p className="text-sm text-gray-500">{receipt.crop} - {receipt.quantity} tons</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-indigo-600">₹{(receipt.marketValueAtDeposit || receipt.totalCost).toLocaleString()}</p>
                          <p className="text-xs text-gray-500">{receipt.warehouseLocation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPledgeModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200"
                >
                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  onClick={handlePledge}
                  disabled={!selectedReceipt || pledging}
                  className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {pledging ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  {language === 'hi' ? 'गिरवी रखें' : 'Pledge'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}