import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  db, 
  doc, 
  getDoc, 
  onAuthStateChanged, 
  User, 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as firebaseSignOut,
  googleProvider,
  signInWithPopup
} from '../lib/firebase';

interface TrustScore {
  overall: number;
  verified: boolean;
  transactions: number;
  disputes: number;
  rating: number;
  ratingCount: number;
  verifiedFields: {
    phone?: boolean;
    aadhaar?: boolean;
    bankAccount?: boolean;
    landRecords?: boolean;
  };
}

interface FarmerProfile {
  id: string;
  name: string;
  phone?: string;
  village?: string;
  district?: string;
  area?: number;
  crops?: string[];
  createdAt: string;
  isActive: boolean;
}

interface UserData {
  uid: string;
  name: string;
  email: string;
  role: 'farmer' | 'buyer' | 'seller' | 'village_agent' | 'transporter' | 'warehouse_owner';
  language: 'en' | 'hi';
  createdAt: string;
  phone?: string;
  address?: string;
  village?: string;
  district?: string;
  experience?: number;
  expertise?: string[];
  aadhaarLast4?: string;
  trustScore?: TrustScore;
  kycStatus?: 'pending' | 'verified' | 'rejected';
  fpoMemberOf?: string;
  // Village Agent specific fields
  managedFarmerIds?: string[];
  currentFarmerId?: string;
  // Transporter specific fields
  totalRevenue?: number;  // Transporter's total earnings from completed trips
  completedTrips?: number;
  activeTrips?: number;
  // Warehouse Owner specific fields
  warehouseName?: string;
  warehouseAddress?: string;
  totalCapacity?: number;
  availableCapacity?: number;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  setUserData: (data: UserData | null) => void;
  sendOTP: (phoneNumber: string, recaptchaContainerId: string) => Promise<void>;
  verifyOTP: (otp: string) => Promise<User | null>;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  isVerifying: boolean;
  // Village Agent helpers
  isVillageAgent: boolean;
  setCurrentFarmer: (farmerId: string | null) => void;
  currentFarmerId: string | null;
}

// Store the first interface definition and remove duplicates
interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  setUserData: (data: UserData | null) => void;
  sendOTP: (phoneNumber: string, recaptchaContainerId: string) => Promise<void>;
  verifyOTP: (otp: string) => Promise<User | null>;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  isVerifying: boolean;
  isTransporter: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  setUserData: () => {},
  sendOTP: async () => {},
  verifyOTP: async () => null,
  signInWithGoogle: async () => null,
  signOut: async () => {},
  isVerifying: false,
  isVillageAgent: false,
  isTransporter: false,
  setCurrentFarmer: () => {},
  currentFarmerId: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const [currentFarmerId, setCurrentFarmerId] = useState<string | null>(null);

  const isVillageAgent = userData?.role === 'village_agent';
  const isTransporter = userData?.role === 'transporter';

  const setCurrentFarmer = (farmerId: string | null) => {
    setCurrentFarmerId(farmerId);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
          } else {
            setUserData(null);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const sendOTP = async (phoneNumber: string, recaptchaContainerId: string) => {
    try {
      setIsVerifying(true);
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
      }

      const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
        size: 'invisible'
      });
      
      setRecaptchaVerifier(verifier);
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(confirmation);
    } catch (error) {
      console.error("Error sending OTP:", error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  };

  const verifyOTP = async (otp: string) => {
    if (!confirmationResult) {
      throw new Error("No confirmation result found. Please send OTP first.");
    }
    try {
      setIsVerifying(true);
      const result = await confirmationResult.confirm(otp);
      return result.user;
    } catch (error) {
      console.error("Error verifying OTP:", error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setIsVerifying(true);
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserData(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      loading,
      setUserData,
      sendOTP,
      verifyOTP,
      signInWithGoogle,
      signOut,
      isVerifying,
      isVillageAgent,
      isTransporter,
      setCurrentFarmer,
      currentFarmerId
    }}>
      {children}
    </AuthContext.Provider>
  );
};
