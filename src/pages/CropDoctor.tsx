import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, isMockConfig } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import LocationSelector from '../components/LocationSelector';
import { FarmProfileData } from '../components/FarmFormModal';
import { Stethoscope, UploadCloud, Camera, Image as ImageIcon, Microscope, CheckCircle, AlertTriangle, Info, ShieldAlert, ShieldCheck, Save, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { UI } from '../constants/translations';
import { formatDate } from '../utils/formatDate';

interface DiagnosisResult {
  disease_name: string;
  confidence_percent: number;
  severity: 'Low' | 'Medium' | 'High';
  cause: string;
  treatment_steps: string[];
  prevention_tips: string[];
  is_healthy: boolean;
}

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
}

const CROP_TYPES = ['Wheat', 'Rice', 'Tomato', 'Potato', 'Sugarcane', 'Maize', 'Other'];

export default function CropDoctor() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [image, setImage] = useState<string | null>(null);
  const [cropType, setCropType] = useState('Wheat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'cause' | 'treatment' | 'prevention'>('diagnosis');
  const [viewMode, setViewMode] = useState<'new' | 'history'>('new');
  const [recentReports, setRecentReports] = useState<CropReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [ctxState, setCtxState] = useState('');
  const [ctxDistrict, setCtxDistrict] = useState('');
  const [ctxErr, setCtxErr] = useState({ state: '', district: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!user || isMockConfig) return;
    const q = query(collection(db, 'users', user.uid, 'cropReports'), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports: CropReport[] = snapshot.docs.map((d) => {
        const raw: any = d.data();
        const cropName = raw.cropName ?? raw.cropType ?? '';
        const diseaseName = raw.diseaseName ?? raw.disease_name ?? '';
        const confidence = Number(raw.confidence ?? raw.confidence_percent ?? 0);
        const severity = (raw.severity ?? 'Low') as CropReport['severity'];
        const symptoms = raw.symptoms ?? raw.cause ?? '';
        const treatment = raw.treatment ?? (Array.isArray(raw.treatment_steps) ? raw.treatment_steps.join('\n') : '');
        const prevention = raw.prevention ?? (Array.isArray(raw.prevention_tips) ? raw.prevention_tips.join('\n') : '');
        const createdAt = raw.createdAt ?? raw.timestamp ?? '';
        return {
          id: d.id,
          cropName,
          diseaseName,
          severity,
          confidence,
          symptoms,
          treatment,
          prevention,
          actualCropDetected: raw.actualCropDetected,
          createdAt,
          imageUrl: raw.imageUrl,
        };
      });
      setRecentReports(reports);
    });
    return () => unsubscribe();
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
        setSaveSuccess(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
        setSaveSuccess(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDiagnose = async () => {
    if (!image) return;
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
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/crop-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, cropType, language, state: ctxState, district: ctxDistrict })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.message || 'Failed to analyze image');
      }

      setResult(data as DiagnosisResult);
    } catch (err) {
      console.error(err);
      toast.error(UI.aiUnavailable);
      setError(err instanceof Error ? err.message : 'फसल की जांच करने में समस्या आई। कृपया पुनः प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!user || !result || isMockConfig) return;
    setSaving(true);
    try {
      const symptoms = result.cause || '';
      const treatment = Array.isArray(result.treatment_steps) ? result.treatment_steps.join('\n') : '';
      const prevention = Array.isArray(result.prevention_tips) ? result.prevention_tips.join('\n') : '';

      await addDoc(collection(db, 'users', user.uid, 'cropReports'), {
        cropName: cropType,
        diseaseName: result.disease_name,
        confidence: result.confidence_percent,
        severity: result.severity,
        symptoms,
        treatment,
        prevention,
        // Keep these too (back-compat + future UI)
        cause: result.cause,
        treatment_steps: result.treatment_steps,
        prevention_tips: result.prevention_tips,
        isHealthy: result.is_healthy,
        timestamp: new Date().toISOString(),
      });
      setSaveSuccess(true);
      toast.success('Report saved');
    } catch (err) {
      console.error('Error saving report:', err);
      setError('Failed to save report.');
      toast.error(UI.errorTitleEn);
    } finally {
      setSaving(false);
    }
  };

  const CircularProgress = ({ percentage, color }: { percentage: number, color: string }) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center w-24 h-24">
        <svg className="transform -rotate-90 w-24 h-24">
          <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
          <circle 
            cx="48" cy="48" r={radius} 
            stroke="currentColor" strokeWidth="8" fill="transparent" 
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} 
            className={color} strokeLinecap="round" 
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-800">{percentage}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
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
        
        <div className="flex bg-gray-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
          <button 
            onClick={() => setViewMode('new')}
            className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition-all", viewMode === 'new' ? "bg-white text-forest-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            {language === 'en' ? 'New Diagnosis' : 'नया निदान'}
          </button>
          <button 
            onClick={() => setViewMode('history')}
            className={clsx("px-4 py-2 rounded-lg text-sm font-bold transition-all", viewMode === 'history' ? "bg-white text-forest-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            {language === 'en' ? 'Past Reports' : 'पिछली रिपोर्ट'}
          </button>
        </div>
      </div>

      {viewMode === 'new' && (
        <div className="space-y-8 animate-fade-in">
          {/* Upload Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        {!image ? (
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
            
            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageUpload} className="hidden" />
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-md mb-6 bg-gray-100">
              <img src={image} alt="Crop" loading="lazy" className="w-full h-auto object-cover max-h-[400px]" />
              <button 
                onClick={() => { setImage(null); setResult(null); }}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="w-full max-w-md space-y-4">
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
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
            </div>
          </div>
        )}
      </div>

      {/* Diagnosis Result */}
      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className={clsx(
              "p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b",
              result.is_healthy ? "bg-green-50/50 border-green-100" : "bg-red-50/50 border-red-100"
            )}>
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                  {result.is_healthy ? <ShieldCheck className="w-8 h-8 text-green-600" /> : <ShieldAlert className="w-8 h-8 text-red-600" />}
                  <h2 className={clsx(
                    "text-3xl font-bold",
                    result.is_healthy ? "text-green-700" : "text-red-700"
                  )}>
                    {result.disease_name}
                  </h2>
                </div>
                {!result.is_healthy && (
                  <div className="flex items-center justify-center md:justify-start gap-2 mt-3">
                    <span className="text-gray-600 font-medium">Severity:</span>
                    <span className={clsx(
                      "px-3 py-1 rounded-full text-sm font-bold",
                      result.severity === 'Low' ? "bg-yellow-100 text-yellow-800" :
                      result.severity === 'Medium' ? "bg-orange-100 text-orange-800" :
                      "bg-red-100 text-red-800"
                    )}>
                      {result.severity}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-center">
                <CircularProgress 
                  percentage={result.confidence_percent} 
                  color={result.is_healthy ? "text-green-500" : "text-red-500"} 
                />
                <span className="text-sm text-gray-500 mt-2 font-medium font-devanagari">{t('doc_confidence')}</span>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="flex flex-wrap gap-2 mb-6">
                {(['diagnosis', 'cause', 'treatment', 'prevention'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      "px-5 py-2.5 rounded-full text-sm font-bold transition-colors capitalize",
                      activeTab === tab 
                        ? "bg-forest-900 text-white shadow-md" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 min-h-[200px]">
                {activeTab === 'diagnosis' && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 font-devanagari"><Info className="w-5 h-5 text-forest-600" /> {t('doc_diagnosis_details')}</h3>
                    <p className="text-gray-700 leading-relaxed font-devanagari">{result.is_healthy ? t('doc_healthy_text') : `The AI has detected signs of ${result.disease_name}.`}</p>
                  </div>
                )}
                {activeTab === 'cause' && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 font-devanagari"><AlertTriangle className="w-5 h-5 text-yellow-600" /> {t('doc_cause')}</h3>
                    <p className="text-gray-700 leading-relaxed">{result.cause}</p>
                  </div>
                )}
                {activeTab === 'treatment' && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 font-devanagari"><Stethoscope className="w-5 h-5 text-blue-600" /> {t('doc_treatment')}</h3>
                    <ul className="space-y-3">
                      {result.treatment_steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-sm font-bold mt-0.5">{i + 1}</div>
                          <span className="text-gray-700">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeTab === 'prevention' && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 font-devanagari"><ShieldCheck className="w-5 h-5 text-green-600" /> {t('doc_prevention')}</h3>
                    <ul className="space-y-3">
                      {result.prevention_tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-gray-700">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={handleSaveReport}
                  disabled={saving || saveSuccess || isMockConfig}
                  className="bg-forest-100 hover:bg-forest-200 text-forest-800 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {saveSuccess ? <><CheckCircle className="w-5 h-5" /> {t('doc_saved')}</> : <><Save className="w-5 h-5" /> {t('doc_save_report')}</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      )}

      {/* Past Reports Tab */}
      {viewMode === 'history' && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" /> {language === 'en' ? 'Past Reports' : 'पिछली रिपोर्ट'}
          </h2>
          {recentReports.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {recentReports.map(report => (
                <div key={report.id} className="border rounded-xl p-4 bg-white shadow-sm border-gray-100">
                  {/* Always visible summary */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex text-sm font-bold text-forest-700 bg-forest-50 px-2.5 py-1 rounded-md">
                        {report.cropName}
                      </span>
                      <p className="text-red-600 font-bold mt-2 truncate">{report.diseaseName}</p>
                      <p className="text-sm text-gray-600 mt-1">{report.confidence}% Confidence</p>
                      <span
                        className={clsx(
                          'inline-flex mt-2 font-bold px-2.5 py-1 rounded-lg uppercase text-xs tracking-wide',
                          report.severity === 'Low'
                            ? 'bg-yellow-100 text-yellow-800'
                            : report.severity === 'Medium'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-red-100 text-red-800'
                        )}
                      >
                        {report.severity}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                      className="text-green-600 text-sm font-medium shrink-0"
                    >
                      {expandedId === report.id ? '▲ Collapse' : '▼ View Details'}
                    </button>
                  </div>

                  {/* Expanded full report */}
                  {expandedId === report.id && (
                    <div className="mt-4 border-t pt-4 space-y-3">
                      {report.actualCropDetected && report.actualCropDetected !== report.cropName && (
                        <div className="bg-yellow-50 p-3 rounded-lg">
                          <p className="text-yellow-700 text-sm">⚠️ Actual crop detected: {report.actualCropDetected}</p>
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-gray-700">Symptoms</h4>
                        <p className="text-gray-600 text-sm whitespace-pre-line">{report.symptoms}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-700">Treatment</h4>
                        <p className="text-gray-600 text-sm whitespace-pre-line">{report.treatment}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-700">Prevention</h4>
                        <p className="text-gray-600 text-sm whitespace-pre-line">{report.prevention}</p>
                      </div>
                      <p className="text-xs text-gray-400">{formatDate(report.createdAt, { showTime: true })}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">{language === 'en' ? 'No past reports found.' : 'कोई पिछली रिपोर्ट नहीं मिली।'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
