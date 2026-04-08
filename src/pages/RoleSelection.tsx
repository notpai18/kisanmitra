import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tractor, Store, ArrowRight, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { auth, db, googleProvider, signInWithPopup, doc, setDoc, isMockConfig } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

export default function RoleSelection() {
  const [selectedRole, setSelectedRole] = useState<'farmer' | 'buyer' | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setUserData } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const handleGoogleSignIn = async () => {
    if (!selectedRole) return;
    
    setLoading(true);
    setErrorMsg(null);
    
    if (isMockConfig) {
      setErrorMsg("Firebase config is missing. Proceeding to dashboard in preview mode.");
      setTimeout(() => {
        setUserData({
          uid: 'mock-uid',
          name: 'Preview User',
          email: 'preview@example.com',
          role: selectedRole,
          language: language,
          createdAt: new Date().toISOString(),
        });
        navigate('/dashboard');
      }, 1500);
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userData = {
        uid: user.uid,
        name: user.displayName || 'User',
        email: user.email || '',
        role: selectedRole,
        language: language,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', user.uid), userData, { merge: true });
      setUserData(userData);
      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('Error signing in with Google:', error);
      const msg = error instanceof Error ? error.message : t('error_generic');
      setErrorMsg(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-light flex flex-col items-center justify-center p-4">
      {/* Language Toggle */}
      <div className="fixed top-4 right-4 z-50 flex rounded-full overflow-hidden border-2 border-forest-600 shadow-md bg-white">
        <button
          onClick={() => setLanguage('en')}
          className={`px-4 py-2 text-sm font-bold transition-colors ${
            language === 'en'
              ? 'bg-forest-600 text-white'
              : 'bg-white text-forest-600 hover:bg-forest-50'
          }`}
        >
          English
        </button>
        <button
          onClick={() => setLanguage('hi')}
          className={`px-4 py-2 text-sm font-bold transition-colors ${
            language === 'hi'
              ? 'bg-forest-600 text-white'
              : 'bg-white text-forest-600 hover:bg-forest-50'
          }`}
        >
          हिंदी
        </button>
      </div>

      <div className="max-w-3xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-forest-900 mb-4 font-devanagari">{t('select_role')}</h1>
          <p className="text-gray-500 font-devanagari">{t('select_role_sub')}</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <p>{errorMsg}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedRole('farmer')}
            className={`p-8 rounded-2xl border-2 text-left transition-all ${
              selectedRole === 'farmer' 
                ? 'border-forest-500 bg-forest-50 shadow-[0_4px_24px_rgba(34,197,94,0.15)]' 
                : 'border-gray-200 bg-white hover:border-forest-200'
            }`}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
              selectedRole === 'farmer' ? 'bg-forest-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <Tractor className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 font-devanagari">{t('farmer')}</h2>
            <p className="text-gray-500 font-devanagari">{t('farmer_desc')}</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedRole('buyer')}
            className={`p-8 rounded-2xl border-2 text-left transition-all ${
              selectedRole === 'buyer' 
                ? 'border-gold-500 bg-yellow-50 shadow-[0_4px_24px_rgba(245,158,11,0.15)]' 
                : 'border-gray-200 bg-white hover:border-gold-200'
            }`}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
              selectedRole === 'buyer' ? 'bg-gold-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <Store className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 font-devanagari">{t('buyer')}</h2>
            <p className="text-gray-500 font-devanagari">{t('buyer_desc')}</p>
          </motion.button>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleGoogleSignIn}
            disabled={!selectedRole || loading}
            className={`px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 transition-all font-devanagari ${
              selectedRole 
                ? 'bg-forest-900 text-white hover:bg-forest-800 shadow-lg cursor-pointer' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                {t('sign_in_google')} <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
