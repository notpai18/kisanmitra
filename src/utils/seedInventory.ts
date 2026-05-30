import { db, isMockConfig } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, setDoc } from '../lib/firebase';

export interface InventoryItem {
  id: string;
  name: string;
  type: 'fertilizer' | 'chemical' | 'organic';
  price: number;
  unit: string;
  description: string;
  tags: string[];
  category: 'fertilizer' | 'pesticide' | 'seed' | 'organic' | 'tool';
  inStock: boolean;
  brand?: string;
  imageUrl?: string;
  applicableCrops?: string[];
  createdAt: any;
  updatedAt: any;
}

const SEED_DATA: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Neem Oil 10,000 PPM',
    type: 'organic',
    price: 280,
    unit: 'liter',
    description: 'Cold-pressed neem oil for organic pest control. Effective against aphids, whiteflies, and spider mites.',
    tags: ['neem', 'organic', 'insecticide', 'aphids', 'pest-control'],
    category: 'organic',
    inStock: true,
    brand: 'Organic India',
    applicableCrops: ['Tomato', 'Potato', 'Cotton', 'Rice'],
  },
  {
    name: 'Urea Fertilizer 46% N',
    type: 'fertilizer',
    price: 300,
    unit: 'bag',
    description: 'Granular urea with 46% nitrogen content. Essential for vegetative growth and leaf development.',
    tags: ['nitrogen', 'fertilizer', 'urea', 'growth'],
    category: 'fertilizer',
    inStock: true,
    brand: 'IFFCO',
    applicableCrops: ['Wheat', 'Rice', 'Cotton', 'Maize'],
  },
  {
    name: 'Mancozeb 75% WP',
    type: 'chemical',
    price: 420,
    unit: 'kg',
    description: 'Broad-spectrum fungicide for control of late blight, early blight, and downy mildew.',
    tags: ['fungicide', 'blight', 'mancozeb', 'chemical', 'pest-control'],
    category: 'pesticide',
    inStock: true,
    brand: 'Bayer',
    applicableCrops: ['Potato', 'Tomato', 'Grapes', 'Rice'],
  },
  {
    name: 'NPK 19:19:19',
    type: 'fertilizer',
    price: 1100,
    unit: 'bag',
    description: 'Balanced water-soluble NPK fertilizer for all-round plant nutrition. Ideal for flowering stage.',
    tags: ['npk', 'balanced', 'fertilizer', 'growth', 'flowering'],
    category: 'fertilizer',
    inStock: true,
    brand: 'Coromandel',
    applicableCrops: ['Wheat', 'Rice', 'Sugarcane', 'Cotton'],
  },
  {
    name: 'Imidacloprid 17.8% SL',
    type: 'chemical',
    price: 450,
    unit: 'liter',
    description: 'Systemic insecticide for control of sucking pests like aphids, jassids, and whiteflies.',
    tags: ['insecticide', 'imidacloprid', 'chemical', 'sucking-pest', 'aphids', 'pest-control'],
    category: 'pesticide',
    inStock: true,
    brand: 'Bayer',
    applicableCrops: ['Rice', 'Cotton', 'Sugarcane', 'Tomato'],
  },
  {
    name: 'DAP 18-46-0',
    type: 'fertilizer',
    price: 1350,
    unit: 'bag',
    description: 'Di-ammonium phosphate with high phosphorus for strong root development and early growth.',
    tags: ['phosphorus', 'fertilizer', 'dap', 'root', 'growth'],
    category: 'fertilizer',
    inStock: true,
    brand: 'IFFCO',
    applicableCrops: ['Wheat', 'Mustard', 'Cotton', 'Sugarcane'],
  },
  {
    name: 'Carbendazim 50% WP',
    type: 'chemical',
    price: 320,
    unit: 'kg',
    description: 'Systemic fungicide for control of anthracnose, blights, and rotting in fruits and vegetables.',
    tags: ['fungicide', 'carbendazim', 'chemical', 'blight', 'pest-control'],
    category: 'pesticide',
    inStock: true,
    brand: 'Bayer',
    applicableCrops: ['Wheat', 'Tomato', 'Potato', 'Grapes'],
  },
  {
    name: 'Neem Cake',
    type: 'organic',
    price: 180,
    unit: 'kg',
    description: 'Organic neem seed cake for soil enrichment and natural pest suppression. Rich in NPK.',
    tags: ['neem', 'organic', 'soil-enrichment', 'pest-control'],
    category: 'organic',
    inStock: true,
    brand: 'Organic India',
    applicableCrops: ['All'],
  },
  {
    name: 'NPK 10-26-26',
    type: 'fertilizer',
    price: 950,
    unit: 'bag',
    description: 'High potassium NPK formula ideal for flowering, fruiting, and grain filling stages.',
    tags: ['npk', 'potassium', 'fertilizer', 'flowering', 'fruiting', 'growth'],
    category: 'fertilizer',
    inStock: true,
    brand: 'Coromandel',
    applicableCrops: ['Mustard', 'Sugarcane', 'Cotton', 'Wheat'],
  },
  {
    name: 'Chlorpyrifos 20% EC',
    type: 'chemical',
    price: 380,
    unit: 'liter',
    description: 'Broad-spectrum organophosphate insecticide for soil insects, borers, and chewing pests.',
    tags: ['insecticide', 'chlorpyrifos', 'broad-spectrum', 'chemical', 'pest-control', 'borer'],
    category: 'pesticide',
    inStock: true,
    brand: 'FMC',
    applicableCrops: ['Rice', 'Wheat', 'Cotton', 'Sugarcane'],
  },
];

export async function isInventorySeeded(): Promise<boolean> {
  if (isMockConfig) return true;
  return localStorage.getItem('km_inventory_seeded') === 'true';
}

export function markInventorySeeded() {
  localStorage.setItem('km_inventory_seeded', 'true');
}

export async function checkInventoryEmpty(): Promise<boolean> {
  if (isMockConfig) return false;
  try {
    const snapshot = await getDocs(collection(db, 'inventory'));
    return snapshot.empty;
  } catch {
    return true;
  }
}

export async function seedInventory(): Promise<{ count: number }> {
  if (isMockConfig) {
    markInventorySeeded();
    return { count: SEED_DATA.length };
  }

  const timestamp = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };

  for (const item of SEED_DATA) {
    const docRef = doc(db, 'inventory', item.name.replace(/\s+/g, '-').toLowerCase());
    await setDoc(docRef, {
      ...item,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  markInventorySeeded();
  return { count: SEED_DATA.length };
}