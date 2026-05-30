import { db, isMockConfig } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { PriceTrigger } from '../types';

// Helper to send notification (imported dynamically to avoid circular deps)
async function sendTriggerNotification(
  farmerId: string,
  crop: string,
  quantity: number,
  targetPrice: number
) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: farmerId,
      title: 'Auto-Sell Executed!',
      message: `${quantity} tons of ${crop} listed at ₹${targetPrice}/qtl`,
      type: 'success',
      read: false,
      link: '/market',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error sending trigger notification:', error);
  }
}

interface MandiPrice {
  name: string;
  price: number;
  unit: string;
}

interface CropPriceMap {
  [crop: string]: number;
}

// Default fallback prices (₹ per quintal)
const DEFAULT_PRICES: CropPriceMap = {
  wheat: 2275,
  rice: 2183,
  potato: 1200,
  tomato: 1800,
  onion: 1350,
  sugarcane: 350,
  maize: 1962,
  cotton: 6620,
  soybean: 4600,
  mustard: 5050,
  groundnut: 6000,
  turmeric: 12500,
  gram: 5400,
  moong: 7400,
};

// Mock Mandi prices for demo mode
const MOCK_MANDI_PRICES: CropPriceMap = {
  wheat: 2350,
  rice: 2250,
  potato: 1400,
  tomato: 2000,
  onion: 1450,
  maize: 2100,
  mustard: 5200,
  gram: 5600,
};

// Get current market prices (from API or mock)
export async function getCurrentMandiPrices(): Promise<CropPriceMap> {
  if (isMockConfig) {
    return MOCK_MANDI_PRICES;
  }

  try {
    const response = await fetch('/api/mandi-prices');
    const data = await response.json();

    if (data.success && data.data) {
      const priceMap: CropPriceMap = {};
      data.data.forEach((item: MandiPrice) => {
        const cropName = item.name.toLowerCase();
        priceMap[cropName] = item.price;
      });
      return priceMap;
    }
  } catch (error) {
    console.error('Error fetching mandi prices:', error);
  }

  return DEFAULT_PRICES;
}

// Get price for a specific crop
export function getCropPrice(crop: string, prices: CropPriceMap): number {
  const normalizedCrop = crop.toLowerCase();
  return prices[normalizedCrop] || DEFAULT_PRICES[normalizedCrop] || 2000;
}

// Fetch all active triggers for a specific farmer
export async function fetchUserActiveTriggers(farmerId: string): Promise<PriceTrigger[]> {
  if (isMockConfig) {
    return [];
  }

  try {
    const triggersQuery = query(
      collection(db, 'price_triggers'),
      where('farmerId', '==', farmerId),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(triggersQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as PriceTrigger[];
  } catch (error) {
    console.error('Error fetching user active triggers:', error);
    return [];
  }
}

// Fetch active triggers from Firestore (global)
export async function fetchActiveTriggers(): Promise<PriceTrigger[]> {
  if (isMockConfig) {
    return [];
  }

  try {
    const triggersQuery = query(
      collection(db, 'price_triggers'),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(triggersQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as PriceTrigger[];
  } catch (error) {
    console.error('Error fetching active triggers:', error);
    return [];
  }
}

// Fetch trigger for a specific receipt
export async function fetchTriggerForReceipt(receiptId: string): Promise<PriceTrigger | null> {
  if (isMockConfig) {
    return null;
  }

  try {
    const triggerQuery = query(
      collection(db, 'price_triggers'),
      where('receiptId', '==', receiptId),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(triggerQuery);
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      return { id: snapshot.docs[0].id, ...data } as PriceTrigger;
    }
  } catch (error) {
    console.error('Error fetching trigger for receipt:', error);
  }
  return null;
}

// Create a new price trigger
export async function createPriceTrigger(triggerData: Omit<PriceTrigger, 'id' | 'status' | 'createdAt'>): Promise<string> {
  if (isMockConfig) {
    console.log('Mock: Creating price trigger', triggerData);
    return 'mock-trigger-' + Date.now();
  }

  try {
    const docRef = await addDoc(collection(db, 'price_triggers'), {
      ...triggerData,
      status: 'active',
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating price trigger:', error);
    throw error;
  }
}

// Cancel a price trigger
export async function cancelPriceTrigger(triggerId: string): Promise<void> {
  if (isMockConfig) {
    console.log('Mock: Cancelling price trigger', triggerId);
    return;
  }

  try {
    await updateDoc(doc(db, 'price_triggers', triggerId), {
      status: 'cancelled',
    });
  } catch (error) {
    console.error('Error cancelling price trigger:', error);
    throw error;
  }
}

// Main execution engine - check and execute triggers
export async function checkAndExecuteTriggers(
  customPrices?: CropPriceMap
): Promise<{
  executed: number;
  results: Array<{ triggerId: string; crop: string; quantity: number; price: number }>;
}> {
  const prices = customPrices || await getCurrentMandiPrices();
  const activeTriggers = await fetchActiveTriggers();

  const results: Array<{ triggerId: string; crop: string; quantity: number; price: number }> = [];
  let executed = 0;

  if (isMockConfig || activeTriggers.length === 0) {
    console.log('No active triggers to execute');
    return { executed, results };
  }

  console.log('Checking', activeTriggers.length, 'active triggers against prices:', prices);

  for (const trigger of activeTriggers) {
    const currentPrice = prices[trigger.crop.toLowerCase()] || trigger.currentMarketPrice;
    console.log(`Trigger ${trigger.id}: ${trigger.crop} - Current: ₹${currentPrice}/q, Target: ₹${trigger.targetPrice}/q`);

    if (currentPrice >= trigger.targetPrice) {
      console.log(`✅ TRIGGER EXECUTED for ${trigger.crop}!`);

      try {
        // Use batch write for atomicity
        const batch = writeBatch(db);

        // 1. Update trigger status to 'triggered'
        batch.update(doc(db, 'price_triggers', trigger.id), {
          status: 'triggered',
          triggeredAt: serverTimestamp(),
          executedPrice: currentPrice,
        });

        // 2. Create a marketplace listing
        const listingData = {
          farmerId: trigger.farmerId,
          crop: trigger.crop,
          quantity: trigger.quantity * 10, // Convert tons to quintals (1 ton = 10 quintals)
          unit: 'quintals',
          pricePerQuintal: trigger.targetPrice,
          totalPrice: trigger.targetPrice * trigger.quantity * 10,
          status: 'active',
          source: 'auto_trigger',
          triggerId: trigger.id,
          warehouseId: trigger.warehouseId,
          warehouseName: trigger.warehouseName,
          createdAt: serverTimestamp(),
        };

        const listingRef = doc(collection(db, 'listings'));
        batch.set(listingRef, listingData);

        // 3. Update the digital receipt (subtract quantity)
        const receiptRef = doc(db, 'digital_receipts', trigger.receiptId);
        const receiptSnap = await getDocs(query(collection(db, 'digital_receipts'), where('__name__', '==', trigger.receiptId)));

        if (!receiptSnap.empty) {
          const receiptData = receiptSnap.docs[0].data();
          const newQuantity = (receiptData.quantity || 0) - trigger.quantity;

          if (newQuantity <= 0) {
            batch.update(receiptRef, {
              status: 'withdrawn',
              quantity: 0
            });
          } else {
            batch.update(receiptRef, {
              quantity: newQuantity
            });
          }
        }

        await batch.commit();

        // Send notification to farmer
        await sendTriggerNotification(
          trigger.farmerId,
          trigger.crop,
          trigger.quantity,
          trigger.targetPrice
        );

        results.push({
          triggerId: trigger.id,
          crop: trigger.crop,
          quantity: trigger.quantity,
          price: currentPrice,
        });
        executed++;

      } catch (error) {
        console.error(`Error executing trigger ${trigger.id}:`, error);
      }
    }
  }

  console.log(`Trigger engine completed: ${executed} triggers executed`);
  return { executed, results };
}

// Set custom price for testing (used in Admin Simulator)
export function createPriceOverride(basePrices: CropPriceMap, crop: string, newPrice: number): CropPriceMap {
  return {
    ...basePrices,
    [crop.toLowerCase()]: newPrice,
  };
}