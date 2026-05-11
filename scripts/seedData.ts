import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp, getDocs, query, limit } from 'firebase/firestore';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEMO_LISTINGS = [
  { crop: 'Wheat', district: 'Varanasi', state: 'Uttar Pradesh', quantity: 20, unit: 'quintal', price: 2150 },
  { crop: 'Rice', district: 'Gorakhpur', state: 'Uttar Pradesh', quantity: 18, unit: 'quintal', price: 1980 },
  { crop: 'Potato', district: 'Lucknow', state: 'Uttar Pradesh', quantity: 25, unit: 'quintal', price: 900 },
  { crop: 'Tomato', district: 'Kanpur', state: 'Uttar Pradesh', quantity: 12, unit: 'quintal', price: 1300 },
  { crop: 'Sugarcane', district: 'Allahabad', state: 'Uttar Pradesh', quantity: 40, unit: 'quintal', price: 360 },
  { crop: 'Maize', district: 'Meerut', state: 'Uttar Pradesh', quantity: 16, unit: 'quintal', price: 1760 },
  { crop: 'Mustard', district: 'Agra', state: 'Uttar Pradesh', quantity: 10, unit: 'quintal', price: 5400 },
  { crop: 'Wheat', district: 'Bareilly', state: 'Uttar Pradesh', quantity: 14, unit: 'quintal', price: 2130 },
];

const configPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

async function seed() {
  console.log("Starting Firestore seeding for project:", firebaseConfig.projectId);
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    const listingsRef = collection(db, 'listings');
    const existingSnap = await getDocs(query(listingsRef, limit(1)));
    
    if (!existingSnap.empty) {
      console.log("Listing collection is not empty. Skipping listings seed to avoid duplicates.");
    } else {
      console.log(`Seeding ${DEMO_LISTINGS.length} demo listings...`);
      for (const item of DEMO_LISTINGS) {
        await addDoc(listingsRef, {
          ...item,
          farmerId: 'seed-farmer-id',
          farmerName: 'Seed Demo Farmer',
          grade: 'A',
          harvestDate: new Date().toISOString().split('T')[0],
          description: `High quality ${item.crop} harvested recently from ${item.district}.`,
          isBidding: true,
          status: 'active',
          highestBid: 0,
          bidCount: 0,
          createdAt: Timestamp.now(),
        });
      }
      console.log("Successfully seeded listings!");
    }
  } catch (e) {
    console.error("Error seeding data:", e);
  }
  
  console.log("Done! Feel free to kill this script with Ctrl+C if it hangs (Firebase connection stays open).");
  process.exit(0);
}

seed();
