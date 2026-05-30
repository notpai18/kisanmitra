import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, isMockConfig } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, onSnapshot, orderBy, limit, getDoc } from '../lib/firebase';
import { Building2, Plus, Package, IndianRupee, MapPin, Calendar, Users, TrendingUp, CheckCircle, X, ArrowRight, Loader2, Percent, Banknote, Warehouse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { groupListingService } from '../lib/GroupListingService';

const CROP_OPTIONS = ['Wheat', 'Rice', 'Maize', 'Sugarcane', 'Potato', 'Tomato', 'Soybean', 'Mustard', 'Cotton', 'Pulses'];
const GRADE_OPTIONS = ['Grade A (Premium)', 'Grade B (Standard)', 'Grade C (Basic)'];

interface CorporateContract {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerOrganization: string;
  crop: string;
  variety?: string;
  grade: string;
  targetQuantity: number; // in tons
  unitPrice: number; // price per ton in INR
  deliveryLocation: string;
  deliveryDate: string;
  status: 'open' | 'partial' | 'fulfilled' | 'expired';
  committedQuantity: number;
  createdAt: any;
}

interface ContractCommit {
  id: string;
  contractId: string;
  agentId: string;
  agentName: string;
  farmerName: string;
  farmerId: string;
  quantity: number;
  status: 'pending' | 'confirmed' | 'delivered';
  createdAt: any;
}

interface CreateContractForm {
  buyerOrganization: string;
  crop: string;
  variety: string;
  grade: string;
  targetQuantity: number;
  unitPrice: number;
  deliveryLocation: string;
  deliveryDate: string;
}

interface CommitForm {
  quantity: number;
  farmerName: string;
  notes: string;
}

// Platform commission rate
const PLATFORM_COMMISSION_RATE = 0.03; // 3%

export default function CorporateContracts() {
  const { user, userData, isVillageAgent } = useAuth();
  const { language } = useLanguage();
  const [contracts, setContracts] = useState<CorporateContract[]>([]);
  const [myCommits, setMyCommits] = useState<ContractCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'my-commits' | 'pledged-receipts'>('list');
  const [selectedContract, setSelectedContract] = useState<CorporateContract | null>(null);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successCommit, setSuccessCommit] = useState<{ quantity: number; totalValue: number; commission: number; netEarnings: number } | null>(null);

  // Buyer pledged receipts view
  const [buyerCommits, setBuyerCommits] = useState<any[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);

  const [createForm, setCreateForm] = useState<CreateContractForm>({
    buyerOrganization: '',
    crop: '',
    variety: '',
    grade: 'Grade A (Premium)',
    targetQuantity: 50,
    unitPrice: 2000,
    deliveryLocation: '',
    deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const [commitForm, setCommitForm] = useState<CommitForm>({
    quantity: 1,
    farmerName: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  // Real-time listener for contracts
  useEffect(() => {
    setLoading(true);
    if (isMockConfig) {
      setContracts(getMockContracts());
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'corporateContracts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CorporateContract));
      setContracts(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load my commits for village agents
  useEffect(() => {
    if (!user || !isVillageAgent) return;
    if (isMockConfig) {
      setMyCommits(getMockCommits());
      return;
    }

    const q = query(
      collection(db, 'contractCommits'),
      where('agentId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ContractCommit));
      setMyCommits(data);
    });

    return () => unsubscribe();
  }, [user, isVillageAgent]);

  // Load buyer committed receipts for fulfilled contracts
  useEffect(() => {
    if (!user || userData?.role !== 'buyer') return;

    setCommitsLoading(true);
    groupListingService.getContractCommitsByBuyer(user.uid)
      .then(commits => {
        setBuyerCommits(commits);
      })
      .catch(err => console.error('Error fetching buyer commits:', err))
      .finally(() => setCommitsLoading(false));
  }, [user, userData?.role]);

  const getMockContracts = (): CorporateContract[] => [
    {
      id: 'c1',
      buyerId: 'buyer1',
      buyerName: 'Food Corp Ltd',
      buyerOrganization: 'Food Corp Ltd',
      crop: 'Wheat',
      variety: 'HD 2329',
      grade: 'Grade A (Premium)',
      targetQuantity: 100,
      unitPrice: 2200,
      deliveryLocation: 'Lucknow, UP',
      deliveryDate: '2026-06-30',
      status: 'open',
      committedQuantity: 25,
      createdAt: { seconds: Date.now() / 1000 },
    },
    {
      id: 'c2',
      buyerId: 'buyer2',
      buyerName: 'Agro Industries',
      buyerOrganization: 'Agro Industries Pvt Ltd',
      crop: 'Rice',
      variety: 'Basmati 1509',
      grade: 'Grade A (Premium)',
      targetQuantity: 50,
      unitPrice: 2800,
      deliveryLocation: 'Varanasi, UP',
      deliveryDate: '2026-07-15',
      status: 'partial',
      committedQuantity: 30,
      createdAt: { seconds: Date.now() / 1000 },
    },
    {
      id: 'c3',
      buyerId: 'buyer3',
      buyerName: 'Sugar Mills Co',
      buyerOrganization: 'UP Sugar Mills Co',
      crop: 'Sugarcane',
      grade: 'Grade B (Standard)',
      targetQuantity: 200,
      unitPrice: 3500,
      deliveryLocation: 'Gorakhpur, UP',
      deliveryDate: '2026-05-30',
      status: 'open',
      committedQuantity: 0,
      createdAt: { seconds: Date.now() / 1000 },
    },
  ];

  const getMockCommits = (): ContractCommit[] => [
    {
      id: 'm1',
      contractId: 'c1',
      agentId: 'agent1',
      agentName: 'Ramesh Kumar',
      farmerId: 'farmer1',
      farmerName: 'Ram Singh',
      quantity: 5,
      status: 'confirmed',
      createdAt: { seconds: Date.now() / 1000 },
    },
  ];

  const handleCreateContract = async () => {
    if (!user || !userData) return;

    // Validation
    if (!createForm.buyerOrganization || !createForm.crop || !createForm.deliveryLocation) {
      toast.error(language === 'hi' ? 'कृपया सभी आवश्यक फ़ील्ड भरें' : 'Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      if (isMockConfig) {
        const newContract: CorporateContract = {
          id: 'mock-' + Date.now(),
          buyerId: user.uid,
          buyerName: userData.name,
          buyerOrganization: createForm.buyerOrganization,
          crop: createForm.crop,
          variety: createForm.variety,
          grade: createForm.grade,
          targetQuantity: createForm.targetQuantity,
          unitPrice: createForm.unitPrice,
          deliveryLocation: createForm.deliveryLocation,
          deliveryDate: createForm.deliveryDate,
          status: 'open',
          committedQuantity: 0,
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        };
        setContracts([newContract, ...contracts]);
        toast.success(language === 'hi' ? 'अनुबंध बनाया गया' : 'Contract created');
        setViewMode('list');
      } else {
        await addDoc(collection(db, 'corporateContracts'), {
          buyerId: user.uid,
          buyerName: userData.name,
          buyerOrganization: createForm.buyerOrganization,
          crop: createForm.crop,
          variety: createForm.variety,
          grade: createForm.grade,
          targetQuantity: createForm.targetQuantity,
          unitPrice: createForm.unitPrice,
          deliveryLocation: createForm.deliveryLocation,
          deliveryDate: createForm.deliveryDate,
          status: 'open',
          committedQuantity: 0,
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        });
        toast.success(language === 'hi' ? 'अनुबंध बनाया गया' : 'Contract created');
        setViewMode('list');
      }
    } catch (err) {
      console.error('Error creating contract:', err);
      toast.error(language === 'hi' ? 'त्रुटि' : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleCommit = async () => {
    if (!user || !userData || !selectedContract || !isVillageAgent) return;

    if (!commitForm.farmerName || commitForm.quantity <= 0) {
      toast.error(language === 'hi' ? 'कृपया मात्रा और किसान का नाम दर्ज करें' : 'Please enter quantity and farmer name');
      return;
    }

    // Check if commit exceeds remaining
    const remaining = selectedContract.targetQuantity - selectedContract.committedQuantity;
    if (commitForm.quantity > remaining) {
      toast.error(language === 'hi' ? `अधिकतम ${remaining} टन तक ही कर सकते हैं` : `Maximum ${remaining} tons available`);
      return;
    }

    setSaving(true);
    try {
      // Calculate commission for display
      const totalValue = commitForm.quantity * selectedContract.unitPrice;
      const commission = totalValue * PLATFORM_COMMISSION_RATE;
      const netEarnings = totalValue - commission;

      if (isMockConfig) {
        // Update contract committed quantity
        const updatedContracts = contracts.map(c => {
          if (c.id === selectedContract.id) {
            return { ...c, committedQuantity: c.committedQuantity + commitForm.quantity };
          }
          return c;
        });
        setContracts(updatedContracts);

        // Add commit
        const newCommit: ContractCommit = {
          id: 'mock-commit-' + Date.now(),
          contractId: selectedContract.id,
          agentId: user.uid,
          agentName: userData.name,
          farmerName: commitForm.farmerName,
          farmerId: currentFarmerId || user.uid,
          quantity: commitForm.quantity,
          status: 'confirmed',
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        };
        setMyCommits([newCommit, ...myCommits]);
      } else {
        // Update contract
        await updateDoc(doc(db, 'corporateContracts', selectedContract.id), {
          committedQuantity: selectedContract.committedQuantity + commitForm.quantity,
        });

        // Add commit record
        await addDoc(collection(db, 'contractCommits'), {
          contractId: selectedContract.id,
          agentId: user.uid,
          agentName: userData.name,
          farmerName: commitForm.farmerName,
          farmerId: currentFarmerId || user.uid,
          quantity: commitForm.quantity,
          status: 'confirmed',
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        });
      }

      // Show success modal with commission details
      setSuccessCommit({
        quantity: commitForm.quantity,
        totalValue,
        commission,
        netEarnings,
      });
      setShowSuccessModal(true);
      setShowCommitModal(false);
      setCommitForm({ quantity: 1, farmerName: '', notes: '' });

    } catch (err) {
      console.error('Error committing:', err);
      toast.error(language === 'hi' ? 'त्रुटि' : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const { currentFarmerId } = useAuth();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-yellow-100 text-yellow-700';
      case 'fulfilled': return 'bg-blue-100 text-blue-700';
      case 'expired': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, Record<string, string>> = {
      open: { en: 'Open', hi: 'खुला' },
      partial: { en: 'Partial', hi: 'आंशिक' },
      fulfilled: { en: 'Fulfilled', hi: 'पूर्ण' },
      expired: { en: 'Expired', hi: 'समाप्त' },
    };
    return labels[status]?.[language] || status;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-devanagari">
                {language === 'en' ? 'Corporate Contracts' : 'कॉर्पोरेट अनुबंध'}
              </h1>
              <p className="text-gray-500 font-devanagari">
                {language === 'en'
                  ? 'Institutional buyers & bulk procurement'
                  : 'संस्थागत खरीदार & थोक खरीद'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            {userData?.role === 'buyer' && (
              <button
                onClick={() => setViewMode('create')}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors"
              >
                <Plus className="w-5 h-5" />
                {language === 'hi' ? 'नया अनुबंध' : 'New Contract'}
              </button>
            )}
            {isVillageAgent && (
              <button
                onClick={() => setViewMode('my-commits')}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-colors',
                  viewMode === 'my-commits'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <Users className="w-5 h-5" />
                {language === 'hi' ? 'मेरी प्रतिबद्धताएं' : 'My Commits'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create Contract Form */}
      {viewMode === 'create' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-lg"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            {language === 'hi' ? 'नया अनुबंध बनाएं' : 'Create New Contract'}
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'कंपनी/संस्था का नाम *' : 'Company/Organization Name *'}
              </label>
              <input
                type="text"
                value={createForm.buyerOrganization}
                onChange={(e) => setCreateForm({ ...createForm, buyerOrganization: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder={language === 'hi' ? 'जैसे: ABC Foods Ltd' : 'e.g., ABC Foods Ltd'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'फसल *' : 'Crop *'}
              </label>
              <select
                value={createForm.crop}
                onChange={(e) => setCreateForm({ ...createForm, crop: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">{language === 'hi' ? 'फसल चुनें' : 'Select crop'}</option>
                {CROP_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'विवरण' : 'Variety'}
              </label>
              <input
                type="text"
                value={createForm.variety}
                onChange={(e) => setCreateForm({ ...createForm, variety: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder={language === 'hi' ? 'जैसे: HD 2329' : 'e.g., HD 2329'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'ग्रेड' : 'Grade'}
              </label>
              <select
                value={createForm.grade}
                onChange={(e) => setCreateForm({ ...createForm, grade: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'मात्रा (टन) *' : 'Quantity (tons) *'}
              </label>
              <input
                type="number"
                min="1"
                value={createForm.targetQuantity}
                onChange={(e) => setCreateForm({ ...createForm, targetQuantity: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'प्रति टन दर (₹) *' : 'Price per ton (₹) *'}
              </label>
              <input
                type="number"
                min="1"
                value={createForm.unitPrice}
                onChange={(e) => setCreateForm({ ...createForm, unitPrice: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'डिलीवरी स्थान *' : 'Delivery Location *'}
              </label>
              <input
                type="text"
                value={createForm.deliveryLocation}
                onChange={(e) => setCreateForm({ ...createForm, deliveryLocation: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder={language === 'hi' ? 'जैसे: लखनऊ, UP' : 'e.g., Lucknow, UP'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'डिलीवरी तिथि' : 'Delivery Date'}
              </label>
              <input
                type="date"
                value={createForm.deliveryDate}
                onChange={(e) => setCreateForm({ ...createForm, deliveryDate: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <button
              onClick={() => setViewMode('list')}
              className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
            <button
              onClick={handleCreateContract}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              {language === 'hi' ? 'अनुबंध बनाएं' : 'Create Contract'}
            </button>
          </div>
        </motion.div>
      )}

      {/* My Commits View */}
      {viewMode === 'my-commits' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            {language === 'hi' ? 'मेरी प्रतिबद्धताएं' : 'My Commits'}
          </h2>

          {myCommits.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{language === 'hi' ? 'कोई प्रतिबद्धता नहीं' : 'No commits yet'}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {myCommits.map((commit) => {
                const contract = contracts.find(c => c.id === commit.contractId);
                const totalValue = commit.quantity * (contract?.unitPrice || 0);
                const commission = totalValue * PLATFORM_COMMISSION_RATE;
                const netEarnings = totalValue - commission;

                return (
                  <motion.div
                    key={commit.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={clsx(
                        'px-3 py-1 rounded-full text-xs font-bold',
                        commit.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          commit.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                      )}>
                        {commit.status.charAt(0).toUpperCase() + commit.status.slice(1)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(commit.createdAt.seconds * 1000).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900">{contract?.crop}</h3>
                    <p className="text-sm text-gray-500 mb-3">{contract?.buyerOrganization}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span>{commit.quantity} tons</span>
                      <div className="text-right">
                        <div className="font-bold text-green-700">₹{netEarnings.toLocaleString()}</div>
                        <div className="text-xs text-gray-400">-₹{commission.toLocaleString()} (3% fee)</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Pledged Warehouse Receipts View (for Buyers) */}
      {viewMode === 'pledged-receipts' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-green-600" />
              {language === 'hi' ? 'गिरवी रसीदें' : 'Pledged Warehouse Receipts'}
            </h2>
            <button
              onClick={() => setViewMode('list')}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              ← {language === 'hi' ? 'वापस' : 'Back'}
            </button>
          </div>

          {selectedContract && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-600 font-medium">
                {language === 'hi' ? 'अनुबंध:' : 'Contract:'} {selectedContract.crop} - {selectedContract.buyerOrganization}
              </p>
              <p className="text-lg font-bold text-gray-900">
                {selectedContract.committedQuantity} tons {language === 'hi' ? 'सुरक्षित' : 'secured'}
              </p>
            </div>
          )}

          {commitsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
          ) : buyerCommits.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
              <Warehouse className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {language === 'hi' ? 'कोई गिरवी रसीद नहीं मिली' : 'No pledged receipts found'}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {buyerCommits.map((commit) => (
                <motion.div
                  key={commit.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
                >
                  {commit.receipt ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Warehouse className="w-5 h-5 text-green-600" />
                          <span className="font-bold text-gray-900">{commit.receipt.warehouseName}</span>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          {language === 'hi' ? 'गिरवी में' : 'Pledged'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">{language === 'hi' ? 'फसल' : 'Crop'}</span>
                          <span className="font-semibold">{commit.receipt.crop}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">{language === 'hi' ? 'मात्रा' : 'Quantity'}</span>
                          <span className="font-semibold">{commit.quantity} tons</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">{language === 'hi' ? 'स्थान' : 'Location'}</span>
                          <span className="font-semibold">{commit.receipt.warehouseLocation}</span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">{language === 'hi' ? 'मूल्य' : 'Value'}</span>
                            <span className="font-bold text-green-600">
                              ₹{(commit.receipt.marketValueAtDeposit || commit.receipt.totalCost || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-500 text-sm">
                      {language === 'hi' ? 'रसीद विवरण उपलब्ध नहीं' : 'Receipt details unavailable'}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Contracts List */}
      {viewMode === 'list' && (
        <div className="grid gap-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : contracts.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{language === 'hi' ? 'कोई अनुबंध नहीं मिला' : 'No contracts found'}</p>
            </div>
          ) : (
            contracts.map((contract, index) => {
              const progress = (contract.committedQuantity / contract.targetQuantity) * 100;
              const remaining = contract.targetQuantity - contract.committedQuantity;
              const isExpired = new Date(contract.deliveryDate) < new Date();

              return (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={clsx(
                    'bg-white rounded-3xl p-6 md:p-8 border shadow-lg overflow-hidden relative',
                    contract.status === 'fulfilled' ? 'border-green-200' :
                      isExpired ? 'border-gray-200 opacity-75' :
                        'border-gray-100'
                  )}
                >
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    <span className={clsx('px-3 py-1 rounded-full text-xs font-bold', getStatusColor(contract.status))}>
                      {getStatusLabel(contract.status)}
                    </span>
                  </div>

                  {/* Header */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                        <span className="text-indigo-600 font-semibold">{contract.buyerOrganization}</span>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        {contract.crop}
                        {contract.variety && (
                          <span className="text-sm font-normal text-gray-500">- {contract.variety}</span>
                        )}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {contract.grade}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-900">₹{contract.unitPrice.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">per ton</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">
                        {language === 'hi' ? 'प्रगति' : 'Progress'}
                      </span>
                      <span className="font-bold text-gray-900">
                        {contract.committedQuantity} / {contract.targetQuantity} tons
                      </span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
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
                      <p className="text-sm text-gray-500 mt-2">
                        {remaining} tons {language === 'hi' ? 'शेष' : 'remaining'}
                      </p>
                    )}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <Package className="w-4 h-4" />
                        <span className="text-xs">{language === 'hi' ? 'कुल मात्रा' : 'Total Qty'}</span>
                      </div>
                      <div className="font-bold text-gray-900">{contract.targetQuantity} tons</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <IndianRupee className="w-4 h-4" />
                        <span className="text-xs">{language === 'hi' ? 'कुल मूल्य' : 'Total Value'}</span>
                      </div>
                      <div className="font-bold text-gray-900">₹{(contract.targetQuantity * contract.unitPrice).toLocaleString()}</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs">{language === 'hi' ? 'डिलीवरी' : 'Delivery'}</span>
                      </div>
                      <div className="font-bold text-gray-900">{contract.deliveryLocation}</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs">{language === 'hi' ? 'तिथि' : 'Date'}</span>
                      </div>
                      <div className="font-bold text-gray-900">{new Date(contract.deliveryDate).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* Commit Button for Village Agents */}
                  {isVillageAgent && contract.status !== 'fulfilled' && remaining > 0 && !isExpired && (
                    <button
                      onClick={() => {
                        setSelectedContract(contract);
                        setShowCommitModal(true);
                      }}
                      className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                    >
                      <TrendingUp className="w-5 h-5" />
                      {language === 'hi' ? 'अपने किसानों से प्रतिबद्ध करें' : 'Commit from your farmers'}
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  )}

                  {/* View Pledged Warehouse Receipts for Buyers */}
                  {userData?.role === 'buyer' && contract.status === 'fulfilled' && (
                    <button
                      onClick={() => {
                        setSelectedContract(contract);
                        setViewMode('pledged-receipts');
                      }}
                      className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20"
                    >
                      <Warehouse className="w-5 h-5" />
                      {language === 'hi' ? 'गिरवी रसीदें देखें' : 'View Pledged Warehouse Receipts'}
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Commit Modal */}
      <AnimatePresence>
        {showCommitModal && selectedContract && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
              onClick={() => setShowCommitModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-50 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {language === 'hi' ? 'प्रतिबद्धता करें' : 'Commit Quantity'}
                </h3>
                <button
                  onClick={() => setShowCommitModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-indigo-50 rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-1">{selectedContract.crop}</div>
                  <div className="font-bold text-gray-900">{selectedContract.buyerOrganization}</div>
                  <div className="text-sm text-gray-500">
                    {selectedContract.targetQuantity - selectedContract.committedQuantity} tons available
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'hi' ? 'मात्रा (टन) *' : 'Quantity (tons) *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedContract.targetQuantity - selectedContract.committedQuantity}
                    value={commitForm.quantity}
                    onChange={(e) => setCommitForm({ ...commitForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'hi' ? 'किसान का नाम *' : 'Farmer Name *'}
                  </label>
                  <input
                    type="text"
                    value={commitForm.farmerName}
                    onChange={(e) => setCommitForm({ ...commitForm, farmerName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    placeholder={language === 'hi' ? 'जैसे: राम सिंह' : 'e.g., Ram Singh'}
                  />
                </div>

                {/* Commission Info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Percent className="w-4 h-4" />
                    {language === 'hi' ? 'अनुमानित आय (3% प्लेटफॉर्म फीस के बाद)' : 'Estimated earnings (after 3% platform fee)'}
                  </div>
                  <div className="text-2xl font-bold text-green-700">
                    ₹{((commitForm.quantity * selectedContract.unitPrice) * (1 - PLATFORM_COMMISSION_RATE)).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    -₹{((commitForm.quantity * selectedContract.unitPrice) * PLATFORM_COMMISSION_RATE).toLocaleString()} {language === 'hi' ? 'प्लेटफॉर्म फीस' : 'platform fee'}
                  </div>
                </div>

                <button
                  onClick={handleCommit}
                  disabled={saving || commitForm.quantity <= 0 || !commitForm.farmerName}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  {language === 'hi' ? 'प्रतिबद्धता की पुष्टि करें' : 'Confirm Commitment'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Success Modal with Commission Details */}
      <AnimatePresence>
        {showSuccessModal && successCommit && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-md z-50"
              onClick={() => setShowSuccessModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl shadow-2xl z-50 p-8 text-center"
            >
              {/* Animated Checkmark */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-24 h-24 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-6"
              >
                <motion.div
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="w-12 h-12"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                    <motion.path
                      d="M5 12l5 5L20 7"
                      stroke="#16a34a"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.4, duration: 0.5 }}
                    />
                  </svg>
                </motion.div>
              </motion.div>

              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-gray-900 mb-2"
              >
                {language === 'hi' ? 'प्रतिबद्धता सफल!' : 'Commitment Successful!'}
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-gray-600 mb-6"
              >
                {language === 'hi'
                  ? `${successCommit.quantity} टन ${selectedContract?.crop} के लिए प्रतिबद्ध`
                  : `${successCommit.quantity} tons committed for ${selectedContract?.crop}`}
              </motion.p>

              {/* Earnings Breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100 mb-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-600">{language === 'hi' ? 'कुल मूल्य' : 'Total Value'}</span>
                  <span className="font-bold text-gray-900">₹{successCommit.totalValue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-green-200">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Percent className="w-4 h-4" />
                    {language === 'hi' ? '3% प्लेटफॉर्म फीस' : '3% Platform Fee'}
                  </span>
                  <span className="text-red-600">-₹{successCommit.commission.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{language === 'hi' ? 'शुद्ध आय' : 'Net Earnings'}</span>
                  <span className="text-2xl font-bold text-green-700">₹{successCommit.netEarnings.toLocaleString()}</span>
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors"
              >
                {language === 'hi' ? 'ठीक है' : 'Done'}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}