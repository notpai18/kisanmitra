import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, isMockConfig } from '../lib/firebase';
import { collection, addDoc } from '../lib/firebase';
import { ChevronRight, MapPin, Leaf, Calendar, CheckCircle, Loader2, X, FlaskConical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const CROP_OPTIONS = ['Wheat', 'Rice', 'Maize', 'Sugarcane', 'Potato', 'Tomato', 'Soybean', 'Mustard', 'Cotton', 'Pulses', 'Other'];

interface ServiceRequest {
  id?: string;
  userId: string;
  userName: string;
  serviceType: 'soil_test';
  farmLocation: string;
  state: string;
  district: string;
  cropType: string;
  preferredDate: string;
  status: 'pending_payment' | 'paid' | 'scheduled' | 'completed' | 'cancelled';
  price: number;
  createdAt: any;
}

const SOIL_TEST_PRICE = 499; // INR

export default function SoilTestCard() {
  const { user, userData } = useAuth();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    farmLocation: '',
    state: '',
    district: '',
    cropType: '',
    preferredDate: '',
  });

  const resetForm = () => {
    setStep(1);
    setFormData({
      farmLocation: '',
      state: '',
      district: '',
      cropType: '',
      preferredDate: '',
    });
    setSubmitted(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
    resetForm();
  };

  const handleClose = () => {
    setIsOpen(false);
    resetForm();
  };

  const validateStep = () => {
    if (step === 1) {
      return formData.state && formData.district && formData.farmLocation;
    }
    if (step === 2) {
      return formData.cropType;
    }
    if (step === 3) {
      return formData.preferredDate;
    }
    return false;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!user || !userData) return;

    setSubmitting(true);
    try {
      const requestData: Omit<ServiceRequest, 'id'> = {
        userId: user.uid,
        userName: userData.name,
        serviceType: 'soil_test',
        farmLocation: formData.farmLocation,
        state: formData.state,
        district: formData.district,
        cropType: formData.cropType,
        preferredDate: formData.preferredDate,
        status: 'pending_payment',
        price: SOIL_TEST_PRICE,
        createdAt: isMockConfig ? { seconds: Math.floor(Date.now() / 1000) } : new Date(),
      };

      if (isMockConfig) {
        // Simulate success in mock mode
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        await addDoc(collection(db, 'service_requests'), requestData);
      }

      setSubmitted(true);
      toast.success(language === 'hi' ? 'अनुरोध प्राप्त हुआ!' : 'Request Received!');
    } catch (err) {
      console.error('Error submitting service request:', err);
      toast.error(language === 'hi' ? 'त्रुटि' : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Soil Test Card Trigger */}
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleOpen}
        className="h-full bg-white rounded-2xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md transition-shadow flex flex-col justify-between"
      >
        {/* Content */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {language === 'hi' ? 'मृदा परीक्षण' : 'Soil Test'}
          </h3>
          <p className="text-sm text-gray-500 mb-3 font-devanagari">
            {language === 'hi'
              ? 'अपनी मिट्टी की गुणवत्ता जानें'
              : 'Know your soil quality'}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-auto pt-4">
          <span className="text-xl font-bold text-gray-900">₹{SOIL_TEST_PRICE}</span>
          <span className="text-sm text-gray-500">{language === 'hi' ? 'लिए' : 'for'}</span>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </motion.div>

      {/* Multi-step Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={handleClose}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="relative bg-gray-50 border-b border-gray-100 p-6">
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>

                {!submitted ? (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                        <FlaskConical className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {language === 'hi' ? 'मृदा परीक्षण अनुरोध' : 'Request Soil Test'}
                    </h2>
                    <p className="text-gray-500 text-sm">
                      {language === 'hi'
                        ? '₹499 में पेशेवर मृदा विश्लेषण'
                        : 'Professional soil analysis for ₹499'}
                    </p>

                    {/* Step Indicator */}
                    <div className="flex items-center gap-2 mt-6">
                      {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                          <div className={clsx(
                            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                            step >= s ? 'bg-white text-emerald-700' : 'bg-white/30 text-white'
                          )}>
                            {s}
                          </div>
                          {s < 3 && (
                            <div className={clsx(
                              'w-8 h-0.5 mx-1',
                              step > s ? 'bg-white' : 'bg-white/30'
                            )} />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-10 h-10" />
                    <div>
                      <h2 className="text-2xl font-bold">
                        {language === 'hi' ? 'अनुरोध प्राप्त!' : 'Request Received!'}
                      </h2>
                      <p className="text-white/80 text-sm">
                        {language === 'hi'
                          ? 'हम जल्द ही आपसे संपर्क करेंगे'
                          : 'We will contact you soon'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {!submitted ? (
                  <AnimatePresence mode="wait">
                    {/* Step 1: Location */}
                    {step === 1 && (
                      <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-emerald-600" />
                          {language === 'hi' ? 'खेत का स्थान' : 'Farm Location'}
                        </h3>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {language === 'hi' ? 'राज्य *' : 'State *'}
                          </label>
                          <select
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value, district: '' })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          >
                            <option value="">{language === 'hi' ? 'राज्य चुनें' : 'Select state'}</option>
                            <option value="Uttar Pradesh">Uttar Pradesh</option>
                            <option value="Bihar">Bihar</option>
                            <option value="Madhya Pradesh">Madhya Pradesh</option>
                            <option value="Punjab">Punjab</option>
                            <option value="Haryana">Haryana</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {language === 'hi' ? 'जिला *' : 'District *'}
                          </label>
                          <select
                            value={formData.district}
                            onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                            disabled={!formData.state}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                          >
                            <option value="">{language === 'hi' ? 'जिला चुनें' : 'Select district'}</option>
                            {formData.state === 'Uttar Pradesh' && (
                              <>
                                <option value="Lucknow">Lucknow</option>
                                <option value="Varanasi">Varanasi</option>
                                <option value="Gorakhpur">Gorakhpur</option>
                                <option value="Allahabad">Allahabad</option>
                                <option value="Bareilly">Bareilly</option>
                                <option value="Agra">Agra</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {language === 'hi' ? 'गांव/पता' : 'Village/Address'}
                          </label>
                          <input
                            type="text"
                            value={formData.farmLocation}
                            onChange={(e) => setFormData({ ...formData, farmLocation: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder={language === 'hi' ? 'गांव का नाम' : 'Village name'}
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Crop */}
                    {step === 2 && (
                      <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          <Leaf className="w-5 h-5 text-emerald-600" />
                          {language === 'hi' ? 'फसल का प्रकार' : 'Crop Type'}
                        </h3>

                        <div className="grid grid-cols-2 gap-3">
                          {CROP_OPTIONS.map((crop) => (
                            <button
                              key={crop}
                              onClick={() => setFormData({ ...formData, cropType: crop })}
                              className={clsx(
                                'p-3 rounded-xl border-2 text-left transition-all',
                                formData.cropType === crop
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                  : 'border-gray-200 hover:border-emerald-200'
                              )}
                            >
                              <span className="font-medium">{crop}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Date */}
                    {step === 3 && (
                      <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-emerald-600" />
                          {language === 'hi' ? 'पसंदीदा तिथि' : 'Preferred Date'}
                        </h3>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {language === 'hi' ? 'नमूना लेने की तारीख चुनें' : 'Select collection date'}
                          </label>
                          <input
                            type="date"
                            value={formData.preferredDate}
                            onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                            min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                        </div>

                        {/* Summary */}
                        <div className="bg-emerald-50 rounded-xl p-4 mt-4">
                          <h4 className="font-bold text-emerald-900 mb-3">
                            {language === 'hi' ? 'सारांश' : 'Summary'}
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">{language === 'hi' ? 'स्थान' : 'Location'}</span>
                              <span className="font-medium">{formData.district}, {formData.state}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">{language === 'hi' ? 'फसल' : 'Crop'}</span>
                              <span className="font-medium">{formData.cropType}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">{language === 'hi' ? 'तारीख' : 'Date'}</span>
                              <span className="font-medium">
                                {formData.preferredDate ? new Date(formData.preferredDate).toLocaleDateString() : '-'}
                              </span>
                            </div>
                            <div className="border-t border-emerald-200 pt-2 mt-2">
                              <div className="flex justify-between">
                                <span className="font-bold text-emerald-900">{language === 'hi' ? 'कीमत' : 'Price'}</span>
                                <span className="font-bold text-emerald-900">₹{SOIL_TEST_PRICE}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                ) : (
                  /* Success Screen */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                      className="w-20 h-20 bg-emerald-100 rounded-full mx-auto flex items-center justify-center mb-6"
                    >
                      <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </motion.div>

                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {language === 'hi' ? 'धन्यवाद!' : 'Thank You!'}
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {language === 'hi'
                        ? 'आपका अनुरोध सफलतापूर्वक दर्ज कर लिया गया है।'
                        : 'Your request has been successfully registered.'}
                    </p>

                    <div className="bg-emerald-50 rounded-xl p-4 text-left">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">{language === 'hi' ? 'सेवा' : 'Service'}</span>
                        <span className="font-bold">Soil Test</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">{language === 'hi' ? 'स्थिति' : 'Status'}</span>
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                          {language === 'hi' ? 'भुगतान लंबित' : 'PENDING PAYMENT'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">{language === 'hi' ? 'राशि' : 'Amount'}</span>
                        <span className="font-bold text-emerald-700">₹{SOIL_TEST_PRICE}</span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mt-4">
                      {language === 'hi'
                        ? 'भुगतान के बाद, एजेंट आपके खेत का दौरा करेगा।'
                        : 'Once paid, an agent will visit your farm.'}
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Footer Actions */}
              {!submitted && (
                <div className="p-6 border-t bg-gray-50">
                  <div className="flex gap-3">
                    {step > 1 && (
                      <button
                        onClick={handleBack}
                        className="flex-1 py-3 rounded-xl font-bold text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        {language === 'hi' ? 'वापस' : 'Back'}
                      </button>
                    )}
                    {step < 3 ? (
                      <button
                        onClick={handleNext}
                        disabled={!validateStep()}
                        className="flex-1 py-3 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {language === 'hi' ? 'आगे' : 'Next'}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            {language === 'hi' ? 'जमा करें' : 'Submit Request'}
                            <CheckCircle className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}