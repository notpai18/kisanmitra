import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, IndianRupee, ShieldCheck, Loader2, CheckCircle2, ArrowRight, Clock, Building2, Lock, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, isMockConfig } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

interface CreditApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

interface UserProfile {
  name: string;
  totalArea: number;
  recentSales: number;
  trustScore: number;
}

const loanPurposes = [
  { value: 'agri_inputs', label: 'Agri-Inputs (Seeds, Fertilizers)', labelHi: 'कृषि आदान (बीज, उर्वरक)' },
  { value: 'machinery', label: 'Machinery (Tools, Equipment)', labelHi: 'मशीनरी (उपकरण)' },
  { value: 'farm_infra', label: 'Farm Infrastructure', labelHi: 'खेत की बुनियादी डिल्ला' },
];

const loanDurations = [
  { value: '3', label: '3 Months', labelHi: '3 महीने' },
  { value: '6', label: '6 Months', labelHi: '6 महीने' },
  { value: '12', label: '12 Months', labelHi: '12 महीने' },
];

export default function CreditApplyModal({ isOpen, onClose }: CreditApplyModalProps) {
  const { user, userData } = useAuth();
  const { language } = useLanguage();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanDuration, setLoanDuration] = useState('');
  const [processingText, setProcessingText] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [loanDetails, setLoanDetails] = useState<{
    amount: number;
    purpose: string;
    duration: string;
    interest: number;
    originationFee: number;
  } | null>(null);

  // Digital Warehouse Receipt state
  const [digitalReceipts, setDigitalReceipts] = useState<any[]>([]);
  const [collateralReceipt, setCollateralReceipt] = useState<any | null>(null);
  const [useCollateral, setUseCollateral] = useState(false);
  const [amountError, setAmountError] = useState('');

  const maxLoanAmount = useCollateral 
    ? (collateralReceipt?.totalCost * 0.75 || 0) 
    : 50000;

  const processingMessages = [
    { text: 'Analyzing Farm Output Data...', textHi: 'खेत के आउटपुट डेटा का विश्लेषण...' },
    { text: 'Verifying TrustScore...', textHi: 'ट्रस्टस्कोर सत्यापित हो रहा है...' },
    { text: 'Connecting to Partner NBFC...', textHi: 'पार्टनर NBFC से जुड़ रहे हैं...' },
  ];

  useEffect(() => {
    if (step === 3 && isOpen) {
      let idx = 0;
      setProcessingText(processingMessages[0].text);

      const interval = setInterval(() => {
        idx++;
        if (idx < processingMessages.length) {
          setProcessingText(processingMessages[idx].text);
        } else {
          clearInterval(interval);
        }
      }, 1500);

      const timeout = setTimeout(() => {
        setStep(4);
      }, processingMessages.length * 1500 + 1000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [step, isOpen]);

  useEffect(() => {
    if (isOpen && user && step === 1) {
      fetchUserProfile();
      fetchDigitalReceipts();
    }
  }, [isOpen, user, step]);

  const fetchDigitalReceipts = async () => {
    if (!user) return;

    if (isMockConfig) {
      setDigitalReceipts([
        {
          id: 'mock-receipt-1',
          farmerId: user.uid,
          crop: 'wheat',
          quantity: 5,
          unit: 'tons',
          warehouseName: 'Kisan Cold Storage',
          pledgeStatus: 'unpledged',
          totalCost: 12000,
        },
      ]);
      return;
    }

    try {
      const q = query(
        collection(db, 'digital_receipts'),
        where('farmerId', '==', user.uid),
        where('pledgeStatus', '==', 'unpledged')
      );
      const snapshot = await getDocs(q);
      const receipts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDigitalReceipts(receipts);
      if (receipts.length > 0) {
        setCollateralReceipt(receipts[0]);
      }
    } catch (error) {
      console.error('Error fetching digital receipts:', error);
    }
  };

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      let profileData: UserProfile = {
        name: userData?.name || 'Farmer',
        totalArea: 0,
        recentSales: 0,
        trustScore: 750,
      };

      if (!isMockConfig) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          profileData.name = data.name || 'Farmer';
          profileData.trustScore = data.trustScore?.overall || 750;
        }

        const farmsSnap = await getDoc(doc(db, `users/${user.uid}/farms`, 'primary'));
        if (farmsSnap.exists()) {
          const farmData = farmsSnap.data();
          profileData.totalArea = farmData.area || 0;
        }
      }

      const completenessScore = calculateTrustScore(profileData);
      profileData.trustScore = Math.min(1000, Math.round(completenessScore));
      setProfile(profileData);
    } catch (e) {
      console.error('Error fetching profile:', e);
      setProfile({
        name: userData?.name || 'Farmer',
        totalArea: 0,
        recentSales: 0,
        trustScore: 750,
      });
    }
  };

  const calculateTrustScore = (profile: UserProfile): number => {
    let score = 500;
    if (profile.name) score += 100;
    if (profile.totalArea > 0) score += 150;
    if (profile.recentSales > 0) score += 100;
    if (userData?.phone) score += 50;
    if (userData?.aadhaarLast4) score += 100;
    if (userData?.trustScore?.verified) score += 100;
    return Math.min(1000, score);
  };

  const handleSubmitApplication = async () => {
    if (!loanAmount || !loanPurpose || !loanDuration) return;

    // 9% interest for collateralized loans (with DWR), 12% otherwise
    const interestRate = useCollateral ? 9 : 12;

    setStep(3);
    setLoanDetails({
      amount: Number(loanAmount),
      purpose: loanPurpose,
      duration: loanDuration,
      interest: interestRate,
      originationFee: Math.round(Number(loanAmount) * (useCollateral ? 0.015 : 0.02)),
    });
  };

  const handleSaveApplication = async () => {
    if (!user || !loanDetails) return;

    try {
      const appData = {
        userId: user.uid,
        userName: profile?.name || userData?.name,
        amount: loanDetails.amount,
        purpose: loanDetails.purpose,
        duration: loanDetails.duration,
        interestRate: loanDetails.interest,
        originationFee: loanDetails.originationFee,
        trustScore: profile?.trustScore || 0,
        status: 'pre_approved',
        createdAt: serverTimestamp(),
      };

      if (!isMockConfig) {
        const docRef = await addDoc(collection(db, 'loan_applications'), appData);
        setApplicationId(docRef.id);
      } else {
        setApplicationId('MOCK-' + Date.now());
      }
    } catch (e) {
      console.error('Error saving application:', e);
    }
  };

  useEffect(() => {
    if (step === 4 && loanDetails) {
      handleSaveApplication();
    }
  }, [step]);

  const getTrustLevel = (score: number) => {
    if (score >= 800) return { level: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (score >= 650) return { level: 'Good', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
    return { level: 'Fair', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  };

  const getPurposeLabel = (val: string) => {
    const p = loanPurposes.find(p => p.value === val);
    return p?.label || val;
  };

  const getDurationLabel = (val: string) => {
    const d = loanDurations.find(d => d.value === val);
    return d?.label || val;
  };

  const slideVariants = {
    initial: { x: 50, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -50, opacity: 0 },
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-emerald-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Farm Credit</h2>
                <p className="text-white/80 text-sm">Zero-Risk Embedded Finance</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mt-6">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex-1 h-1.5 rounded-full bg-white/30 overflow-hidden">
                <motion.div
                  className="h-full bg-white rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: s <= step ? '100%' : '0%' }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[400px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* DWR Collateral Banner */}
                {collateralReceipt && (
                  <motion.button
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    type="button"
                    onClick={() => setUseCollateral(!useCollateral)}
                    className={`w-full text-left transition-all duration-300 rounded-2xl p-4 border flex items-center gap-4 group ${
                      useCollateral 
                        ? "bg-gradient-to-br from-emerald-100/50 to-teal-100/30 border-transparent ring-2 ring-emerald-500 shadow-md" 
                        : "bg-gradient-to-br from-emerald-50/50 to-teal-50/30 border-emerald-100 shadow-sm hover:border-emerald-200"
                    }`}
                  >
                    <div className="bg-white shadow-sm p-2.5 rounded-xl text-emerald-600 shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-emerald-900 font-semibold text-sm">
                        {language === 'hi' ? 'गिरवी लोन उपलब्ध!' : 'Collateralized Loan Available!'}
                      </h4>
                      <p className="text-emerald-700/80 text-xs mt-1 leading-relaxed">
                        {language === 'hi'
                          ? `आपके पास ${collateralReceipt.quantity} टन ${collateralReceipt.crop} है। इसको गिरवी रखकर 9% ब्याज पर तुरंत लोन लें।`
                          : `You have ${collateralReceipt.quantity} tons of ${collateralReceipt.crop}. Use as collateral for instant loan at 9% interest.`}
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                      useCollateral ? "bg-emerald-500 border-emerald-500" : "border-emerald-200 group-hover:border-emerald-300"
                    }`}>
                      {useCollateral && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2.5 h-2.5 bg-white rounded-full" 
                        />
                      )}
                    </div>
                  </motion.button>
                )}

                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 bg-indigo-50 rounded-full flex items-center justify-center">
                    <ShieldCheck className="w-10 h-10 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Verify Your Profile</h3>
                  <p className="text-gray-500 text-sm">We calculate your TrustScore based on your profile completeness</p>
                </div>

                {profile && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Name</span>
                        <span className="font-semibold text-gray-900">{profile.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Total Farm Area</span>
                        <span className="font-semibold text-gray-900">{profile.totalArea || 0} Acres</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Recent Sales</span>
                        <span className="font-semibold text-gray-900">₹{profile.recentSales.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* TrustScore Gauge */}
                    <div className="bg-gradient-to-br from-indigo-50 to-emerald-50 rounded-2xl p-6 border border-indigo-100">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-gray-600">KisanMitra TrustScore</span>
                        {(() => {
                          const trust = getTrustLevel(profile.trustScore);
                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${trust.bg} ${trust.color}`}>
                              {trust.level}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="relative w-32 h-32">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke="#E5E7EB"
                              strokeWidth="12"
                              fill="none"
                            />
                            <circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke="url(#trustGradient)"
                              strokeWidth="12"
                              fill="none"
                              strokeLinecap="round"
                              strokeDasharray={351}
                              strokeDashoffset={351 - (351 * profile.trustScore) / 1000}
                            />
                            <defs>
                              <linearGradient id="trustGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#6366F1" />
                                <stop offset="100%" stopColor="#10B981" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-3xl font-bold text-gray-900">{profile.trustScore}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-center text-xs text-gray-500 mt-2">out of 1000</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setStep(2)}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-emerald-700 transition-all"
                >
                  Proceed to Loan Details <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 bg-emerald-50 rounded-full flex items-center justify-center">
                    <IndianRupee className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Configure Your Loan</h3>
                  <p className="text-gray-500 text-sm">Partner NBFCs offer competitive rates for verified farmers</p>
                </div>

                <div className="space-y-4">
                  {/* Loan Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Loan Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                      <input
                        type="number"
                        value={loanAmount}
                        max={maxLoanAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLoanAmount(val);
                          if (Number(val) > maxLoanAmount) {
                            setAmountError(`Maximum limit: ₹${maxLoanAmount.toLocaleString('en-IN')}`);
                          } else {
                            setAmountError('');
                          }
                        }}
                        placeholder="50,000"
                        className={`w-full pl-10 pr-4 py-4 bg-gray-50 border-2 rounded-xl focus:bg-white focus:ring-2 transition-all text-lg font-semibold ${
                          amountError 
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                            : 'border-gray-100 focus:border-emerald-500 focus:ring-emerald-500/20'
                        }`}
                      />
                    </div>
                    {amountError ? (
                      <p className="text-xs text-red-500 mt-1 font-medium">{amountError}</p>
                    ) : (
                      <p className={`text-xs mt-1 font-medium ${useCollateral ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {useCollateral 
                          ? `Maximum available against collateral: ₹${maxLoanAmount.toLocaleString('en-IN')}` 
                          : `Standard platform limit: ₹${maxLoanAmount.toLocaleString('en-IN')}`}
                      </p>
                    )}
                  </div>

                  {/* Purpose */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Loan Purpose</label>
                    <select
                      value={loanPurpose}
                      onChange={(e) => setLoanPurpose(e.target.value)}
                      className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none"
                    >
                      <option value="">Select purpose...</option>
                      {loanPurposes.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Repayment Duration</label>
                    <select
                      value={loanDuration}
                      onChange={(e) => setLoanDuration(e.target.value)}
                      className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none"
                    >
                      <option value="">Select duration...</option>
                      {loanDurations.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmitApplication}
                    disabled={!loanAmount || !!amountError || !loanPurpose || !loanDuration || Number(loanAmount) <= 0}
                    className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Application <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-20 h-20 mx-auto mb-6"
                  >
                    <Loader2 className="w-20 h-20 text-indigo-600" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Processing Your Application</h3>
                  <motion.p
                    key={processingText}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-gray-500"
                  >
                    {processingText}
                  </motion.p>
                </div>

                <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 rounded-2xl p-4 border border-indigo-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Zero-Risk Model</p>
                      <p className="text-xs text-gray-500">We connect you with partner NBFCs. No balance sheet risk for KisanMitra.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', duration: 0.6 }}
                    className="w-24 h-24 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Application Pre-Approved!</h3>
                  <p className="text-gray-500 text-sm">Your partner bank has reviewed and approved your application</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-5 h-5 text-emerald-600" />
                    <span className="font-semibold text-emerald-800">Partner Bank Approval</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-emerald-100">
                      <span className="text-gray-600">Loan Amount</span>
                      <span className="font-bold text-gray-900">₹{Number(loanAmount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-emerald-100">
                      <span className="text-gray-600">Interest Rate</span>
                      <span className="font-bold text-gray-900">{loanDetails?.interest}% p.a.</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-emerald-100">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-bold text-gray-900">{loanDetails?.duration} Months</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-emerald-100">
                      <span className="text-gray-600">Purpose</span>
                      <span className="font-bold text-gray-900">{getPurposeLabel(loanPurpose)}</span>
                    </div>
                  </div>

                  {/* Revenue Model Display */}
                  <div className="mt-4 pt-4 border-t-2 border-dashed border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">KisanMitra Origination Revenue</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Origination Fee (1.5% paid by Bank)</span>
                      <span className="text-lg font-bold text-emerald-600">₹{loanDetails?.originationFee.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">This fee is paid by the partner NBFC to KisanMitra for loan origination — zero risk, pure revenue.</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Application ID</span>
                  </div>
                  <span className="font-mono font-semibold">{applicationId}</span>
                </div>

                <button
                  onClick={onClose}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-emerald-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-emerald-700 transition-all"
                >
                  Done
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}