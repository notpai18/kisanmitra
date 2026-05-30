import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, isMockConfig } from '../lib/firebase';
import { collection, addDoc, doc, setDoc, query, orderBy, limit, onSnapshot, getDocs, where } from '../lib/firebase';
import LocationSelector from '../components/LocationSelector';
import { FarmProfileData } from '../components/FarmFormModal';
import { Stethoscope, UploadCloud, Camera, Image as ImageIcon, Microscope, AlertTriangle, ShieldAlert, ShieldCheck, Clock, Leaf, ChevronRight, Calendar, ShoppingBag, WifiOff, RefreshCw, Package, UserCheck, BadgeCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { UI } from '../constants/translations';
import { formatDate } from '../utils/formatDate';
import { geminiClient, CropDiagnosis as GeminiDiagnosis } from '../lib/geminiClient';
import DetailedDiagnosisReport from '../components/DetailedDiagnosisReport';
import { addToQueue, checkPendingUploads, syncPendingUploads } from '../lib/OfflineQueueService';
import { useCart } from '../contexts/CartContext';

interface CropReport {
  id: string;
  cropName: string;
  diseaseName: string;
  severity: 'Low' | 'Medium' | 'High';
  confidence: number;
  symptoms: string;
  treatment: string;
  prevention: string;
  actualCropDetected?: string;
  createdAt: any;
  imageUrl?: string;
  healthScore?: number;
  treatmentType?: 'organic' | 'chemical';
  expertAdvice?: string;
  status?: string;
  geminiAnalysis?: GeminiDiagnosis;
}

const CROP_TYPES = ['Wheat', 'Rice', 'Tomato', 'Potato', 'Sugarcane', 'Maize', 'Soybean', 'Cotton', 'Mustard', 'Other'];
const MAX_IMAGES = 5;

export default function CropDoctor() {
  const { user, userData, isVillageAgent, currentFarmerId } = useAuth();
  const { t, language } = useLanguage();
  const { addToCart } = useCart();

  // For village agent: use currentFarmerId if selected
  const effectiveFarmerId = isVillageAgent ? (currentFarmerId || user?.uid) : user?.uid;
  const [images, setImages] = useState<string[]>([]);
  const [cropType, setCropType] = useState('Wheat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeminiDiagnosis | null>(null);
  const [viewMode, setViewMode] = useState<'new' | 'history'>('new');
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [recentReports, setRecentReports] = useState<CropReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ctxState, setCtxState] = useState('');
  const [ctxDistrict, setCtxDistrict] = useState('');
  const [ctxErr, setCtxErr] = useState({ state: '', district: '' });
  const [pendingUploads, setPendingUploads] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueued, setOfflineQueued] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch recommended products based on AI-suggested inventory tags
  useEffect(() => {
    const fetchRecommendedProducts = async () => {
      if (!result || result.is_healthy) {
        setRecommendedProducts([]);
        return;
      }

      setLoadingProducts(true);
      try {
        const treatmentType = 'chemical'; // Default to chemical for product recommendations
        let matchTags: string[] = [];

        // Primary: Use AI-suggested inventory tags
        if (result.suggested_inventory_tags && result.suggested_inventory_tags.length > 0) {
          matchTags = result.suggested_inventory_tags;
        } else {
          // Fallback: Extract from treatment products or disease name - prefer chemical
          const treatment = result.treatmentOptions?.chemical ?? result.treatmentOptions?.organic;

          if (treatment?.products) {
            matchTags = treatment.products.map((p: any) => p.name?.toLowerCase() || '').filter(Boolean);
          }

          if (matchTags.length === 0) {
            // Last fallback: disease name and pest detection
            const fallbackTags: string[] = [];
            if (result.disease_name) {
              // Map common diseases to product tags
              const diseaseMap: Record<string, string[]> = {
                'blight': ['fungicide', 'blight'],
                'mildew': ['fungicide', 'mildew'],
                'rust': ['fungicide', 'rust'],
                'spot': ['fungicide', 'spot'],
                'rot': ['fungicide', 'rot'],
                'anthracnose': ['fungicide', 'anthracnose'],
                'aphid': ['insecticide', 'aphids'],
                'borer': ['insecticide', 'borer'],
                'pest': ['insecticide', 'pest-control'],
                'deficiency': ['fertilizer'],
              };
              const diseaseLower = result.disease_name.toLowerCase();
              for (const [key, tags] of Object.entries(diseaseMap)) {
                if (diseaseLower.includes(key)) {
                  fallbackTags.push(...tags);
                }
              }
            }
            // Add pest detection tags
            if (result.pestDetection && result.pestDetection.length > 0) {
              fallbackTags.push('insecticide', 'pest-control');
            }
            matchTags = fallbackTags.length > 0 ? fallbackTags : ['fertilizer'];
          }
        }

        // Fetch inventory
        let allProducts: any[] = [];

        if (isMockConfig) {
          allProducts = getMockInventory();
        } else {
          const snapshot = await getDocs(collection(db, 'inventory'));
          allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        // Match products by tags and treatment type preference
        const matched = allProducts.filter((p: any) => {
          const productTags = p.tags || [];
          const type = p.type || p.category || '';

          // Filter by treatment type preference
          if (treatmentType === 'organic') {
            if (type !== 'organic') return false;
          } else {
            // For chemical, allow chemical, fertilizer
            if (type === 'organic') return false;
          }

          // Match tags
          return matchTags.some(tag =>
            productTags.some((pt: string) => pt.toLowerCase().includes(tag.toLowerCase()))
          );
        });

        setRecommendedProducts(matched.slice(0, 4));
      } catch (err) {
        console.error('Failed to fetch recommended products:', err);
        setRecommendedProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchRecommendedProducts();
  }, [result]);

  const getMockInventory = () => [
    { id: '1', name: 'Urea Fertilizer 46% N', price: 300, unit: 'bag', category: 'fertilizer', type: 'fertilizer', tags: ['nitrogen', 'fertilizer', 'urea', 'growth'], inStock: true },
    { id: '2', name: 'DAP 18-46-0', price: 1350, unit: 'bag', category: 'fertilizer', type: 'fertilizer', tags: ['phosphorus', 'fertilizer', 'dap', 'root'], inStock: true },
    { id: '3', name: 'Imidacloprid 17.8% SL', price: 450, unit: 'liter', category: 'pesticide', type: 'chemical', tags: ['insecticide', 'imidacloprid', 'chemical', 'sucking-pest', 'aphids'], inStock: true },
    { id: '4', name: 'Carbendazim 50% WP', price: 320, unit: 'kg', category: 'pesticide', type: 'chemical', tags: ['fungicide', 'carbendazim', 'chemical', 'blight'], inStock: true },
    { id: '5', name: 'Neem Oil 10,000 PPM', price: 280, unit: 'liter', category: 'organic', type: 'organic', tags: ['neem', 'organic', 'insecticide', 'aphids', 'pest-control'], inStock: true },
    { id: '6', name: 'Neem Cake', price: 180, unit: 'kg', category: 'organic', type: 'organic', tags: ['neem', 'organic', 'soil-enrichment', 'pest-control'], inStock: true },
    { id: '7', name: 'Chlorpyrifos 20% EC', price: 380, unit: 'liter', category: 'pesticide', type: 'chemical', tags: ['insecticide', 'chlorpyrifos', 'broad-spectrum', 'chemical', 'borer'], inStock: true },
    { id: '8', name: 'NPK 10-26-26', price: 950, unit: 'bag', category: 'fertilizer', type: 'fertilizer', tags: ['npk', 'potassium', 'fertilizer', 'flowering'], inStock: true },
    { id: '9', name: 'Mancozeb 75% WP', price: 420, unit: 'kg', category: 'pesticide', type: 'chemical', tags: ['fungicide', 'blight', 'mancozeb', 'chemical'], inStock: true },
    { id: '10', name: 'NPK 19:19:19', price: 1100, unit: 'bag', category: 'fertilizer', type: 'fertilizer', tags: ['npk', 'balanced', 'fertilizer', 'growth'], inStock: true },
  ];

  const handleBuyNow = (product: any) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
    });
    toast.success(language === 'hi'
      ? `${product.name} कार्ट में जोड़ा गया`
      : `${product.name} added to cart`);
  };

  useEffect(() => {
    const prefill = async () => {
      if (!user || isMockConfig) return;
      try {
        const snap = await getDocs(collection(db, `users/${user.uid}/farms`));
        const first = snap.docs[0]?.data() as FarmProfileData | undefined;
        if (first?.state) setCtxState(first.state);
        if (first?.district) setCtxDistrict(first.district);
      } catch {
        /* ignore */
      }
    };
    prefill();
  }, [user]);

  // Handle online/offline status and pending uploads
  useEffect(() => {
    const updateStatus = async () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        const count = await checkPendingUploads();
        setPendingUploads(count);
        if (count > 0) {
          const result = await syncPendingUploads();
          if (result.success > 0) {
            toast.success(language === 'hi'
              ? `${result.success} जांच ऑनलाइन सिंक हो गई`
              : `${result.success} diagnosis synced online`);
            setPendingUploads(0);
          }
        }
      }
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, [language]);

  useEffect(() => {
    if (!user || isMockConfig) return;
    // Query ROOT-LEVEL cropReports collection filtered by userId
    const q = query(
      collection(db, 'cropReports'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports: CropReport[] = snapshot.docs.map((d) => {
        const raw: any = d.data();
        return {
          id: d.id,
          cropName: raw.cropType ?? raw.cropName ?? '',
          diseaseName: raw.diseaseName ?? raw.disease_name ?? raw.geminiAnalysis?.disease_name ?? '',
          severity: (raw.severity ?? raw.geminiAnalysis?.severity ?? 'Low') as CropReport['severity'],
          confidence: Number(raw.confidence ?? raw.confidence_percent ?? raw.geminiAnalysis?.confidence_percent ?? 0),
          symptoms: raw.cause ?? raw.symptoms ?? raw.geminiAnalysis?.cause ?? '',
          treatment: Array.isArray(raw.treatment) ? raw.treatment.join('\n') : (raw.treatment ?? raw.geminiAnalysis?.treatment_steps?.join('\n') ?? ''),
          prevention: Array.isArray(raw.prevention) ? raw.prevention.join('\n') : (raw.prevention ?? raw.geminiAnalysis?.prevention_tips?.join('\n') ?? ''),
          actualCropDetected: raw.actualCropDetected,
          createdAt: raw.createdAt ?? raw.timestamp ?? '',
          imageUrl: raw.imageUrl,
          healthScore: raw.healthScore ?? raw.geminiAnalysis?.healthScore?.overall,
          treatmentType: raw.treatmentType,
          expertAdvice: raw.expertAdvice,
          status: raw.status,
          geminiAnalysis: raw.geminiAnalysis,
        };
      });
      setRecentReports(reports);
    });
    return () => unsubscribe();
  }, [user]);

  // Component for expert advice card with Framer Motion animation
  const ExpertAdviceCard = ({ advice }: { advice: string }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 mt-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
          <UserCheck className="w-4 h-4 text-emerald-600" />
        </div>
        <h4 className="font-bold text-emerald-800">Reviewed by Human Expert</h4>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{advice}</p>
    </motion.div>
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = MAX_IMAGES - images.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);

    filesToAdd.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev) => [...prev, reader.result as string].slice(0, MAX_IMAGES));
      };
      reader.readAsDataURL(file);
    });

    setResult(null);
    setError(null);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    const remainingSlots = MAX_IMAGES - images.length;
    const filesToAdd = files.slice(0, remainingSlots);

    filesToAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev) => [...prev, reader.result as string].slice(0, MAX_IMAGES));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDiagnose = async () => {
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }
    setCtxErr({ state: '', district: '' });
    if (!ctxState.trim()) {
      setCtxErr((p) => ({ ...p, state: t('loc_err_state') }));
      return;
    }
    if (!ctxDistrict.trim()) {
      setCtxErr((p) => ({ ...p, district: t('loc_err_district') }));
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setOfflineQueued(false);

    // Check if offline and queue the request
    if (!navigator.onLine) {
      try {
        // Convert images to data URLs if not already
        const imageData = images[0] || '';
        const mimeType = imageData.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

        await addToQueue({
          image: imageData,
          mimeType,
          cropType,
          language,
          state: ctxState,
          district: ctxDistrict,
        });

        setOfflineQueued(true);
        setPendingUploads(prev => prev + 1);
        toast.success(language === 'hi'
          ? 'ऑफलाइन कतार में जोड़ा गया। नेटवर्क वापस आने पर स्वचालित रूप से अपलोड होगा।'
          : 'Added to offline queue. Will upload automatically when network is restored.');
      } catch (err) {
        console.error('Failed to queue upload:', err);
        setError(language === 'hi' ? 'ऑफलाइन कतार में जोड़ने में विफल' : 'Failed to queue for offline upload');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const data = await geminiClient.analyzeCropImage({ images, cropType, language, state: ctxState, district: ctxDistrict });
      setResult(data);

      // Auto-save to ROOT-LEVEL cropReports collection
      if (user && !isMockConfig) {
        try {
          const agentTracking = isVillageAgent ? {
            agentId: user.uid,
            actedAsAgent: true,
            farmerId: currentFarmerId || user.uid,
          } : {};

          const reportData: any = {
            userId: user.uid, // Always use current user's ID
            userName: userData?.name || 'Farmer',
            cropType: cropType,
            diseaseName: data.disease_name,
            confidence: data.confidence_percent,
            severity: data.severity,
            geminiAnalysis: data,
            imageUrl: images[0] || '',
            status: 'pending_human_approval',
            location: { state: ctxState, district: ctxDistrict },
            createdAt: new Date().toISOString(),
            ...agentTracking,
          };

          // Generate a consistent report ID
          const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Save to ROOT-LEVEL cropReports collection (single source of truth)
          await setDoc(doc(db, 'cropReports', reportId), reportData);

          // Also keep expert_reviews for backward compatibility
          await setDoc(doc(db, 'expert_reviews', reportId), reportData);

          toast.success(language === 'hi' ? 'रिपोर्ट सहेजी गई' : 'Report saved');
        } catch (saveErr) {
          console.error('Auto-save failed:', saveErr);
          // Don't show error to user - diagnosis still worked
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(UI?.aiUnavailable || 'AI service unavailable');
      setError(err instanceof Error ? err.message : 'फसल की जांच करने में समस्या आई। कृपया पुनः प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-forest-100 text-forest-600 rounded-2xl flex items-center justify-center shrink-0">
            <Stethoscope className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-forest-900 flex items-center gap-2">
              {t('doc_title')}
            </h1>
            <p className="text-gray-500 mt-1 font-devanagari">{t('doc_subtitle')}</p>
          </div>
        </div>

        {/* Premium Sliding Pill Tab Selector */}
        <motion.div className="flex bg-gray-100 p-1.5 rounded-2xl shrink-0 self-start md:self-auto shadow-inner">
          <div className="relative flex bg-gray-200 rounded-xl p-1">
            <motion.div
              className="absolute top-1 bottom-1 bg-white rounded-xl shadow-lg"
              initial={false}
              animate={{
                left: activeTabIndex === 0 ? '4px' : '50%',
                width: 'calc(50% - 4px)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
            <button
              onClick={() => {
                setViewMode('new');
                setActiveTabIndex(0);
              }}
              className={clsx(
                "relative z-10 px-6 py-2.5 rounded-lg text-sm font-bold transition-colors",
                activeTabIndex === 0 ? "text-forest-700" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <span className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                {language === 'en' ? 'New Scan' : 'नया स्कैन'}
              </span>
            </button>
            <button
              onClick={() => {
                setViewMode('history');
                setActiveTabIndex(1);
              }}
              className={clsx(
                "relative z-10 px-6 py-2.5 rounded-lg text-sm font-bold transition-colors",
                activeTabIndex === 1 ? "text-forest-700" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {language === 'en' ? 'Past Scans' : 'पिछले स्कैन'}
              </span>
            </button>
          </div>
        </motion.div>
      </div>

      {viewMode === 'new' && (
        <div className="space-y-8 animate-fade-in">
          {/* Upload Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
            {images.length === 0 ? (
              <div
                className="border-3 border-dashed border-forest-200 bg-forest-50/50 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[300px] transition-colors hover:bg-forest-50"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-6 text-forest-500">
                  <UploadCloud className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-forest-900 mb-2 font-devanagari">{t('doc_upload')}</h3>
                <p className="text-gray-500 mb-8 text-center max-w-md font-devanagari">{t('doc_upload_sub')}</p>

                <div className="flex flex-wrap justify-center gap-4">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 bg-forest-600 hover:bg-forest-700 text-white px-6 py-3 rounded-full font-medium transition-colors"
                  >
                    <Camera className="w-5 h-5" /> {t('doc_take_photo')}
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-white border border-gray-200 hover:border-forest-300 text-gray-700 px-6 py-3 rounded-full font-medium transition-colors shadow-sm"
                  >
                    <ImageIcon className="w-5 h-5" /> {t('doc_gallery')}
                  </button>
                </div>
                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageUpload} className="hidden" multiple />
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" multiple />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Image Gallery */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {images.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img} alt={`Crop ${i + 1}`} className="w-full h-32 object-cover rounded-xl shadow-sm" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-2 left-2 bg-forest-600 text-white text-xs px-2 py-1 rounded-full">
                          Primary
                        </span>
                      )}
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 hover:border-forest-400 hover:text-forest-600 transition-colors"
                    >
                      <span className="text-2xl">+</span>
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-500 text-center">
                  {images.length} of {MAX_IMAGES} images uploaded
                </p>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" multiple />

                <div className="w-full max-w-2xl mx-auto space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-devanagari">{t('doc_crop_type')}</label>
                    <select
                      value={cropType}
                      onChange={(e) => setCropType(e.target.value)}
                      className="w-full rounded-xl border-gray-200 shadow-sm focus:border-forest-500 focus:ring-forest-500 p-3 border bg-gray-50"
                    >
                      {CROP_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <LocationSelector
                    label
                    selectedState={ctxState}
                    selectedDistrict={ctxDistrict}
                    onStateChange={(s) => {
                      setCtxState(s);
                      setCtxDistrict('');
                    }}
                    onDistrictChange={setCtxDistrict}
                    stateError={ctxErr.state}
                    districtError={ctxErr.district}
                  />

                  <button
                    onClick={handleDiagnose}
                    disabled={loading}
                    className="w-full bg-forest-600 hover:bg-forest-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-forest-600/20 disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Analyzing {images.length} image{images.length > 1 ? 's' : ''}...
                      </>
                    ) : (
                      <>
                        <Microscope className="w-6 h-6" /> {t('doc_diagnose')}
                      </>
                    )}
                  </button>

                  {error && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="text-sm">{error}</p>
                    </div>
                  )}

                  {/* Offline Status Banner */}
                  {offlineQueued && (
                    <div className="p-4 bg-amber-50 text-amber-800 rounded-xl flex items-center gap-3 border border-amber-200">
                      <WifiOff className="w-5 h-5 shrink-0" />
                      <p className="text-sm">
                        {language === 'hi'
                          ? 'आपका विश्लेषण ऑफलाइन कतार में सहेजा गया। जब नेटवर्क उपलब्ध होगा तो यह स्वचालित रूप से अपलोड हो जाएगा।'
                          : 'Your analysis has been saved to offline queue. It will upload automatically when network is available.'}
                      </p>
                    </div>
                  )}

                  {/* Offline Status & Pending Uploads */}
                  {(!isOnline || pendingUploads > 0) && (
                    <div className="p-3 bg-blue-50 text-blue-800 rounded-xl flex items-center justify-between gap-3 border border-blue-100">
                      <div className="flex items-center gap-2">
                        <WifiOff className="w-4 h-4" />
                        <span className="text-sm">
                          {!isOnline
                            ? (language === 'hi' ? 'ऑफलाइन मोड' : 'Offline mode')
                            : (language === 'hi'
                                ? `${pendingUploads} लंबित अपलोड`
                                : `${pendingUploads} pending upload${pendingUploads > 1 ? 's' : ''}`)}
                        </span>
                      </div>
                      {pendingUploads > 0 && isOnline && (
                        <button
                          onClick={async () => {
                            const result = await syncPendingUploads();
                            if (result.success > 0) {
                              setPendingUploads(0);
                              toast.success(language === 'hi'
                                ? `${result.success} सिंक हो गए`
                                : `${result.success} synced`);
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {language === 'hi' ? 'सिंक करें' : 'Sync now'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Diagnosis Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <DetailedDiagnosisReport
                  diagnosis={result}
                  imageUrl={images[0]}
                />
                {/* Recommended Products Section - Global for all diagnoses */}
                <div className="p-6 md:p-8 pt-0 mt-4 border-t border-gray-200">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h3 className="font-bold text-gray-900 text-lg mb-1 flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-green-600" />
                      {language === 'hi' ? 'अनुशंसित उत्पाद' : 'Recommended Products'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {language === 'hi'
                        ? 'इन उत्पादों को खरीदें जो आपकी फसल के उपचार में मदद कर सकते हैं:'
                        : 'Products to help treat your crop:'}
                    </p>

                    {loadingProducts ? (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="min-w-[160px] bg-white rounded-xl p-3 animate-pulse">
                            <div className="h-20 bg-gray-200 rounded-lg mb-2" />
                            <div className="h-4 bg-gray-200 rounded w-3/4" />
                          </div>
                        ))}
                      </div>
                    ) : recommendedProducts.length > 0 ? (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {recommendedProducts.map((product, index) => (
                          <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + index * 0.05 }}
                            whileHover={{ scale: 1.02 }}
                            className="min-w-[160px] bg-white rounded-xl p-3 border border-green-100 shadow-sm hover:shadow-md"
                          >
                            <div className="flex items-center justify-center h-20 bg-green-50 rounded-lg mb-2">
                              <Package className="w-8 h-8 text-green-600" />
                            </div>
                            <h4 className="font-bold text-gray-900 text-sm truncate">{product.name}</h4>
                            <div className="text-green-700 font-bold text-lg">₹{product.price}</div>
                            <span className="text-xs text-gray-500">/{product.unit}</span>
                            <button
                              onClick={() => handleBuyNow(product)}
                              className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 rounded-lg transition-colors"
                            >
                              {language === 'hi' ? 'खरीदें' : 'Buy Now'}
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100">
                        <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm text-gray-500">
                          {language === 'hi'
                            ? 'इस निदान के लिए कोई विशिष्ट उत्पाद अनुशंसित नहीं हैं।'
                            : 'No specific products recommended for this diagnosis.'}
                        </p>
                        <a
                          href="/input-store"
                          className="inline-flex items-center gap-1 mt-2 text-green-600 font-medium text-sm hover:underline"
                        >
                          {language === 'hi' ? 'सभी उत्पाद देखें' : 'Browse all products'}
                          <ChevronRight className="w-4 h-4" />
                        </a>
                      </div>
                    )}

                    {recommendedProducts.length > 0 && (
                      <div className="mt-4 flex justify-center">
                        <a
                          href="/input-store"
                          className="text-green-700 font-bold text-sm hover:underline flex items-center gap-1"
                        >
                          {language === 'hi' ? 'सभी उत्पाद देखें' : 'View all products'}
                          <ChevronRight className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Past Scans - Real-time History View with Accordions */}
      {viewMode === 'history' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              {language === 'en' ? 'Past Scans' : 'पिछले स्कैन'}
            </h2>
            {recentReports.length > 0 && (
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {recentReports.length} {recentReports.length === 1 ? 'scan' : 'scans'}
              </span>
            )}
          </div>

          {recentReports.length > 0 ? (
            <div className="space-y-4">
              <AnimatePresence>
                {recentReports.map((report, index) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                  >
                    {/* Collapsed View - Clickable Header */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                      className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        {report.imageUrl ? (
                          <img
                            src={report.imageUrl}
                            alt={report.cropName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Leaf className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-forest-700">{report.cropName}</span>
                          <span
                            className={clsx(
                              'text-xs font-bold px-2 py-0.5 rounded-full',
                              report.severity === 'Low'
                                ? 'bg-yellow-100 text-yellow-800'
                                : report.severity === 'Medium'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-red-100 text-red-800'
                            )}
                          >
                            {report.severity}
                          </span>
                          {/* Expert Advice Badge */}
                          {report.expertAdvice && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <BadgeCheck className="w-3 h-3" />
                              {language === 'hi' ? 'समीक्षित' : 'Reviewed'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{report.diseaseName || 'Healthy'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(report.createdAt, { showTime: false })}
                          <span>•</span>
                          <span>{report.confidence}% {language === 'hi' ? 'विश्वास' : 'confidence'}</span>
                        </div>
                      </div>

                      {/* Expand Icon */}
                      <motion.div
                        animate={{ rotate: expandedId === report.id ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-gray-400"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </motion.div>
                    </button>

                    {/* Expanded View - Full DetailedDiagnosisReport */}
                    <AnimatePresence>
                      {expandedId === report.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-gray-100"
                        >
                          <div className="p-4 bg-gray-50">
                            {report.geminiAnalysis ? (
                              <DetailedDiagnosisReport
                                diagnosis={report.geminiAnalysis}
                                imageUrl={report.imageUrl}
                                expertAdvice={report.expertAdvice}
                                showHeader={true}
                              />
                            ) : (
                              /* Fallback for older reports without geminiAnalysis */
                              <div className="space-y-4 p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h3 className="font-bold text-gray-900">{report.diseaseName || 'Healthy'}</h3>
                                    <p className="text-sm text-gray-500">{report.confidence}% Confidence</p>
                                  </div>
                                  {report.healthScore && (
                                    <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
                                      <Leaf className="w-5 h-5 text-green-600" />
                                      <span className="text-lg font-bold text-green-700">{report.healthScore}</span>
                                    </div>
                                  )}
                                </div>
                                {report.expertAdvice && (
                                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <UserCheck className="w-5 h-5 text-emerald-600" />
                                      <h4 className="font-bold text-emerald-800">{language === 'hi' ? 'कृषि विशेषज्ञ की सलाह' : 'Expert Advice'}</h4>
                                    </div>
                                    <p className="text-slate-700 leading-relaxed">{report.expertAdvice}</p>
                                  </div>
                                )}
                                <div>
                                  <h4 className="font-semibold text-gray-700 mb-2">Treatment</h4>
                                  <p className="text-gray-600 text-sm whitespace-pre-line">{report.treatment || 'No treatment information available.'}</p>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-700 mb-2">Prevention</h4>
                                  <p className="text-gray-600 text-sm whitespace-pre-line">{report.prevention || 'No prevention information available.'}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400 pt-2">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {formatDate(report.createdAt, { showTime: true })}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium text-lg">{language === 'en' ? 'No past scans yet.' : 'अभी तक कोई पिछला स्कैन नहीं।'}</p>
              <p className="text-gray-400 text-sm mt-2">{language === 'en' ? 'Start a new scan to see your history here.' : 'अपना इतिहास यहाँ देखने के लिए नया स्कैन शुरू करें।'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}