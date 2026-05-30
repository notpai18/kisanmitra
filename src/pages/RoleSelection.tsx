import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tractor, Store, ArrowRight, AlertCircle, CheckCircle2, Phone, ShieldCheck, ChevronLeft, Users, Truck, Warehouse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, setDoc, getDoc, isMockConfig } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

type AuthStep = 'role' | 'phone' | 'otp';
type UserRole = 'farmer' | 'buyer' | 'seller' | 'village_agent' | 'transporter' | 'warehouse_owner';

export default function RoleSelection() {
  const [step, setStep] = useState<AuthStep>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { user, userData, setUserData, sendOTP, verifyOTP, signInWithGoogle } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const TEST_PHONE = '9876543210';
  const TEST_OTP = '123456';

  // Redirect if user already has a role
  useEffect(() => {
    if (user && userData) {
      // Redirect based on role
      if (userData.role === 'transporter') {
        navigate('/transporter-dashboard');
      } else if (userData.role === 'warehouse_owner') {
        navigate('/warehouse-dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, userData, navigate]);

  const handleGoogleSignIn = async () => {
    if (!selectedRole) return;
    setLoading(true);
    setErrorMsg(null);

    if (isMockConfig) {
      setTimeout(() => {
        const mockData = {
          uid: 'mock-google-uid',
          name: 'Google User',
          email: 'google@example.com',
          role: selectedRole,
          language: language,
          createdAt: new Date().toISOString(),
        };
        setUserData(mockData as any);
        navigate('/dashboard');
      }, 1000);
      return;
    }

    try {
      const firebaseUser = await signInWithGoogle();
      if (firebaseUser) {
        await handleUserDoc(firebaseUser);
      }
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      setErrorMsg(error.message || t('error_generic'));
      toast.error(error.message || t('error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error(t('invalid_phone'));
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // Magic Number / Mock Bypass
    if (phoneNumber === TEST_PHONE || isMockConfig) {
      setTimeout(() => {
        setStep('otp');
        setLoading(false);
        toast.success(phoneNumber === TEST_PHONE ? 'Test Mode: Use code 123456' : 'Mock OTP Sent');
      }, 800);
      return;
    }

    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      await sendOTP(formattedPhone, 'recaptcha-container');
      setStep('otp');
      toast.success('OTP sent successfully');
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      setErrorMsg(error.message || t('error_generic'));
      toast.error(error.message || t('error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error(t('enter_otp'));
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // Magic OTP / Mock Bypass
    if ((phoneNumber === TEST_PHONE && otp === TEST_OTP) || isMockConfig) {
      setTimeout(() => {
        const mockUserData = {
          uid: 'test-uid-' + phoneNumber,
          name: phoneNumber === TEST_PHONE ? 'Test Farmer' : 'Phone User',
          phone: '+91' + phoneNumber,
          role: selectedRole,
          language: language,
          createdAt: new Date().toISOString(),
        };
        setUserData(mockUserData as any);
        navigate('/dashboard');
        setLoading(false);
        toast.success('Test Login Successful');
      }, 800);
      return;
    }

    try {
      const firebaseUser = await verifyOTP(otp);
      if (firebaseUser) {
        await handleUserDoc(firebaseUser);
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      setErrorMsg(t('invalid_otp'));
      toast.error(t('invalid_otp'));
    } finally {
      setLoading(false);
    }
  };

  const handleUserDoc = async (firebaseUser: any) => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    let finalUserData;

    if (userDoc.exists()) {
      const existingData = userDoc.data();
      finalUserData = {
        ...existingData,
        role: existingData.role || selectedRole,
        language: language,
      };
      await setDoc(userDocRef, finalUserData, { merge: true });
    } else {
      finalUserData = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || 'User',
        email: firebaseUser.email || '',
        phone: firebaseUser.phoneNumber || '',
        role: selectedRole,
        language: language,
        createdAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, finalUserData);
    }

    setUserData(finalUserData as any);
    navigate('/dashboard');
  };

  const renderRoleStep = () => (
    <>
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedRole('farmer')}
          className={`group relative p-10 rounded-[2.5rem] border-2 text-left transition-all duration-500 ${
            selectedRole === 'farmer'
              ? 'border-forest-500 bg-white shadow-[0_20px_50px_-12px_rgba(27,67,50,0.2)]'
              : 'border-gray-100 bg-white hover:border-forest-200 shadow-sm'
          }`}
        >
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 shadow-inner ${
            selectedRole === 'farmer' ? 'bg-forest-500 text-white rotate-6' : 'bg-gray-50 text-gray-400 group-hover:bg-forest-50 group-hover:text-forest-400'
          }`}>
            <Tractor className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3 font-devanagari">{t('farmer')}</h2>
          <p className="text-gray-500 font-devanagari text-lg leading-relaxed">{t('farmer_desc')}</p>

          {selectedRole === 'farmer' && (
            <motion.div
              layoutId="active-glow"
              className="absolute inset-0 rounded-[2.5rem] ring-4 ring-forest-500/20 ring-offset-0 pointer-events-none"
            />
          )}
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedRole('buyer')}
          className={`group relative p-10 rounded-[2.5rem] border-2 text-left transition-all duration-500 ${
            selectedRole === 'buyer'
              ? 'border-gold-500 bg-white shadow-[0_20px_50px_-12px_rgba(234,179,8,0.2)]'
              : 'border-gray-100 bg-white hover:border-gold-200 shadow-sm'
          }`}
        >
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 shadow-inner ${
            selectedRole === 'buyer' ? 'bg-gold-500 text-white -rotate-6' : 'bg-gray-50 text-gray-400 group-hover:bg-yellow-50 group-hover:text-gold-400'
          }`}>
            <Store className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3 font-devanagari">{t('buyer')}</h2>
          <p className="text-gray-500 font-devanagari text-lg leading-relaxed">{t('buyer_desc')}</p>

          {selectedRole === 'buyer' && (
            <motion.div
              layoutId="active-glow"
              className="absolute inset-0 rounded-[2.5rem] ring-4 ring-gold-500/20 ring-offset-0 pointer-events-none"
            />
          )}
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedRole('village_agent')}
          className={`group relative p-10 rounded-[2.5rem] border-2 text-left transition-all duration-500 ${
            selectedRole === 'village_agent'
              ? 'border-purple-500 bg-white shadow-[0_20px_50px_-12px_rgba(147,51,234,0.2)]'
              : 'border-gray-100 bg-white hover:border-purple-200 shadow-sm'
          }`}
        >
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 shadow-inner ${
            selectedRole === 'village_agent' ? 'bg-purple-500 text-white -rotate-6' : 'bg-gray-50 text-gray-400 group-hover:bg-purple-50 group-hover:text-purple-400'
          }`}>
            <Users className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3 font-devanagari">
            {language === 'hi' ? 'ग्राम एजेंट' : 'Village Agent'}
          </h2>
          <p className="text-gray-500 font-devanagari text-lg leading-relaxed">
            {language === 'hi' ? 'कई किसानों की प्रोफाइल बनाएं और प्रबंधित करें' : 'Create and manage multiple farmer profiles'}
          </p>

          {selectedRole === 'village_agent' && (
            <motion.div
              layoutId="active-glow"
              className="absolute inset-0 rounded-[2.5rem] ring-4 ring-purple-500/20 ring-offset-0 pointer-events-none"
            />
          )}
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedRole('transporter')}
          className={`group relative p-10 rounded-[2.5rem] border-2 text-left transition-all duration-500 ${
            selectedRole === 'transporter'
              ? 'border-amber-500 bg-white shadow-[0_20px_50px_-12px_rgba(245,158,11,0.2)]'
              : 'border-gray-100 bg-white hover:border-amber-200 shadow-sm'
          }`}
        >
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 shadow-inner ${
            selectedRole === 'transporter' ? 'bg-amber-500 text-white -rotate-6' : 'bg-gray-50 text-gray-400 group-hover:bg-amber-50 group-hover:text-amber-400'
          }`}>
            <Truck className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3 font-devanagari">
            {language === 'hi' ? 'ट्रांसपोर्टर' : 'Transporter'}
          </h2>
          <p className="text-gray-500 font-devanagari text-lg leading-relaxed">
            {language === 'hi' ? 'लोड बोर्ड से लोड खोजें, ट्रक का उपयोग बढ़ाएं और सुरक्षित भुगतान पाएं।' : 'Find loads, maximize truck utilization, and get paid securely.'}
          </p>

          {selectedRole === 'transporter' && (
            <motion.div
              layoutId="active-glow"
              className="absolute inset-0 rounded-[2.5rem] ring-4 ring-amber-500/20 ring-offset-0 pointer-events-none"
            />
          )}
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedRole('warehouse_owner')}
          className={`group relative p-10 rounded-[2.5rem] border-2 text-left transition-all duration-500 ${
            selectedRole === 'warehouse_owner'
              ? 'border-sky-500 bg-white shadow-[0_20px_50px_-12px_rgba(14,165,233,0.2)]'
              : 'border-gray-100 bg-white hover:border-sky-200 shadow-sm'
          }`}
        >
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 shadow-inner ${
            selectedRole === 'warehouse_owner' ? 'bg-sky-500 text-white -rotate-6' : 'bg-gray-50 text-gray-400 group-hover:bg-sky-50 group-hover:text-sky-400'
          }`}>
            <Warehouse className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3 font-devanagari">
            {language === 'hi' ? 'गोदाम मालिक' : 'Storage / Warehouse'}
          </h2>
          <p className="text-gray-500 font-devanagari text-lg leading-relaxed">
            {language === 'hi' ? 'अपनी खाली जगह सूचीबद्ध करें, इन्वेंटरी प्रबंधित करें और किराया कमाएं।' : 'List your empty space, manage inventory, and earn rent.'}
          </p>

          {selectedRole === 'warehouse_owner' && (
            <motion.div
              layoutId="active-glow"
              className="absolute inset-0 rounded-[2.5rem] ring-4 ring-sky-500/20 ring-offset-0 pointer-events-none"
            />
          )}
        </motion.button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-6 w-full max-w-md mx-auto"
      >
        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={!selectedRole || loading}
          className={`group relative w-full px-8 py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-4 transition-all font-devanagari overflow-hidden ${
            selectedRole 
              ? 'bg-white text-gray-900 border-2 border-gray-100 hover:border-forest-500 shadow-lg cursor-pointer hover:scale-[1.02] active:scale-95' 
              : 'bg-gray-50 text-gray-400 cursor-not-allowed border-2 border-transparent'
          }`}
        >
          {loading ? (
            <div className="w-7 h-7 border-3 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-100">
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              </div>
              <span>{t('sign_in_google')}</span>
            </>
          )}
        </button>

        {/* Separator */}
        <div className="flex items-center gap-4 w-full">
          <div className="h-[1px] bg-gray-200 flex-1"></div>
          <span className="text-gray-400 font-bold text-sm uppercase tracking-widest">{language === 'hi' ? 'या' : 'OR'}</span>
          <div className="h-[1px] bg-gray-200 flex-1"></div>
        </div>

        {/* Phone Sign In Button */}
        <button
          onClick={() => setStep('phone')}
          disabled={!selectedRole || loading}
          className={`group relative w-full px-8 py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-4 transition-all font-devanagari overflow-hidden ${
            selectedRole 
              ? 'bg-forest-900 text-white hover:bg-forest-800 shadow-2xl cursor-pointer hover:scale-[1.02] active:scale-95' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <div className="bg-white/10 p-1.5 rounded-lg">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <span>{language === 'hi' ? 'फ़ोन नंबर से लॉगिन' : 'Login with Phone'}</span>
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
      </motion.div>
    </>
  );

  const renderPhoneStep = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100"
    >
      <button 
        onClick={() => setStep('role')}
        className="flex items-center gap-2 text-gray-400 hover:text-forest-600 mb-6 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="font-bold">{t('back_to_roles')}</span>
      </button>

      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-forest-50 text-forest-600 rounded-2xl flex items-center justify-center mb-4">
          <Phone className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('phone_number')}</h2>
        <p className="text-gray-500 text-center">{t('enter_phone')}</p>
      </div>

      <form onSubmit={handleSendOTP} className="space-y-6">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold border-r pr-3">
            +91
          </div>
          <input
            type="tel"
            maxLength={10}
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="00000 00000"
            className="w-full pl-16 pr-4 py-4 rounded-2xl border-2 border-gray-100 focus:border-forest-500 focus:outline-none transition-all text-xl font-bold tracking-widest"
          />
        </div>

        <button
          type="submit"
          disabled={loading || phoneNumber.length < 10}
          className="w-full bg-forest-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-forest-800 transition-all flex items-center justify-center gap-3 disabled:bg-gray-100 disabled:text-gray-400"
        >
          {loading ? (
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              {t('send_otp')}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
      <div id="recaptcha-container" className="mt-4 flex justify-center"></div>
    </motion.div>
  );

  const renderOtpStep = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100"
    >
      <button 
        onClick={() => setStep('phone')}
        className="flex items-center gap-2 text-gray-400 hover:text-forest-600 mb-6 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="font-bold">{t('back')}</span>
      </button>

      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('enter_otp')}</h2>
        <p className="text-gray-500 text-center">Sent to +91 {phoneNumber}</p>
      </div>

      <form onSubmit={handleVerifyOTP} className="space-y-6">
        <input
          type="text"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="0 0 0 0 0 0"
          className="w-full px-4 py-4 rounded-2xl border-2 border-gray-100 focus:border-forest-500 focus:outline-none transition-all text-3xl font-bold tracking-[0.5em] text-center"
        />

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="w-full bg-forest-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-forest-800 transition-all flex items-center justify-center gap-3 disabled:bg-gray-100 disabled:text-gray-400"
        >
          {loading ? (
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              {t('verify_otp')}
              <CheckCircle2 className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Polish */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#1B4332 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-forest-500/5 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold-500/5 rounded-full blur-[100px]"></div>

      {/* Language Toggle */}
      <div className="fixed top-6 right-6 z-50 flex p-1 rounded-2xl border border-gray-200 shadow-xl bg-white/80 backdrop-blur-md">
        <button
          onClick={() => setLanguage('en')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            language === 'en'
              ? 'bg-forest-600 text-white shadow-lg'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          English
        </button>
        <button
          onClick={() => setLanguage('hi')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            language === 'hi'
              ? 'bg-forest-600 text-white shadow-lg'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          हिंदी
        </button>
      </div>

      <div className="max-w-4xl w-full relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-block p-3 bg-forest-50 rounded-2xl mb-6 shadow-inner">
            <CheckCircle2 className="w-8 h-8 text-forest-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-forest-900 mb-4 font-devanagari tracking-tight">{t('select_role')}</h1>
          <p className="text-xl text-gray-500 font-devanagari">{t('select_role_sub')}</p>
        </motion.div>

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-700 shadow-sm max-w-md mx-auto"
          >
            <div className="bg-red-100 p-2 rounded-full">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="font-medium">{errorMsg}</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {step === 'role' && <div key="role">{renderRoleStep()}</div>}
          {step === 'phone' && <div key="phone">{renderPhoneStep()}</div>}
          {step === 'otp' && <div key="otp">{renderOtpStep()}</div>}
        </AnimatePresence>
      </div>
    </div>
  );
}
