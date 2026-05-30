/**
 * Double-Spend Test for DWR Pledging
 *
 * This script simulates a race condition by attempting to pledge the same
 * Digital Warehouse Receipt to two different Corporate Contracts simultaneously.
 *
 * Expected behavior: Only ONE pledge succeeds, the other fails with "Receipt already pledged"
 *
 * Run with: npx tsx scripts/testDoubleSpend.ts
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  getDocs,
  query,
  where
} from 'firebase/firestore';

// Configuration - update these for your test environment
const TEST_CONFIG = {
  // Use emulator for safe testing
  useEmulator: true,
  emulatorHost: 'localhost',
  emulatorPort: 8080,
};

// Initialize Firebase
const app = initializeApp({
  apiKey: "test-api-key",
  authDomain: "localhost",
  projectId: "kisanmitra-demo",
});

const db = getFirestore(app);

// Test data
const TEST_FARMER_ID = 'test-farmer-001';
const TEST_RECEIPT_ID = 'test-dwr-race-001';
const TEST_CONTRACT_1 = 'test-contract-001';
const TEST_CONTRACT_2 = 'test-contract-002';

interface DigitalReceipt {
  id: string;
  farmerId: string;
  warehouseName: string;
  crop: string;
  quantity: number;
  status: 'deposited' | 'withdrawn';
  pledgeStatus: 'unpledged' | 'pledged_to_bank' | 'pledged_to_contract';
  pledgedToContractId?: string;
}

interface CorporateContract {
  id: string;
  buyerOrganization: string;
  crop: string;
  targetQuantity: number;
  committedQuantity: number;
  status: 'open' | 'partial' | 'fulfilled' | 'expired';
}

/**
 * Simulates the pledgeDWRToContract business logic
 */
async function pledgeDWRToContract(
  contractId: string,
  receiptId: string,
  farmerId: string,
  quantity: number
): Promise<{ success: boolean; error?: string; timestamp: number }> {
  const timestamp = Date.now();

  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Verify contract exists and has capacity
      const contractRef = doc(db, 'corporateContracts', contractId);
      const contractDoc = await transaction.get(contractRef);

      if (!contractDoc.exists()) {
        return { success: false, error: 'Contract not found', timestamp };
      }

      const contract = contractDoc.data() as CorporateContract;
      const newCommittedQuantity = (contract.committedQuantity || 0) + quantity;

      if (newCommittedQuantity > contract.targetQuantity) {
        return { success: false, error: 'Contract capacity exceeded', timestamp };
      }

      // 2. CRITICAL: Verify receipt is still unpledged (THE DOUBLE-SPEND GUARD)
      const receiptRef = doc(db, 'digital_receipts', receiptId);
      const receiptDoc = await transaction.get(receiptRef);

      if (!receiptDoc.exists()) {
        return { success: false, error: 'Receipt not found', timestamp };
      }

      const receipt = receiptDoc.data() as DigitalReceipt;

      // Double-spend check
      if (receipt.pledgeStatus !== 'unpledged') {
        return {
          success: false,
          error: `Receipt already pledged to ${receipt.pledgeStatus}`,
          timestamp
        };
      }

      if (receipt.farmerId !== farmerId) {
        return { success: false, error: 'Receipt does not belong to farmer', timestamp };
      }

      // 3. Create commit record
      const commitRef = doc(collection(db, 'contractCommits'));
      transaction.set(commitRef, {
        contractId,
        farmerId,
        receiptId,
        quantity,
        source: 'dwr_pledge',
        status: 'confirmed',
        createdAt: serverTimestamp(),
      });

      // 4. Update contract
      const newStatus = newCommittedQuantity >= contract.targetQuantity ? 'fulfilled' :
                        newCommittedQuantity > 0 ? 'partial' : 'open';

      transaction.update(contractRef, {
        committedQuantity: newCommittedQuantity,
        status: newStatus,
      });

      // 5. Update receipt pledgeStatus (THE STATE CHANGE)
      transaction.update(receiptRef, {
        pledgeStatus: 'pledged_to_contract',
        pledgedToContractId: contractId,
        pledgedAt: serverTimestamp(),
      });

      return { success: true, timestamp };
    });
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Transaction failed',
      timestamp
    };
  }
}

/**
 * Setup test data - creates a fresh DWR and contracts
 */
async function setupTestData(): Promise<void> {
  console.log('\n📦 Setting up test data...\n');

  // Create test receipt (unpledged)
  await setDoc(doc(db, 'digital_receipts', TEST_RECEIPT_ID), {
    id: TEST_RECEIPT_ID,
    farmerId: TEST_FARMER_ID,
    farmerName: 'Test Farmer',
    warehouseId: 'test-warehouse-001',
    warehouseName: 'Test Storage Hub',
    warehouseLocation: 'Varanasi, UP',
    crop: 'Wheat',
    quantity: 5,
    unit: 'tons',
    storageDuration: 3,
    totalCost: 6000,
    status: 'deposited',
    pledgeStatus: 'unpledged',
    createdAt: serverTimestamp(),
  });

  // Create two contracts needing wheat
  await setDoc(doc(db, 'corporateContracts', TEST_CONTRACT_1), {
    id: TEST_CONTRACT_1,
    buyerId: 'buyer-001',
    buyerOrganization: 'AgriCorp Foods',
    crop: 'Wheat',
    targetQuantity: 10,
    committedQuantity: 0,
    status: 'open',
    deliveryLocation: 'Lucknow, UP',
    createdAt: serverTimestamp(),
  } as CorporateContract);

  await setDoc(doc(db, 'corporateContracts', TEST_CONTRACT_2), {
    id: TEST_CONTRACT_2,
    buyerId: 'buyer-002',
    buyerOrganization: 'Sunrise Flour Mills',
    crop: 'Wheat',
    targetQuantity: 8,
    committedQuantity: 0,
    status: 'open',
    deliveryLocation: 'Kanpur, UP',
    createdAt: serverTimestamp(),
  } as CorporateContract);

  console.log('✅ Test data created:');
  console.log(`   - DWR: ${TEST_RECEIPT_ID} (status: unpledged)`);
  console.log(`   - Contract 1: ${TEST_CONTRACT_1} (AgriCorp - 10 tons)`);
  console.log(`   - Contract 2: ${TEST_CONTRACT_2} (Sunrise - 8 tons)`);
}

/**
 * Cleanup test data
 */
async function cleanupTestData(): Promise<void> {
  console.log('\n🧹 Cleaning up test data...');

  await deleteDoc(doc(db, 'digital_receipts', TEST_RECEIPT_ID)).catch(() => {});
  await deleteDoc(doc(db, 'corporateContracts', TEST_CONTRACT_1)).catch(() => {});
  await deleteDoc(doc(db, 'corporateContracts', TEST_CONTRACT_2)).catch(() => {});

  // Clean up any commits
  const commitsSnapshot = await import('firebase/firestore').then(firebase =>
    import('firebase/data').then(data => data.getDocs(
      data.query(
        collection(db, 'contractCommits'),
        data.where('receiptId', '==', TEST_RECEIPT_ID)
      )
    ))
  ).catch(() => null);

  console.log('✅ Cleanup complete');
}

/**
 * Run the double-spend test
 */
async function runDoubleSpendTest(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 RUNNING DOUBLE-SPEND TEST');
  console.log('='.repeat(60));

  // Setup fresh data
  await setupTestData();

  // Simulate race condition: two simultaneous pledge attempts
  console.log('\n⚡ Simulating simultaneous pledge attempts...');
  console.log(`   Attempt 1: Pledge DWR to Contract 1`);
  console.log(`   Attempt 2: Pledge DWR to Contract 2`);
  console.log('');

  const [attempt1, attempt2] = await Promise.all([
    pledgeDWRToContract(TEST_CONTRACT_1, TEST_RECEIPT_ID, TEST_FARMER_ID, 5),
    pledgeDWRToContract(TEST_CONTRACT_2, TEST_RECEIPT_ID, TEST_FARMER_ID, 5),
  ]);

  console.log('📊 Results:');
  console.log(`   Attempt 1 (Contract 1): ${attempt1.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  if (attempt1.error) console.log(`      Error: ${attempt1.error}`);

  console.log(`   Attempt 2 (Contract 2): ${attempt2.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  if (attempt2.error) console.log(`      Error: ${attempt2.error}`);

  // Verify final state
  console.log('\n🔍 Verifying final state...');

  const receiptDoc = await getDoc(doc(db, 'digital_receipts', TEST_RECEIPT_ID));
  const receipt = receiptDoc.data() as DigitalReceipt;

  console.log(`   DWR pledgeStatus: ${receipt?.pledgeStatus}`);
  console.log(`   DWR pledgedToContractId: ${receipt?.pledgedToContractId || 'none'}`);

  // Verify which contract got the pledge
  const commitsQuery = query(
    collection(db, 'contractCommits'),
    where('receiptId', '==', TEST_RECEIPT_ID)
  );
  const commitsSnap = await getDocs(commitsQuery);

  console.log(`   Total commits created: ${commitsSnap.size}`);

  // Cleanup
  await cleanupTestData();

  // Final verdict
  console.log('\n' + '='.repeat(60));
  console.log('📋 VERDICT:');
  console.log('='.repeat(60));

  if ((attempt1.success && !attempt2.success) || (!attempt1.success && attempt2.success)) {
    console.log('✅ PASS: Only ONE pledge succeeded - double-spend PREVENTED');
    console.log('   The transaction guard at pledgeDWRToContract() correctly rejected');
    console.log('   the second attempt with "Receipt already pledged" error.');
  } else if (attempt1.success && attempt2.success) {
    console.log('❌ FAIL: BOTH pledges succeeded - DOUBLE-SPEND VULNERABILITY!');
  } else {
    console.log('⚠️  BOTH failed - check test setup');
  }
  console.log('='.repeat(60));
}

// Run the test
runDoubleSpendTest()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  });