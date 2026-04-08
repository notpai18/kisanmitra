import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sprout } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { db, isMockConfig } from '../lib/firebase';
import { doc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { UP_DISTRICTS, UP_ONLY_STATE } from '../data/upDistricts';

const SOIL_OPTIONS = [
  { value: 'Clay', en: 'Clay', hi: 'चिकनी मिट्टी' },
  { value: 'Sandy', en: 'Sandy', hi: 'बलुई मिट्टी' },
  { value: 'Loam', en: 'Loam', hi: 'दोमट मिट्टी' },
  { value: 'Black', en: 'Black', hi: 'काली मिट्टी' },
  { value: 'Red', en: 'Red', hi: 'लाल मिट्टी' },
  { value: 'Alluvial', en: 'Alluvial', hi: 'जलोढ़ मिट्टी' },
];

const SEASON_OPTIONS = [
  { value: 'Kharif', en: 'Kharif (Jun-Oct)', hi: 'खरीफ (जून-अक्टूबर)' },
  { value: 'Rabi', en: 'Rabi (Nov-Mar)', hi: 'रबी (नवंबर-मार्च)' },
  { value: 'Zaid', en: 'Zaid (Mar-Jun)', hi: 'जायद (मार्च-जून)' },
];

const IRRIGATION_OPTIONS = [
  { value: 'Canal', en: 'Canal', hi: 'नहर' },
  { value: 'Tubewell', en: 'Tubewell', hi: 'नलकूप' },
  { value: 'Rainfed', en: 'Rainfed', hi: 'वर्षा आधारित' },
  { value: 'Drip', en: 'Drip', hi: 'ड्रिप सिंचाई' },
  { value: 'Sprinkler', en: 'Sprinkler', hi: 'स्प्रिंकलर' },
];

export interface FarmProfileData {
  id?: string;
  name: string;
  crops: string[];
  area: number;
  soil: string;
  state: string;
  district: string;
  irrigation: string;
  season: string;
  sowingDate?: string;
  notes?: string;
}

interface FarmFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: FarmProfileData | null;
}

const emptyFarm: FarmProfileData = {
  name: '',
  crops: [],
  area: 1,
  soil: 'Loam',
  state: UP_ONLY_STATE,
  district: '',
  irrigation: 'Tubewell',
  season: 'Kharif',
  sowingDate: new Date().toISOString().split('T')[0],
  notes: '',
};

export default function FarmFormModal({ isOpen, onClose, onSuccess, initialData }: FarmFormModalProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [formData, setFormData] = useState<FarmProfileData>(emptyFarm);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setFormData({
        ...emptyFarm,
        ...initialData,
        state: UP_ONLY_STATE,
        district: initialData.district || '',
        crops: initialData.crops || [],
      });
      setSelectedDistrict(initialData.district || '');
    } else {
      setFormData(emptyFarm);
      setSelectedDistrict('');
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDistrict) {
      alert(language === 'hi' ? 'कृपया जिला चुनें' : 'Please select your district');
      return;
    }
    if (!formData.area || Number(formData.area) <= 0) {
      alert(language === 'hi' ? 'कृपया जमीन का आकार भरें' : 'Please enter land size');
      return;
    }

    const dataToSave = {
      ...formData,
      state: UP_ONLY_STATE,
      district: selectedDistrict,
      updatedAt: serverTimestamp(),
    };

    if (!user || isMockConfig) {
      onSuccess();
      onClose();
      return;
    }

    setSaving(true);
    try {
      if (initialData?.id) {
        await updateDoc(doc(db, `users/${user.uid}/farms`, initialData.id), dataToSave);
        toast.success(language === 'hi' ? 'खेत अपडेट किया गया' : 'Farm updated');
      } else {
        await addDoc(collection(db, `users/${user.uid}/farms`), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        toast.success(language === 'hi' ? 'खेत जोड़ा गया' : 'Farm added successfully');
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Farm form save error:', err);
      alert(language === 'hi' ? 'सेव करने में त्रुटि — पुनः प्रयास करें' : 'Save failed — please try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ pointerEvents: 'auto' }}
            onTap={(e) => e.stopPropagation()}
            className="w-full max-w-lg shadow-xl"
          >
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 24,
                width: '100%',
                maxHeight: '88vh',
                overflowY: 'auto',
                overflowX: 'visible',
                zIndex: 9001,
                position: 'relative',
              }}
            >
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-forest-900 flex items-center gap-2 font-devanagari">
                  <Sprout className="w-5 h-5 text-forest-600" />
                  {initialData ? (language === 'en' ? 'Edit Farm Profile' : 'खेत प्रोफ़ाइल संपादित करें') : language === 'en' ? 'Add New Farm' : 'नया खेत जोड़ें'}
                </h2>
                <button type="button" onClick={onClose} className="p-2 hover:bg-forest-100 rounded-full text-forest-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 font-devanagari">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'en' ? 'Farm Name' : 'खेत का नाम'}</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-forest-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'en' ? 'Primary Crop' : 'प्राथमिक फसल'}
                  </label>
                  <select
                    value={formData.crops?.[0] || ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      const selectedCrop = e.target.value;
                      setFormData((prev) => ({ ...prev, crops: selectedCrop ? [selectedCrop] : [] }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                  >
                    <option value="">{language === 'hi' ? '-- फसल चुनें --' : '-- Select Crop --'}</option>
                    {['Wheat', 'Rice', 'Sugarcane', 'Potato', 'Tomato', 'Maize', 'Soybean', 'Cotton', 'Mustard', 'Other'].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                    {language === 'hi' ? 'जिला (उत्तर प्रदेश) *' : 'District (Uttar Pradesh) *'}
                  </label>
                  <select
                    value={selectedDistrict}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      const val = e.target.value;
                      setSelectedDistrict(val);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: 14,
                      borderRadius: 8,
                      border: '1.5px solid #d1d5db',
                      backgroundColor: '#ffffff',
                      color: selectedDistrict ? '#111827' : '#9ca3af',
                      cursor: 'pointer',
                      outline: 'none',
                      appearance: 'menulist',
                      WebkitAppearance: 'menulist',
                      MozAppearance: 'menulist',
                      position: 'relative',
                      zIndex: 100,
                      pointerEvents: 'auto',
                      display: 'block',
                    }}
                  >
                    <option value="">{language === 'hi' ? '-- जिला चुनें --' : '-- Select District --'}</option>
                    {UP_DISTRICTS.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                  {selectedDistrict && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✓ {language === 'hi' ? `${selectedDistrict} चुना गया` : `${selectedDistrict} selected`}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'en' ? 'Season' : 'मौसम'}</label>
                    <select
                      value={formData.season || ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        setFormData((prev) => ({ ...prev, season: e.target.value }));
                      }}
                      style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #d1d5db', backgroundColor: '#ffffff', color: '#111827', cursor: 'pointer', outline: 'none', appearance: 'menulist', WebkitAppearance: 'menulist', pointerEvents: 'auto', zIndex: 100 }}
                    >
                      <option value="">{language === 'hi' ? '-- चुनें --' : '-- Select --'}</option>
                      {SEASON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {language === 'hi' ? opt.hi : opt.en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'en' ? 'Size (Acres)' : 'आकार (एकड़)'}</label>
                    <input
                      required
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={formData.area}
                      onChange={(e) => setFormData((prev) => ({ ...prev, area: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-forest-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'en' ? 'Soil Type' : 'मिट्टी का प्रकार'}</label>
                    <select
                      value={formData.soil || ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        setFormData((prev) => ({ ...prev, soil: e.target.value }));
                      }}
                      style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #d1d5db', backgroundColor: '#ffffff', color: '#111827', cursor: 'pointer', outline: 'none', appearance: 'menulist', WebkitAppearance: 'menulist', pointerEvents: 'auto', zIndex: 100 }}
                    >
                      <option value="">{language === 'hi' ? '-- चुनें --' : '-- Select --'}</option>
                      {SOIL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {language === 'hi' ? opt.hi : opt.en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'en' ? 'Irrigation Source' : 'सिंचाई का साधन'}</label>
                    <select
                      value={formData.irrigation || ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        setFormData((prev) => ({ ...prev, irrigation: e.target.value }));
                      }}
                      style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #d1d5db', backgroundColor: '#ffffff', color: '#111827', cursor: 'pointer', outline: 'none', appearance: 'menulist', WebkitAppearance: 'menulist', pointerEvents: 'auto', zIndex: 100 }}
                    >
                      <option value="">{language === 'hi' ? '-- चुनें --' : '-- Select --'}</option>
                      {IRRIGATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {language === 'hi' ? opt.hi : opt.en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'en' ? 'Additional Notes (Optional)' : 'अतिरिक्त जानकारी (वैकल्पिक)'}</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-forest-500 outline-none resize-none"
                    rows={3}
                  />
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                  <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold">
                    {language === 'en' ? 'Cancel' : 'रद्द करें'}
                  </button>
                  <button type="submit" disabled={saving} className="px-6 py-3 rounded-xl bg-forest-600 hover:bg-forest-700 disabled:bg-forest-400 text-white font-bold">
                    {saving ? '...' : language === 'en' ? 'Save Farm' : 'खेत सहेजें'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
