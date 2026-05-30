import { db, collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, getDocs, runTransaction } from './firebase';
import type { GroupListing, GroupListingItem, DigitalReceipt } from '../types';

export class GroupListingService {

  /**
   * Get unpledged digital receipts for a farmer matching a specific crop
   */
  async getUnpledgedReceiptsForCrop(farmerId: string, crop: string): Promise<DigitalReceipt[]> {
    try {
      const q = query(
        collection(db, 'digital_receipts'),
        where('farmerId', '==', farmerId),
        where('status', '==', 'deposited')
      );
      const snap = await getDocs(q);

      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as DigitalReceipt))
        .filter(r => r.pledgeStatus === 'unpledged' && r.crop.toLowerCase() === crop.toLowerCase());
    } catch (err) {
      console.error('Error fetching receipts:', err);
      return [];
    }
  }

  /**
   * Pledge a DWR to a corporate contract (secure transaction)
   */
  async pledgeDWRToContract(
    farmerId: string,
    contractId: string,
    receiptId: string,
    quantity: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await runTransaction(db, async (transaction) => {
        // 1. Verify contract still has capacity
        const contractDoc = await transaction.get(doc(db, 'corporateContracts', contractId));
        if (!contractDoc.exists()) {
          return { success: false, error: 'Contract not found' };
        }

        const contract = contractDoc.data();
        const newCommittedQuantity = (contract.committedQuantity || 0) + quantity;

        if (newCommittedQuantity > contract.targetQuantity) {
          return { success: false, error: 'Contract capacity exceeded' };
        }

        // 2. Verify receipt exists and is still unpledged
        const receiptDoc = await transaction.get(doc(db, 'digital_receipts', receiptId));
        if (!receiptDoc.exists()) {
          return { success: false, error: 'Receipt not found' };
        }

        const receipt = receiptDoc.data();
        if (receipt.pledgeStatus !== 'unpledged') {
          return { success: false, error: 'Receipt already pledged' };
        }

        if (receipt.farmerId !== farmerId) {
          return { success: false, error: 'Receipt does not belong to farmer' };
        }

        // 3. Create contract commit record
        const commitRef = doc(collection(db, 'contractCommits'));
        transaction.set(commitRef, {
          contractId,
          farmerId,
          receiptId,
          quantity,
          source: 'dwr_pledge',
          status: 'confirmed',
          createdAt: new Date(),
        });

        // 4. Update contract committed quantity
        const newStatus = newCommittedQuantity >= contract.targetQuantity ? 'fulfilled' :
                          newCommittedQuantity > 0 ? 'partial' : 'open';

        transaction.update(doc(db, 'corporateContracts', contractId), {
          committedQuantity: newCommittedQuantity,
          status: newStatus,
        });

        // 5. Update receipt pledge status
        transaction.update(doc(db, 'digital_receipts', receiptId), {
          pledgeStatus: 'pledged_to_contract',
          pledgedToContractId: contractId,
          pledgedAt: new Date(),
        });

        return { success: true };
      });
    } catch (err: any) {
      console.error('Error pledging DWR:', err);
      return { success: false, error: err.message || 'Transaction failed' };
    }
  }

  /**
   * Get corporate contracts that a farmer can pledge to
   */
  async getActiveContractsForFarmer(): Promise<any[]> {
    try {
      const q = query(
        collection(db, 'corporateContracts'),
        where('status', 'in', ['open', 'partial']),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching contracts:', err);
      return [];
    }
  }

  /**
   * Get contract commits for a buyer (to view pledged receipts)
   */
  async getContractCommitsByBuyer(buyerId: string): Promise<any[]> {
    try {
      const contractsQ = query(
        collection(db, 'corporateContracts'),
        where('buyerId', '==', buyerId)
      );
      const contractsSnap = await getDocs(contractsQ);
      const contractIds = contractsSnap.docs.map(d => d.id);

      if (contractIds.length === 0) return [];

      const commitsQ = query(
        collection(db, 'contractCommits'),
        where('contractId', 'in', contractIds)
      );
      const commitsSnap = await getDocs(commitsQ);

      const commits = await Promise.all(
        commitsSnap.docs.map(async (commitDoc) => {
          const commit = commitDoc.data();
          let receipt = null;

          if (commit.receiptId) {
            const receiptDoc = await getDoc(doc(db, 'digital_receipts', commit.receiptId));
            if (receiptDoc.exists()) {
              receipt = { id: receiptDoc.id, ...receiptDoc.data() };
            }
          }

          return { id: commitDoc.id, ...commit, receipt };
        })
      );

      return commits;
    } catch (err) {
      console.error('Error fetching buyer commits:', err);
      return [];
    }
  }
  /**
   * Get all active listings - simplified query
   */
  async getActiveListings(): Promise<GroupListing[]> {
    console.log('=== getActiveListings called ===');
    console.log('DB:', db);

    try {
      // Simple query - just get all documents from groupListings
      const q = query(collection(db, 'groupListings'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);

      console.log('Query executed, got:', snap.docs.length, 'docs');

      return snap.docs.map(d => {
        console.log('Mapping doc:', d.id, d.data());
        return { id: d.id, ...d.data() } as GroupListing;
      });
    } catch (err) {
      console.error('Error in getActiveListings:', err);
      return [];
    }
  }

  /**
   * Subscribe to all listings
   */
  subscribeToAllListings(callback: (listings: GroupListing[]) => void): () => void {
    console.log('=== subscribeToAllListings: Setting up listener ===');

    const q = query(collection(db, 'groupListings'), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snap) => {
      console.log('=== Snapshot received, docs:', snap.docs.length, '===');
      snap.docs.forEach(d => console.log('  -', d.id));

      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupListing));
      callback(data);
    }, (error) => {
      console.error('=== Snapshot error ===', error);
    });
  }

  /**
   * Create new listing
   */
  async createListing(data: {
    groupName: string;
    groupType: GroupListing['groupType'];
    organizerId: string;
    organizerName: string;
    district: string;
    state: string;
    crop: string;
    cropCategory: GroupListing['cropCategory'];
    variety?: string;
    quantity: number;
    minPrice: number;
    maxPrice: number;
    minQuality: GroupListing['minQuality'];
    deliveryLocation: string;
    deliveryDate: string;
    maxMembers: number;
    deadline: string;
  }): Promise<string> {
    console.log('=== createListing called ===');
    console.log('Data:', data);

    const now = new Date().toISOString();
    const ref = await addDoc(collection(db, 'groupListings'), {
      ...data,
      currentQuantity: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    console.log('Created listing with ID:', ref.id);
    return ref.id;
  }

  /**
   * Join a listing
   */
  async joinListing(
    listingId: string,
    data: {
      userId: string;
      userName: string;
      quantity: number;
      quality: GroupListingItem['quality'];
      pricePerUnit: number;
    }
  ): Promise<string> {
    const itemRef = await addDoc(collection(db, `groupListings/${listingId}/items`), {
      ...data,
      listingId,
      status: 'pending' as const,
      addedAt: new Date().toISOString(),
    });

    // Update listing quantity
    const listingSnap = await getDoc(doc(db, 'groupListings', listingId));
    if (listingSnap.exists()) {
      const current = listingSnap.data()?.currentQuantity || 0;
      const newQuantity = current + data.quantity;
      const targetQuantity = listingSnap.data()?.quantity || 0;
      const newStatus = newQuantity >= targetQuantity ? 'fulfilled' : 'active';

      await updateDoc(doc(db, 'groupListings', listingId), {
        currentQuantity: newQuantity,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    }

    return itemRef.id;
  }

  /**
   * Get listing by ID
   */
  async getListing(listingId: string): Promise<GroupListing | null> {
    const snap = await getDoc(doc(db, 'groupListings', listingId));
    return snap.exists() ? { id: snap.id, ...snap.data() } as GroupListing : null;
  }

  /**
   * Subscribe to listing items
   */
  subscribeToListingItems(listingId: string, callback: (items: GroupListingItem[]) => void): () => void {
    return onSnapshot(
      collection(db, `groupListings/${listingId}/items`),
      (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupListingItem[])).sort(
          (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        ));
      }
    );
  }

  /**
   * Get all listings (no filter)
   */
  async getAllListings(): Promise<GroupListing[]> {
    const q = query(collection(db, 'groupListings'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupListing));
  }
}

export const groupListingService = new GroupListingService();