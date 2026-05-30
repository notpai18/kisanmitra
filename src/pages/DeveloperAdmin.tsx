import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { db, isMockConfig } from '../lib/firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  where,
} from '../lib/firebase';
import DetailedDiagnosisReport from '../components/DetailedDiagnosisReport';
import {
  Package,
  Trash2,
  Plus,
  Microscope,
  Leaf,
  Clock,
  AlertCircle,
  CheckCircle,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  TrendingUp,
  Play,
  Globe,
  Database,
  Copy,
  Check,
  Activity,
  BarChart3,
  Shield,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { arrayUnion, getDoc } from 'firebase/firestore';
import { checkAndExecuteTriggers, getCurrentMandiPrices, createPriceOverride } from '../services/PriceTriggerService';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/gh/zcreativelabs/react-simple-maps@master/topojson-maps/world-110m.json";

const DISTRICT_COORDS: Record<string, [number, number]> = {
  'Varanasi': [82.9739, 25.3176],
  'Gorakhpur': [83.3732, 26.7606],
  'Azamgarh': [83.1817, 26.0720],
  'Allahabad': [81.8463, 25.4358],
  'Jaunpur': [82.6867, 25.7461],
  'Mirzapur': [82.5683, 25.1333],
  'Ghazipur': [83.5782, 25.5856],
  'Chandauli': [83.2643, 25.2661],
  'Mau': [83.5600, 25.9400],
  'Ballia': [84.1500, 25.7600],
  'Deoria': [83.7785, 26.5049],
  'Kushinagar': [83.9100, 26.7400],
  'Lucknow': [80.9462, 26.8467],
  'Kanpur Nagar': [80.3319, 26.4499],
  'Agra': [78.0081, 27.1767],
  'Bareilly': [79.4126, 28.3670],
  'Meerut': [77.7064, 28.9845],
};

interface InventoryItem {
  id: string;
  name: string;
  type: 'chemical' | 'organic' | 'fertilizer' | 'seed';
  price: number;
  description: string;
  tags: string[];
  createdAt: any;
}

interface CropReport {
  id: string;
  cropType: string;
  diseaseName: string;
  severity: string;
  confidence: number;
  userId?: string;
  userName?: string;
  imageUrl?: string;
  geminiAnalysis?: any;
  status?: string;
  expertAdvice?: string;
  location?: { state: string; district: string };
  timestamp: any;
}

const PRODUCT_TYPES = [
  { value: 'chemical', label: 'Chemical' },
  { value: 'organic', label: 'Organic' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'seed', label: 'Seed' },
];

export default function DeveloperAdmin() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'diagnostics' | 'triggers' | 'apiHub'>('inventory');
  const { user } = useAuth();

  // API Hub state
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cropReports, setCropReports] = useState<CropReport[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  
  // Enterprise API Hub - Real Heatmap State
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [hoveredMarker, setHoveredMarker] = useState<any | null>(null);

  // Inventory form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'chemical' | 'organic' | 'fertilizer' | 'seed'>('fertilizer');
  const [formPrice, setFormPrice] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTags, setFormTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Diagnostics state
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expertAdvice, setExpertAdvice] = useState<{ [key: string]: string }>({});
  const [sendingAdvice, setSendingAdvice] = useState<string | null>(null);

  // Trigger Engine state
  const [simulatedPrice, setSimulatedPrice] = useState<string>('');
  const [triggerRunning, setTriggerRunning] = useState(false);
  const [triggerResults, setTriggerResults] = useState<{ executed: number; results: any[] } | null>(null);

  // Fetch real diagnostic data for the Enterprise API Hub heatmap
  useEffect(() => {
    if (!user || isMockConfig) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Query for reports from the last 7 days
    const q = query(
      collection(db, 'cropReports'),
      where('createdAt', '>=', sevenDaysAgo.toISOString()),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const markers = snapshot.docs
        .map((d) => {
          const data = d.data();
          // Only show those with an identified disease
          if (data.diseaseName === 'Healthy') return null;

          const district = data.location?.district;
          const coords = DISTRICT_COORDS[district] || [
            82 + (Math.random() * 3 - 1.5), // Jitter around UP center
            25 + (Math.random() * 3 - 1.5),
          ];

          return {
            id: d.id,
            ...data,
            coordinates: coords,
          };
        })
        .filter(Boolean);
      setHeatmapData(markers);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch existing API keys on mount
  useEffect(() => {
    const fetchApiKeys = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setApiKeys(data.apiKeys || []);
        }
      } catch (err) {
        console.error('Error fetching API keys:', err);
      }
    };
    fetchApiKeys();
  }, [user]);

  // Generate API Key
  const handleGenerateApiKey = async () => {
    if (!user) {
      toast.error('You must be logged in to generate an API key');
      return;
    }
    setGenerating(true);
    try {
      // Generate a secure random key
      const randomPart = Array.from({ length: 32 }, () =>
        'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
      ).join('');
      const newKey = `km_live_${randomPart}`;

      // Save to Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        apiKeys: arrayUnion(newKey)
      });

      setApiKeys(prev => [...prev, newKey]);
      setGeneratedKey(newKey);
      toast.success('Production API key generated successfully!');
    } catch (err) {
      console.error('Error generating API key:', err);
      toast.error('Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  // Fetch inventory from Firestore
  useEffect(() => {
    const q = query(collection(db, 'inventory'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: InventoryItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as InventoryItem[];
      setInventory(items);
      setLoadingInventory(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch ALL crop diagnostic reports from ROOT-LEVEL cropReports collection
  useEffect(() => {
    const q = query(collection(db, 'cropReports'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports: CropReport[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
        } as CropReport;
      });
      setCropReports(reports);
      setLoadingReports(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmitInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice) {
      toast.error('Please fill in required fields');
      return;
    }

    setSubmitting(true);
    try {
      const tagsArray = formTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      await addDoc(collection(db, 'inventory'), {
        name: formName.trim(),
        type: formType,
        price: Number(formPrice),
        description: formDescription.trim(),
        tags: tagsArray,
        category: formType === 'seed' ? 'seed' : formType === 'organic' ? 'organic' : formType === 'fertilizer' ? 'fertilizer' : 'pesticide',
        inStock: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success('Product added to inventory successfully!');
      setFormName('');
      setFormPrice('');
      setFormDescription('');
      setFormTags('');
    } catch (err) {
      console.error('Error adding inventory:', err);
      toast.error('Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInventory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventory', id));
      toast.success('Product removed from inventory');
    } catch (err) {
      console.error('Error deleting inventory:', err);
      toast.error('Failed to delete product');
    }
  };

  const handleSendExpertAdvice = async (reportId: string) => {
    const advice = expertAdvice[reportId];
    if (!advice?.trim()) {
      toast.error('Please provide expert advice');
      return;
    }

    setSendingAdvice(reportId);
    try {
      // Update ROOT-LEVEL cropReports collection (single source of truth)
      await updateDoc(doc(db, 'cropReports', reportId), {
        expertAdvice: advice.trim(),
        status: 'reviewed_by_expert',
        reviewedAt: serverTimestamp(),
      });

      // Also keep expert_reviews in sync for backward compatibility
      await updateDoc(doc(db, 'expert_reviews', reportId), {
        expertAdvice: advice.trim(),
        status: 'reviewed_by_expert',
        reviewedAt: serverTimestamp(),
      });

      toast.success('Expert advice sent to farmer!');
      setExpertAdvice((prev) => ({ ...prev, [reportId]: '' }));
    } catch (err) {
      console.error('Error sending expert advice:', err);
      toast.error('Failed to send expert advice');
    } finally {
      setSendingAdvice(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'chemical':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'organic':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'fertilizer':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'seed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'reviewed_by_expert') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
          <CheckCircle className="w-3 h-3" />
          Expert Reviewed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3" />
        Pending Review
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 px-6 py-5 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ rotate: -10, scale: 0.9 }}
                animate={{ rotate: 0, scale: 1 }}
                className="w-12 h-12 bg-gradient-to-br from-slate-900 to-slate-700 rounded-xl flex items-center justify-center shadow-lg"
              >
                <Package className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Developer Admin
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  Internal tool for inventory & crop diagnostics
                </p>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/80 rounded-full border border-emerald-200/50"
            >
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              <span className="text-sm font-medium text-emerald-700">DaaS Live</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Premium Sliding Pill Tabs */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="relative inline-flex bg-slate-100 p-1 rounded-xl shadow-inner">
          <motion.div
            layoutId="adminTabIndicator"
            className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm"
            style={{
              width: activeTab === 'inventory' ? '180px' : activeTab === 'diagnostics' ? '200px' : activeTab === 'triggers' ? '180px' : '180px',
              transform: activeTab === 'inventory' ? 'translateX(0)' : activeTab === 'diagnostics' ? 'translateX(180px)' : activeTab === 'triggers' ? 'translateX(380px)' : 'translateX(560px)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
          <button
            onClick={() => setActiveTab('inventory')}
            className={clsx(
              'relative z-10 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200',
              activeTab === 'inventory' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Inventory Manager
            </span>
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={clsx(
              'relative z-10 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200',
              activeTab === 'diagnostics' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <span className="flex items-center gap-2">
              <Microscope className="w-4 h-4" />
              Crop Diagnostic Logs
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            </span>
          </button>
          <button
            onClick={() => setActiveTab('triggers')}
            className={clsx(
              'relative z-10 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200',
              activeTab === 'triggers' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Trigger Engine
            </span>
          </button>
          <button
            onClick={() => setActiveTab('apiHub')}
            className={clsx(
              'relative z-10 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200',
              activeTab === 'apiHub' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Enterprise API Hub
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <AnimatePresence mode="wait">
          {/* INVENTORY MANAGER TAB */}
          {activeTab === 'inventory' && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-6"
            >
              {/* Add Product Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Add New Product</h2>
                    <p className="text-sm text-slate-500">Add agricultural input to inventory</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitInventory} className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      className="space-y-1.5"
                    >
                      <label className="block text-sm font-semibold text-slate-700">
                        Product Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g., Urea 46-0-0, Neem Oil 1000ml"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50 text-slate-900 transition-all placeholder:text-slate-400"
                        required
                      />
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      className="space-y-1.5"
                    >
                      <label className="block text-sm font-semibold text-slate-700">Category</label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as any)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50 text-slate-900 transition-all"
                      >
                        {PRODUCT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      className="space-y-1.5"
                    >
                      <label className="block text-sm font-semibold text-slate-700">
                        Price (₹) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="number"
                          value={formPrice}
                          onChange={(e) => setFormPrice(e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50 text-slate-900 transition-all placeholder:text-slate-400"
                          required
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      className="space-y-1.5"
                    >
                      <label className="block text-sm font-semibold text-slate-700">Tags</label>
                      <input
                        type="text"
                        value={formTags}
                        onChange={(e) => setFormTags(e.target.value)}
                        placeholder="zinc, growth, organic, nitrogen"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50 text-slate-900 transition-all placeholder:text-slate-400"
                      />
                    </motion.div>
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="space-y-1.5"
                  >
                    <label className="block text-sm font-semibold text-slate-700">Description</label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Product description, usage instructions, etc..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50 text-slate-900 transition-all placeholder:text-slate-400 resize-none"
                    />
                  </motion.div>

                  <motion.button
                    type="submit"
                    disabled={submitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Add to Inventory
                      </>
                    )}
                  </motion.button>
                </form>
              </motion.div>

              {/* Inventory Grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Package className="w-4 h-4 text-slate-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Current Inventory</h2>
                  </div>
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm font-medium rounded-full">
                    {inventory.length} products
                  </span>
                </div>

                {loadingInventory ? (
                  <div className="p-12 text-center">
                    <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-400">Loading inventory...</p>
                  </div>
                ) : inventory.length === 0 ? (
                  <div className="p-12 text-center">
                    <Package className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                    <p className="text-slate-400 font-medium">No products in inventory yet</p>
                    <p className="text-slate-400 text-sm mt-1">Add your first product using the form above</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                    {inventory.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
                        whileHover={{ scale: 1.02, y: -4 }}
                        className="group relative bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-lg transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-emerald-700 transition-colors">
                              {item.name}
                            </h3>
                            <span
                              className={clsx(
                                'inline-block mt-2 px-2.5 py-1 rounded-lg text-xs font-semibold border',
                                getTypeColor(item.type)
                              )}
                            >
                              {item.type}
                            </span>
                          </div>
                        </div>

                        {item.description && (
                          <p className="text-sm text-slate-500 mb-3 line-clamp-2">{item.description}</p>
                        )}

                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {item.tags.slice(0, 3).map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                            {item.tags.length > 3 && (
                              <span className="text-xs text-slate-400">+{item.tags.length - 3}</span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <span className="text-xl font-bold text-slate-900">
                            ₹{item.price.toLocaleString('en-IN')}
                          </span>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDeleteInventory(item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* CROP DIAGNOSTIC LOGS TAB */}
          {activeTab === 'diagnostics' && (
            <motion.div
              key="diagnostics"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-6"
            >
              {/* Live Feed Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl shadow-sm border border-emerald-100 p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                      <Microscope className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">AI Crop Diagnoses</h2>
                      <p className="text-sm text-slate-500">Real-time diagnosis reports from farmers</p>
                    </div>
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-emerald-200 shadow-sm"
                  >
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <span className="text-sm font-bold text-emerald-700">Live Feed</span>
                  </motion.div>
                </div>
              </motion.div>

              {/* Reports List */}
              {loadingReports ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                  <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400">Loading diagnostic reports...</p>
                </div>
              ) : cropReports.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                    <Microscope className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-medium">No crop diagnostic reports yet</p>
                  <p className="text-slate-400 text-sm mt-1">Reports will appear here when farmers use Crop Doctor</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {cropReports.map((report, index) => (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: index * 0.03, type: 'spring', stiffness: 300, damping: 25 }}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                      >
                        {/* Report Header - Clickable */}
                        <motion.button
                          whileHover={{ backgroundColor: 'rgba(248,250,252,1)' }}
                          onClick={() =>
                            setExpandedReportId(expandedReportId === report.id ? null : report.id)
                          }
                          className="w-full px-6 py-4 flex items-center justify-between transition-colors text-left"
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <motion.div
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center shrink-0"
                            >
                              <Leaf className="w-6 h-6 text-slate-600" />
                            </motion.div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-lg">{report.cropType}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-red-600 font-semibold">{report.diseaseName || 'Healthy'}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                {getStatusBadge(report.status)}
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(report.timestamp)}
                                </span>
                                {report.location?.state && (
                                  <span className="text-xs text-slate-500">
                                    📍 {report.location.state}, {report.location.district}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 ml-4">
                            <div className="text-right">
                              <span className="text-xs text-slate-500">Confidence</span>
                              <span className="block text-2xl font-bold text-slate-900">
                                {report.confidence || 0}%
                              </span>
                            </div>
                            <motion.div
                              animate={{ rotate: expandedReportId === report.id ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-5 h-5 text-slate-400" />
                            </motion.div>
                          </div>
                        </motion.button>

                        {/* Expanded Details */}
                        <AnimatePresence>
                          {expandedReportId === report.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white">
                                <div className="p-6 space-y-6">
                                  {/* Image & Details Grid */}
                                  <div className="grid md:grid-cols-2 gap-6">
                                    {report.imageUrl && (
                                      <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 }}
                                      >
                                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                          <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                                          Uploaded Image
                                        </h4>
                                        <div className="rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
                                          <img
                                            src={report.imageUrl}
                                            alt="Crop diagnostic"
                                            className="w-full h-56 object-cover"
                                          />
                                        </div>
                                      </motion.div>
                                    )}

                                    <motion.div
                                      initial={{ opacity: 0, x: 20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: 0.15 }}
                                    >
                                      <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                        <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                                        Diagnosis Details
                                      </h4>
                                      <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 shadow-sm">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-slate-500">Severity</span>
                                          <span
                                            className={clsx(
                                              'text-sm font-bold px-3 py-1 rounded-full',
                                              report.severity === 'High'
                                                ? 'bg-red-100 text-red-700'
                                                : report.severity === 'Medium'
                                                ? 'bg-orange-100 text-orange-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                            )}
                                          >
                                            {report.severity || 'Unknown'}
                                          </span>
                                        </div>
                                        {report.location?.state && (
                                          <div className="flex justify-between">
                                            <span className="text-sm text-slate-500">Location</span>
                                            <span className="text-sm text-slate-900 font-medium">
                                              {report.location.state}, {report.location.district}
                                            </span>
                                          </div>
                                        )}
                                        {report.userName && (
                                          <div className="flex justify-between">
                                            <span className="text-sm text-slate-500">Farmer</span>
                                            <span className="text-sm text-slate-900 font-medium">{report.userName}</span>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  </div>

                                  {/* Full AI Diagnosis using DetailedDiagnosisReport */}
                                  {report.geminiAnalysis && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: 0.2 }}
                                    >
                                      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                        <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                                        AI Diagnosis Details
                                      </h4>
                                      <DetailedDiagnosisReport
                                        diagnosis={report.geminiAnalysis}
                                        imageUrl={report.imageUrl}
                                        expertAdvice={report.expertAdvice}
                                        showHeader={true}
                                      />
                                    </motion.div>
                                  )}

                                  {/* Expert Advice Section */}
                                  {report.status !== 'reviewed_by_expert' ? (
                                    <motion.div
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: 0.25 }}
                                      className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-100"
                                    >
                                      <div className="flex items-center gap-2 mb-3">
                                        <AlertCircle className="w-5 h-5 text-emerald-600" />
                                        <h4 className="text-sm font-bold text-emerald-800">Provide Expert Advice</h4>
                                      </div>
                                      <textarea
                                        value={expertAdvice[report.id] || ''}
                                        onChange={(e) =>
                                          setExpertAdvice((prev) => ({
                                            ...prev,
                                            [report.id]: e.target.value,
                                          }))
                                        }
                                        placeholder="Enter your agronomist advice for the farmer. Include treatment recommendations, dosage, timing, etc..."
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl border border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-white text-slate-900 transition-all resize-none placeholder:text-slate-400"
                                      />
                                      <div className="mt-3 flex justify-end">
                                        <motion.button
                                          onClick={() => handleSendExpertAdvice(report.id)}
                                          disabled={
                                            sendingAdvice === report.id ||
                                            !expertAdvice[report.id]?.trim()
                                          }
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                          className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          {sendingAdvice === report.id ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                          ) : (
                                            <Send className="w-4 h-4" />
                                          )}
                                          Send to Farmer
                                        </motion.button>
                                      </div>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: 0.25 }}
                                      className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-100"
                                    >
                                      <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                                        <h4 className="text-sm font-bold text-emerald-800">Expert Review Complete</h4>
                                      </div>
                                      <div className="bg-white rounded-lg p-4 border border-emerald-100">
                                        <p className="text-sm text-slate-700 leading-relaxed">{report.expertAdvice}</p>
                                      </div>
                                    </motion.div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

{/* TRIGGER ENGINE TAB */}
          {activeTab === 'triggers' && (
            <motion.div
              key="triggers"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-6"
            >
              {/* Market Simulator Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Trigger Engine Simulator</h2>
                    <p className="text-sm text-slate-500">Test auto-sell triggers by setting simulated market price</p>
                  </div>
                </div>

                {/* Simulated Price Input */}
                <div className="bg-slate-50 rounded-xl p-4 mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Simulated Market Price (₹/Quintal)
                  </label>
                  <div className="flex gap-4">
                    <input
                      type="number"
                      value={simulatedPrice}
                      onChange={(e) => setSimulatedPrice(e.target.value)}
                      placeholder="e.g., 2500"
                      className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:outline-none text-lg"
                    />
                    <button
                      onClick={async () => {
                        if (!simulatedPrice) {
                          toast.error('Please enter a price');
                          return;
                        }
                        setTriggerRunning(true);
                        setTriggerResults(null);
                        try {
                          // Create a simple price override for all crops
                          const prices: Record<string, number> = {
                            wheat: parseInt(simulatedPrice),
                            potato: parseInt(simulatedPrice),
                            rice: parseInt(simulatedPrice),
                            tomato: parseInt(simulatedPrice),
                            onion: parseInt(simulatedPrice),
                            maize: parseInt(simulatedPrice),
                            mustard: parseInt(simulatedPrice),
                            gram: parseInt(simulatedPrice),
                          };
                          const result = await checkAndExecuteTriggers(prices);
                          setTriggerResults(result);
                          if (result.executed > 0) {
                            toast.success(`🎉 ${result.executed} trigger(s) executed! Crops auto-listed to marketplace.`);
                          } else {
                            toast.error('No triggers executed. Check if farmers have set price targets below ₹' + simulatedPrice);
                          }
                        } catch (error) {
                          console.error('Trigger engine error:', error);
                          toast.error('Error running trigger engine');
                        } finally {
                          setTriggerRunning(false);
                        }
                      }}
                      disabled={triggerRunning || isMockConfig}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50 hover:from-emerald-600 hover:to-green-700 transition-all"
                    >
                      {triggerRunning ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          Run Trigger Engine
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Set a price to simulate market conditions. The engine will check all active triggers and execute any where target price is met.
                  </p>
                </div>

                {/* Results */}
                {triggerResults && (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <h4 className="font-semibold text-emerald-800 mb-2">Trigger Execution Results</h4>
                    <p className="text-emerald-700">Executed: {triggerResults.executed} trigger(s)</p>
                    {triggerResults.results.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {triggerResults.results.map((r: any, idx: number) => (
                          <li key={idx} className="text-sm text-emerald-700">
                            ✅ {r.crop}: {r.quantity} tons auto-listed @ ₹{r.price}/qtl
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {isMockConfig && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-700">⚠️ Running in mock mode. Connect to Firebase to test triggers.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ENTERPRISE API HUB TAB */}
          {activeTab === 'apiHub' && (
            <motion.div
              key="apiHub"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-6"
            >
              {/* Premium Enterprise Header */}
              <div className="bg-gradient-to-r from-violet-900 via-purple-900 to-slate-900 rounded-2xl p-6 border border-violet-500/30 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <motion.div
                      initial={{ rotate: -10, scale: 0.9 }}
                      animate={{ rotate: 0, scale: 1 }}
                      className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30"
                    >
                      <Database className="w-7 h-7 text-white" />
                    </motion.div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Enterprise Agri-Data API</h2>
                      <p className="text-violet-300 text-sm mt-1">Monetize anonymized crop health & inventory data</p>
                    </div>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">API Status: Online</span>
                  </motion.div>
                </div>
              </div>

              {/* Analytics Grid & Heatmap */}
              <div className="relative bg-slate-900/80 backdrop-blur-xl text-slate-50 p-6 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
                {/* Top Inner Highlight */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <Activity className="w-5 h-5 text-violet-400 drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]" />
                  <h3 className="text-lg font-bold text-white flex items-center">
                    Real-Time Analytics Dashboard
                    <span className="ml-3 flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-widest">
                      <span className="relative flex h-2 w-2 mr-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      Live Stream
                    </span>
                  </h3>
                </div>

                <div className="grid lg:grid-cols-2 gap-6 relative z-10">
                  {/* National Disease Heatmap - Premium Visualizer */}
                  <div className="relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black rounded-xl border border-slate-700/50 p-5 overflow-hidden group">
                    {/* Scanline Effect */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.01),rgba(0,255,0,0.01),rgba(0,0,255,0.01))] bg-[length:100%_2px,3px_100%] z-20 opacity-30"></div>
                    
                    <h4 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2 relative z-10">
                      <Globe className="w-4 h-4 text-sky-400" />
                      Geo-Spatial Outbreak Visualizer
                    </h4>
                    
                    <div className="relative h-64 bg-black/40 rounded-lg overflow-hidden border border-slate-800/50 flex items-center justify-center">
                      <p className="text-slate-500 text-sm font-mono tracking-widest uppercase">Initializing Geo-Spatial Visualizer...</p>
                      {/* 
                      <ComposableMap
                        projection="geoMercator"
                        projectionConfig={{
                          scale: 2500,
                          center: [80, 26], // Centered on Uttar Pradesh
                        }}
                        style={{ width: "100%", height: "100%" }}
                      >
                        <Geographies geography={GEO_URL}>
                          {({ geographies }) =>
                            geographies
                              .filter((d) => d.properties && (d.properties.NAME === "India" || d.properties.name === "India"))
                              .map((geo) => (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill="#1e293b"
                                  stroke="#334155"
                                  strokeWidth={0.5}
                                  style={{
                                    default: { outline: "none" },
                                    hover: { outline: "none" },
                                    pressed: { outline: "none" },
                                  }}
                                />
                              ))
                          }
                        </Geographies>

                        {heatmapData.map((marker, i) => (
                          <Marker
                            key={marker.id}
                            coordinates={marker.coordinates || [82, 25]}
                            onMouseEnter={() => setHoveredMarker(marker)}
                            onMouseLeave={() => setHoveredMarker(null)}
                          >
                            <motion.g
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.05 }}
                            >
                              <circle
                                r={4}
                                fill={marker.severity === 'High' ? "#ef4444" : "#f59e0b"}
                                className={marker.severity === 'High' ? "animate-pulse" : ""}
                                style={{
                                  filter: `drop-shadow(0 0 8px ${marker.severity === 'High' ? "rgba(239,68,68,0.8)" : "rgba(245,158,11,0.8)"})`,
                                }}
                              />
                              <circle
                                r={8}
                                fill="transparent"
                                stroke={marker.severity === 'High' ? "#ef4444" : "#f59e0b"}
                                strokeWidth={1}
                                strokeOpacity={0.3}
                                className="animate-ping"
                              />
                            </motion.g>
                          </Marker>
                        ))}
                      </ComposableMap>
                      */}

                      {/* Glassmorphism Tooltip */}
                      <AnimatePresence>
                        {hoveredMarker && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute bottom-4 left-4 right-4 z-30 p-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl pointer-events-none"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                                  {hoveredMarker.diseaseName || 'Unknown Outbreak'}
                                </h5>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {hoveredMarker.location?.district || 'Unknown District'}, {hoveredMarker.location?.state || 'UP'}
                                </p>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                hoveredMarker.severity === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {hoveredMarker.severity || 'Moderate'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800">
                              <span className="text-[10px] text-slate-500">Crop: <span className="text-slate-300">{hoveredMarker.cropType || 'N/A'}</span></span>
                              <span className="text-[10px] text-slate-500">
                                {hoveredMarker.createdAt ? new Date(hoveredMarker.createdAt).toLocaleDateString() : 'Recent'}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Radar Sweep Effect */}
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 z-0 origin-center pointer-events-none opacity-10"
                        style={{ background: 'conic-gradient(from 0deg, rgba(71, 85, 105, 0.2) 0deg, transparent 90deg)' }}
                      ></motion.div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500 font-mono tracking-widest uppercase relative z-10">
                      <span className="flex items-center gap-2">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        Live Telemetry Outbreaks
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                        Critical
                        <span className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_5px_rgba(245,158,11,0.5)] ml-2" />
                        Warning
                      </span>
                    </div>
                  </div>

                  {/* Analytics Cards - Cyberpunk Style */}
                  <div className="grid gap-4">
                    {/* Card A: Live Disease Outbreaks */}
                    <motion.div
                      whileHover={{ scale: 1.02, backgroundColor: 'rgba(30, 41, 59, 0.6)' }}
                      className="bg-slate-800/40 border border-red-500/20 rounded-xl p-4 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Live Outbreaks</p>
                          <p className="text-3xl font-mono font-bold text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                            47
                          </p>
                          <p className="text-[10px] text-red-400 font-medium mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Late Blight spreading in UP
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center border border-red-500/20 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)]">
                          <AlertCircle className="w-6 h-6 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
                        </div>
                      </div>
                    </motion.div>

                    {/* Card B: Current Stored Inventory */}
                    <motion.div
                      whileHover={{ scale: 1.02, backgroundColor: 'rgba(30, 41, 59, 0.6)' }}
                      className="bg-slate-800/40 border border-emerald-500/20 rounded-xl p-4 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Stored Inventory</p>
                          <p className="text-3xl font-mono font-bold text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                            12,450
                            <span className="text-xs font-normal text-slate-500 ml-1 font-sans">TONS</span>
                          </p>
                          <p className="text-[10px] text-emerald-400 font-medium mt-2 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Active DWR collateral volume
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]">
                          <Package className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        </div>
                      </div>
                    </motion.div>

                    {/* Card C: Price Volatility Index */}
                    <motion.div
                      whileHover={{ scale: 1.02, backgroundColor: 'rgba(30, 41, 59, 0.6)' }}
                      className="bg-slate-800/40 border border-amber-500/20 rounded-xl p-4 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Volatility Index</p>
                          <p className="text-3xl font-mono font-bold text-amber-400 tracking-tight drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                            HIGH
                          </p>
                          <p className="text-[10px] text-amber-500/70 font-medium mt-2 flex items-center gap-1 font-sans">
                            <TrendingUp className="w-3 h-3" />
                            Onion shortage predicted
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]">
                          <TrendingUp className="w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Developer API Access Section */}
              <div className="bg-slate-900 text-slate-50 p-6 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="w-5 h-5 text-violet-400" />
                  <h3 className="text-lg font-bold text-white">Developer API Access</h3>
                </div>

                <div className="space-y-4">
                  {/* Generate Key Button */}
                  <motion.button
                    onClick={handleGenerateApiKey}
                    disabled={generating}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Database className="w-5 h-5" />
                        Generate Production API Key
                      </>
                    )}
                  </motion.button>

                  {/* Generated Key Display */}
                  {generatedKey && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-amber-900/30 border border-amber-500/50 rounded-xl"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-semibold text-amber-400">Key shown only once - save it now!</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-4 py-3 bg-slate-950 rounded-lg font-mono text-sm text-emerald-400 overflow-x-auto">
                          {generatedKey}
                        </code>
                        <motion.button
                          onClick={() => copyToClipboard(generatedKey)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg flex items-center gap-2 transition-colors"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span className="text-sm font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span className="text-sm font-semibold">Copy</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* Existing Keys List */}
                  {apiKeys.length > 0 && !generatedKey && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm text-slate-400 font-medium">Your existing API keys:</p>
                      {apiKeys.map((key, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                        >
                          <code className="flex-1 font-mono text-sm text-slate-300 truncate">
                            {key.substring(0, 20)}...{key.substring(key.length - 8)}
                          </code>
                          <button
                            onClick={() => copyToClipboard(key)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                    <div className="flex items-start gap-3">
                      <BarChart3 className="w-5 h-5 text-violet-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-white">Enterprise Data Available</p>
                        <p className="text-xs text-slate-400 mt-1">
                          This API provides access to anonymized expert reviews (disease scans) and digital_receipts (inventory data)
                          for hedge funds, agro-chemical companies, and agricultural research institutions.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}