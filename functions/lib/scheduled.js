"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerManualAlert = exports.processWeeklyDigest = exports.processDailyTasks = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Scheduled Function: processDailyTasks
 * Runs daily at 6:00 AM IST (approximately 12:30 UTC)
 * Tasks:
 * 1. Mark expired listings
 * 2. Send closing reminders (listings closing in 24h)
 * 3. Clean up old fulfilled listings (after 30 days)
 */
exports.processDailyTasks = functions.pubsub
    .schedule('30 0 * * *') // 12:30 AM UTC = 6:00 AM IST
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
    console.log('Starting daily scheduled tasks...');
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    try {
        // Task 1: Mark expired listings
        console.log('Task 1: Marking expired listings...');
        const expiredQuery = db.collection('groupListings')
            .where('deadline', '<', now.toISOString())
            .where('status', '==', 'active');
        const expiredSnapshot = await expiredQuery.get();
        for (const doc of expiredSnapshot.docs) {
            await doc.ref.update({
                status: 'expired',
                expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Marked listing ${doc.id} as expired`);
        }
        // Task 2: Send closing reminders (listings closing in 24h)
        console.log('Task 2: Sending closing reminders...');
        const closingQuery = db.collection('groupListings')
            .where('deadline', '>', now.toISOString())
            .where('deadline', '<', tomorrow.toISOString())
            .where('status', '==', 'active');
        const closingSnapshot = await closingQuery.get();
        for (const doc of closingSnapshot.docs) {
            const listing = doc.data();
            // Get all participants
            const itemsSnapshot = await db.collection(`groupListings/${doc.id}/items`).get();
            // Notify organizer
            await db.collection('alerts').add({
                type: 'listing_closing',
                title: 'Listing Closing Tomorrow! ⏰',
                message: `Your listing "${listing.groupName}" closes tomorrow!`,
                district: listing.district || '',
                listingId: doc.id,
                priority: 'high',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
            });
            // Notify remaining participants
            const currentQty = listing.currentQuantity || 0;
            const targetQty = listing.quantity || 1;
            const remaining = Math.max(0, targetQty - currentQty);
            if (remaining > 0) {
                for (const itemDoc of itemsSnapshot.docs) {
                    // Create alert for each participant
                    await db.collection('alerts').add({
                        type: 'listing_closing',
                        title: 'Last Chance to Join! ⏰',
                        message: `"${listing.groupName}" closes tomorrow. ${remaining} q still needed.`,
                        district: listing.district || '',
                        listingId: doc.id,
                        priority: 'medium',
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        read: false,
                    });
                }
            }
        }
        // Task 3: Clean up old fulfilled listings
        console.log('Task 3: Cleaning up old listings...');
        const oldQuery = db.collection('groupListings')
            .where('status', '==', 'fulfilled')
            .where('updatedAt', '<', thirtyDaysAgo.toISOString());
        const oldSnapshot = await oldQuery.get();
        let cleanedCount = 0;
        for (const doc of oldSnapshot.docs) {
            // Archive listing (move to archive collection)
            const listingData = doc.data();
            await db.collection('groupListingsArchive').doc(doc.id).set(Object.assign(Object.assign({}, listingData), { archivedAt: admin.firestore.FieldValue.serverTimestamp() }));
            // Delete the original
            await doc.ref.delete();
            cleanedCount++;
        }
        console.log(`Daily tasks complete. Expired: ${expiredSnapshot.size}, Reminded: ${closingSnapshot.size}, Cleaned: ${cleanedCount}`);
        return null;
    }
    catch (error) {
        console.error('Error in daily tasks:', error);
        return null;
    }
});
/**
 * Scheduled Function: processWeeklyDigest
 * Runs every Sunday at 10:00 AM IST
 * Sends weekly digest to users about:
 * - New listings in their district
 * - Their active listings status
 * - Market price trends
 */
exports.processWeeklyDigest = functions.pubsub
    .schedule('0 4 * * 0') // 10:30 AM UTC = 4:30 AM IST (adjusted)
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
    console.log('Starting weekly digest...');
    try {
        // Get all users who opted in for weekly digest
        const usersSnapshot = await db.collection('users')
            .where('weeklyDigest', '==', true)
            .get();
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        // Get new listings this week
        const newListingsQuery = db.collection('groupListings')
            .where('createdAt', '>', weekAgo.toISOString());
        const newListingsSnapshot = await newListingsQuery.get();
        const listingsByDistrict = {};
        for (const doc of newListingsSnapshot.docs) {
            const district = doc.data().district || 'Unknown';
            listingsByDistrict[district] = (listingsByDistrict[district] || 0) + 1;
        }
        // Send digest to each user
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const district = userData.district || '';
            const newCount = listingsByDistrict[district] || 0;
            let message = '';
            if (newCount > 0) {
                message = `${newCount} new group listings this week in ${district || 'your area'}.`;
            }
            else {
                message = 'No new group listings this week. Check market prices!';
            }
            await db.collection('alerts').add({
                type: 'new_listing',
                title: 'Weekly Digest 📊',
                message,
                district,
                listingId: '',
                priority: 'low',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
            });
        }
        console.log(`Weekly digest sent to ${usersSnapshot.size} users`);
        return null;
    }
    catch (error) {
        console.error('Error in weekly digest:', error);
        return null;
    }
});
/**
 * HTTP Function: triggerManualAlert
 * Allows manual triggering of alerts for testing
 */
exports.triggerManualAlert = functions.https.onCall(async (data, context) => {
    // Check for admin authorization (could be enhanced)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const { listingId, type } = data;
    if (!listingId) {
        throw new functions.https.HttpsError('invalid-argument', 'listingId required');
    }
    try {
        const listingDoc = await db.collection('groupListings').doc(listingId).get();
        const listing = listingDoc.data();
        if (!listing) {
            throw new functions.https.HttpsError('not-found', 'Listing not found');
        }
        // Get district users
        const usersSnapshot = await db.collection('users')
            .where('district', '==', listing.district || '')
            .get();
        const title = type === 'reminder' ? 'Reminder: Join Group Listing! 🔔' : 'Group Listing Update 📢';
        const message = `${listing.groupName} - ${listing.currentQuantity}/${listing.quantity} q committed`;
        for (const _ of usersSnapshot.docs.slice(0, 30)) {
            await db.collection('alerts').add({
                type: type === 'reminder' ? 'listing_closing' : 'listing_progress',
                title,
                message,
                district: listing.district || '',
                listingId,
                priority: 'medium',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
            });
        }
        return { success: true, notified: Math.min(usersSnapshot.size, 30) };
    }
    catch (error) {
        console.error('Error triggering manual alert:', error);
        throw new functions.https.HttpsError('internal', 'Failed to trigger alert');
    }
});
//# sourceMappingURL=scheduled.js.map