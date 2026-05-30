import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, doc, setDoc, getDoc, getDocs, collection, deleteDoc, query, where } from '../lib/firebase';
import { Users, Plus, Trash2, Edit2, Phone, MapPin, Wheat, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface FarmerProfile {
  id: string;
  name: string;
  phone?: string;
  village?: string;
  district?: string;
  state?: string;
  area?: number;
  areaUnit?: 'acre' | 'bigha' | 'hectare';
  crops?: string[];
  createdAt: string;
  isActive: boolean;
}

const CROP_OPTIONS = [
  'Wheat', 'Rice', 'Potato', 'Tomato', 'Onion', 'Sugarcane', 'Maize',
  'Cotton', 'Soybean', 'Mustard', 'Groundnut', 'Turmeric', 'Gram', 'Moong', 'Barley'
];

export default function VillageAgent() {
  const { user, userData, setUserData } = useAuth();
  const { language, t } = useLanguage();
  const [farmers, setFarmers] = useState<FarmerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<FarmerProfile | null>(null);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    village: '',
    district: '',
    state: 'Uttar Pradesh',
    area: '',
    areaUnit: 'acre' as const,
    crops: [] as string[],
  });

  useEffect(() => {
    if (user && userData?.role === 'village_agent') {
      fetchFarmers();
    }
  }, [user, userData]);

  const fetchFarmers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, `users/${user.uid}/farmers`));
      const farmerList: FarmerProfile[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FarmerProfile));
      setFarmers(farmerList);

      // Set current farmer if exists
      if (userData?.currentFarmerId) {
        setSelectedFarmerId(userData.currentFarmerId);
      } else if (farmerList.length > 0) {
        setSelectedFarmerId(farmerList[0].id);
      }
    } catch (error) {
      console.error('Error fetching farmers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name.trim()) {
      toast.error(language === 'hi' ? 'नाम आवश्यक है' : 'Name is required');
      return;
    }

    try {
      const farmerId = editingFarmer?.id || `farmer_${Date.now()}`;
      const farmerData: FarmerProfile = {
        id: farmerId,
        name: formData.name.trim(),
        phone: formData.phone || undefined,
        village: formData.village || undefined,
        district: formData.district || undefined,
        state: formData.state,
        area: formData.area ? Number(formData.area) : undefined,
        areaUnit: formData.areaUnit,
        crops: formData.crops,
        createdAt: editingFarmer?.createdAt || new Date().toISOString(),
        isActive: true,
      };

      await setDoc(doc(db, `users/${user.uid}/farmers`, farmerId), farmerData);

      // Update user's managedFarmerIds
      const updatedFarmerIds = userData?.managedFarmerIds || [];
      if (!updatedFarmerIds.includes(farmerId)) {
        await setDoc(doc(db, 'users', user.uid), {
          ...userData,
          managedFarmerIds: [...updatedFarmerIds, farmerId],
        }, { merge: true });
      }

      toast.success(language === 'hi'
        ? editingFarmer ? 'किसान अपडेट किया गया' : 'किसान जोड़ा गया'
        : editingFarmer ? 'Farmer updated' : 'Farmer added'
      );

      setShowModal(false);
      setEditingFarmer(null);
      resetForm();
      fetchFarmers();
    } catch (error) {
      console.error('Error saving farmer:', error);
      toast.error(language === 'hi' ? 'त्रुटि हुई' : 'Error occurred');
    }
  };

  const handleDelete = async (farmerId: string) => {
    if (!user) return;
    if (!confirm(language === 'hi' ? 'इस किसान को हटाना है?' : 'Delete this farmer?')) return;

    try {
      await deleteDoc(doc(db, `users/${user.uid}/farmers`, farmerId));
      const updatedFarmerIds = (userData?.managedFarmerIds || []).filter(id => id !== farmerId);
      await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        managedFarmerIds: updatedFarmerIds,
      }, { merge: true });

      if (selectedFarmerId === farmerId) {
        setSelectedFarmerId(null);
      }

      toast.success(language === 'hi' ? 'किसान हटाया गया' : 'Farmer deleted');
      fetchFarmers();
    } catch (error) {
      console.error('Error deleting farmer:', error);
    }
  };

  const handleSelectFarmer = (farmerId: string) => {
    setSelectedFarmerId(farmerId);
    setUserData({ ...userData!, currentFarmerId: farmerId } as any);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      village: '',
      district: '',
      state: 'Uttar Pradesh',
      area: '',
      areaUnit: 'acre',
      crops: [],
    });
  };

  const openEditModal = (farmer: FarmerProfile) => {
    setEditingFarmer(farmer);
    setFormData({
      name: farmer.name,
      phone: farmer.phone || '',
      village: farmer.village || '',
      district: farmer.district || '',
      state: farmer.state || 'Uttar Pradesh',
      area: farmer.area?.toString() || '',
      areaUnit: farmer.areaUnit || 'acre',
      crops: farmer.crops || [],
    });
    setShowModal(true);
  };

  const toggleCrop = (crop: string) => {
    setFormData(prev => ({
      ...prev,
      crops: prev.crops.includes(crop)
        ? prev.crops.filter(c => c !== crop)
        : [...prev.crops, crop]
    }));
  };

  if (userData?.role !== 'village_agent') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Access denied</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-forest-900 font-devanagari">
              {language === 'hi' ? 'ग्राम एजेंट पैनल' : 'Village Agent Panel'}
            </h1>
            <p className="text-gray-500 mt-1">
              {language === 'hi' ? 'अपने किसानों को प्रबंधित करें' : 'Manage your farmers'}
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setEditingFarmer(null); setShowModal(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-forest-600 text-white rounded-xl hover:bg-forest-700 transition-colors font-devanagari"
          >
            <Plus className="w-5 h-5" />
            {language === 'hi' ? 'नया किसान' : 'Add Farmer'}
          </button>
        </div>

        {/* Current Farmer Selector */}
        {farmers.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              {language === 'hi' ? 'वर्तमान किसान चुनें' : 'Select Current Farmer'}
            </h2>
            <div className="flex flex-wrap gap-3">
              {farmers.map(farmer => (
                <button
                  key={farmer.id}
                  onClick={() => handleSelectFarmer(farmer.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                    selectedFarmerId === farmer.id
                      ? 'border-forest-500 bg-forest-50 text-forest-700'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  {selectedFarmerId === farmer.id ? (
                    <CheckCircle className="w-4 h-4 text-forest-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className="font-medium">{farmer.name}</span>
                  {farmer.isActive && (
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>
            {selectedFarmerId && (
              <p className="mt-3 text-sm text-gray-500">
                {language === 'hi'
                  ? 'अब आप इस किसान के लिए लिस्टिंग और डायग्नोसिस बना सकते हैं'
                  : 'You can now create listings and diagnoses for this farmer'}
              </p>
            )}
          </div>
        )}

        {/* Farmers List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">
              {language === 'hi' ? 'सभी किसान' : 'All Farmers'} ({farmers.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : farmers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-devanagari">
                {language === 'hi'
                  ? 'अभी तक कोई किसान नहीं जोड़ा गया'
                  : 'No farmers added yet'}
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 text-forest-600 hover:underline font-devanagari"
              >
                {language === 'hi' ? 'पहला किसान जोड़ें' : 'Add your first farmer'}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {farmers.map(farmer => (
                <div key={farmer.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      farmer.isActive ? 'bg-forest-100 text-forest-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{farmer.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        {farmer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" /> {farmer.phone}
                          </span>
                        )}
                        {farmer.village && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" /> {farmer.village}, {farmer.district}
                          </span>
                        )}
                        {farmer.area && (
                          <span className="flex items-center gap-1">
                            <Wheat className="w-4 h-4" /> {farmer.area} {farmer.areaUnit}
                          </span>
                        )}
                      </div>
                      {farmer.crops && farmer.crops.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {farmer.crops.map(crop => (
                            <span key={crop} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
                              {crop}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(farmer)}
                      className="p-2 text-gray-400 hover:text-forest-600 transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(farmer.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 font-devanagari">
                  {editingFarmer
                    ? (language === 'hi' ? 'किसान संपादित करें' : 'Edit Farmer')
                    : (language === 'hi' ? 'नया किसान जोड़ें' : 'Add Farmer')}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'hi' ? 'नाम *' : 'Name *'}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-forest-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'hi' ? 'फ़ोन नंबर' : 'Phone Number'}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-forest-500 focus:outline-none"
                    maxLength={10}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {language === 'hi' ? 'गाँव' : 'Village'}
                    </label>
                    <input
                      type="text"
                      value={formData.village}
                      onChange={e => setFormData({ ...formData, village: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-forest-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {language === 'hi' ? 'जिला' : 'District'}
                    </label>
                    <input
                      type="text"
                      value={formData.district}
                      onChange={e => setFormData({ ...formData, district: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-forest-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {language === 'hi' ? 'राज्य' : 'State'}
                    </label>
                    <select
                      value={formData.state}
                      onChange={e => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-forest-500 focus:outline-none"
                    >
                      <option value="Uttar Pradesh">Uttar Pradesh</option>
                      <option value="Bihar">Bihar</option>
                      <option value="Madhya Pradesh">Madhya Pradesh</option>
                      <option value="Rajasthan">Rajasthan</option>
                      <option value="Punjab">Punjab</option>
                      <option value="Haryana">Haryana</option>
                      <option value="Maharashtra">Maharashtra</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {language === 'hi' ? 'क्षेत्रफल' : 'Area'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={formData.area}
                        onChange={e => setFormData({ ...formData, area: e.target.value })}
                        className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:border-forest-500 focus:outline-none"
                        min="0"
                      />
                      <select
                        value={formData.areaUnit}
                        onChange={e => setFormData({ ...formData, areaUnit: e.target.value as any })}
                        className="px-3 py-2 rounded-xl border border-gray-200 focus:border-forest-500 focus:outline-none"
                      >
                        <option value="acre">acre</option>
                        <option value="bigha">bigha</option>
                        <option value="hectare">ha</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'hi' ? 'फसलें' : 'Crops'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CROP_OPTIONS.map(crop => (
                      <button
                        key={crop}
                        type="button"
                        onClick={() => toggleCrop(crop)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          formData.crops.includes(crop)
                            ? 'bg-forest-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {crop}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-forest-600 text-white rounded-xl font-bold hover:bg-forest-700 transition-colors font-devanagari"
                >
                  {editingFarmer
                    ? (language === 'hi' ? 'अपडेट करें' : 'Update')
                    : (language === 'hi' ? 'जोड़ें' : 'Add')}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}