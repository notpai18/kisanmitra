// ============================================================
// KisanMitra Type Schemas
// Industry-level product schemas for TrustScore, GroupListings, AgriInputs, CropDoctor
// ============================================================

// ---------------- Trust Score ----------------
export interface TrustScore {
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

// ---------------- User Profile ----------------
export interface UserProfile extends UserData {
  trustScore: TrustScore;
  kycStatus: 'pending' | 'verified' | 'rejected';
  fpoMemberOf?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserData {
  uid: string;
  name: string;
  email: string;
  role: 'farmer' | 'buyer' | 'seller';
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
}

// ---------------- Group Listings ----------------
export type QualityGrade = 'A' | 'B' | 'C';
export type GroupType = 'fpo' | 'farmer_cooperative' | 'custom_group';
export type GroupListingStatus = 'active' | 'fulfilled' | 'cancelled' | 'expired';
export type CropCategory = 'cereal' | 'pulse' | 'oilseed' | 'vegetable' | 'fruit' | 'cash_crop';
export type ItemStatus = 'pending' | 'confirmed' | 'delivered';

export interface GroupListingItem {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  quantity: number;
  quality: QualityGrade;
  pricePerUnit: number;
  status: ItemStatus;
  addedAt: string;
}

export interface GroupListing {
  id: string;
  groupName: string;
  groupType: GroupType;
  organizerId: string;
  district: string;
  state: string;
  crop: string;
  cropCategory: CropCategory;
  variety?: string;
  quantity: number;
  currentQuantity: number;
  minPrice: number;
  maxPrice: number;
  minQuality: QualityGrade;
  deliveryLocation: string;
  deliveryDate: string;
  maxMembers: number;
  status: GroupListingStatus;
  deadline: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------- Agri Inputs ----------------
export type InputCategory = 'seed' | 'fertilizer' | 'pesticide' | 'equipment' | 'feed' | 'other';
export type ProductUnit = 'kg' | 'litre' | 'packet' | 'piece' | 'quintal';
export type SellerType = 'company' | 'distributor' | 'retailer' | 'fpo';
export type OrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

export interface AgriInputProduct {
  id: string;
  name: string;
  nameHi?: string;
  category: InputCategory;
  subcategory: string;
  brand?: string;
  description: string;
  specifications?: Record<string, string>;
  unit: ProductUnit;
  packSizes: number[];
  mrp: number;
  wholesalePrice?: number;
  bulkPrice?: number;
  sellerId: string;
  sellerName: string;
  sellerType: SellerType;
  verifiedSeller: boolean;
  stock: number;
  minOrderQty: number;
  deliveryDistricts: string[];
  certification?: string[];
  licenseRequired?: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

export interface AgriInputOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: ProductUnit;
  pricePerUnit: number;
  totalPrice: number;
}

export interface AgriInputOrder {
  id: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  items: AgriInputOrderItem[];
  totalAmount: number;
  deliveryAddress: string;
  district: string;
  status: OrderStatus;
  orderDate: string;
  expectedDelivery?: string;
  actualDelivery?: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: 'cod' | 'upi' | 'bank_transfer';
  createdAt: string;
  updatedAt: string;
}

// ---------------- Crop Doctor Treatment ----------------
export type TreatmentType = 'organic' | 'chemical' | 'both';
export type TreatmentStatus = 'pending' | 'in_progress' | 'completed' | 'abandoned';
export type TreatmentEffectiveness = 'effective' | 'partial' | 'ineffective';

export interface CropTreatmentProduct {
  name: string;
  quantity: string;
  cost: number;
  whereToBuy?: string;
}

export interface TreatmentSchedule {
  day1: string[];
  day7: string[];
  day14: string[];
}

export interface CropTreatment {
  id: string;
  reportId: string;
  type: TreatmentType;
  schedule: TreatmentSchedule;
  estimatedCost: number;
  currency: 'INR';
  products: CropTreatmentProduct[];
  status: TreatmentStatus;
  startedAt?: string;
  completedAt?: string;
  effectiveness?: TreatmentEffectiveness;
  notes?: string;
}

// ---------------- Digital Warehouse Receipt (DWR) ----------------
export type PledgeStatus = 'unpledged' | 'pledged_to_bank' | 'pledged_to_contract';

export interface DigitalReceipt {
  id: string;
  farmerId: string;
  farmerName: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  crop: string;
  quantity: number;
  unit: string;
  storageDuration: number;
  totalCost: number;
  pricePerTonPerMonth: number;
  marketValueAtDeposit?: number;
  status: 'deposited' | 'withdrawn';
  pledgeStatus: PledgeStatus;
  createdAt: any;
  depositedAt?: any;
}

// ---------------- Price Trigger (Auto-Sell) ----------------
export interface PriceTrigger {
  id: string;
  receiptId: string;
  farmerId: string;
  crop: string;
  warehouseId: string;
  warehouseName: string;
  targetPrice: number;       // ₹ per quintal
  currentMarketPrice: number;
  quantity: number;         // tons to auto-sell
  status: 'active' | 'triggered' | 'cancelled';
  createdAt: any;
  triggeredAt?: any;
}

// ---------------- Notifications ----------------
export type NotificationType = 'success' | 'info' | 'warning' | 'alert';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link?: string;
  createdAt: any;
}

// ---------------- Re-exports from geminiClient ----------------
export type { CropDiagnosis, CropHealthScore, GrowthStage, PestDetection, NutrientDeficiency } from '../lib/geminiClient';