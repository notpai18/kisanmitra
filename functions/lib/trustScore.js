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
exports.getUserTrustScore = exports.onOrderCompleted = exports.calculateTrustScore = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Cloud Function: calculateTrustScore
 * Trigger: HTTPS call or Firestore user update
 * Calculates trust score for a user based on their transaction history
 */
exports.calculateTrustScore = functions.https.onCall(async (data, context) => {
    // Ensure user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const userId = data.userId || context.auth.uid;
    console.log(`Calculating trust score for user: ${userId}`);
    try {
        // Get user's transaction data
        const ordersSnapshot = await db.collection('orders')
            .where('sellerId', '==', userId)
            .get();
        const purchasesSnapshot = await db.collection('orders')
            .where('buyerId', '==', userId)
            .get();
        // Get ratings for this user
        const ratingsSnapshot = await db.collection('ratings')
            .where('ratedUserId', '==', userId)
            .get();
        // Get disputes
        const disputesSnapshot = await db.collection('disputes')
            .where('userId', '==', userId)
            .get();
        // Calculate metrics
        const totalOrders = ordersSnapshot.size + purchasesSnapshot.size;
        const totalDisputes = disputesSnapshot.size;
        // Calculate average rating
        let totalRating = 0;
        ratingsSnapshot.forEach(doc => {
            totalRating += doc.data().rating || 0;
        });
        const ratingCount = ratingsSnapshot.size;
        const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
        // Get user's verification status from profile
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        const verifiedFields = {
            phone: !!(userData === null || userData === void 0 ? void 0 : userData.phone),
            aadhaar: !!(userData === null || userData === void 0 ? void 0 : userData.aadhaarLast4),
            bankAccount: !!(userData === null || userData === void 0 ? void 0 : userData.bankAccount),
            landRecords: !!(userData === null || userData === void 0 ? void 0 : userData.verifiedLand),
        };
        const verifiedCount = Object.values(verifiedFields).filter(Boolean).length;
        // Calculate trust score
        const transactionsScore = Math.min(totalOrders * 5, 50); // Max 50 points
        const ratingScore = Math.min(averageRating * 20, 40); // Max 40 points
        const disputeScore = totalDisputes * 10; // -10 per dispute
        const verificationScore = verifiedCount * 3.75; // Max 15 points (4 fields * 3.75)
        let overall = transactionsScore + ratingScore - disputeScore + verificationScore;
        overall = Math.max(0, Math.min(100, Math.round(overall)));
        const trustScore = {
            overall,
            verified: verifiedCount >= 2, // Considered verified if 2+ fields verified
            transactions: totalOrders,
            disputes: totalDisputes,
            rating: Math.round(averageRating * 10) / 10,
            ratingCount,
            verifiedFields,
        };
        // Update user's trust score in Firestore
        await db.collection('users').doc(userId).update({
            trustScore,
            trustScoreUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Trust score calculated: ${overall} for user ${userId}`);
        return { success: true, trustScore };
    }
    catch (error) {
        console.error('Error calculating trust score:', error);
        throw new functions.https.HttpsError('internal', 'Failed to calculate trust score');
    }
});
/**
 * Cloud Function: onOrderCompleted
 * Trigger: Firestore on order status change to 'delivered'
 * Automatically recalculates trust score when order completes
 */
exports.onOrderCompleted = functions.firestore
    .document('orders/{orderId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Only trigger when status changes to 'delivered'
    if ((before === null || before === void 0 ? void 0 : before.status) !== 'delivered' && (after === null || after === void 0 ? void 0 : after.status) === 'delivered') {
        const sellerId = after.sellerId;
        const buyerId = after.buyerId;
        console.log(`Order ${context.params.orderId} completed. Recalculating trust scores for seller: ${sellerId}, buyer: ${buyerId}`);
        try {
            // Recalculate trust score for seller
            const sellerOrdersSnapshot = await db.collection('orders')
                .where('sellerId', '==', sellerId)
                .get();
            const sellerPurchasesSnapshot = await db.collection('orders')
                .where('buyerId', '==', sellerId)
                .get();
            const sellerRatingsSnapshot = await db.collection('ratings')
                .where('ratedUserId', '==', sellerId)
                .get();
            const sellerDisputesSnapshot = await db.collection('disputes')
                .where('userId', '==', sellerId)
                .get();
            const sellerTotalOrders = sellerOrdersSnapshot.size + sellerPurchasesSnapshot.size;
            const sellerTotalDisputes = sellerDisputesSnapshot.size;
            let sellerTotalRating = 0;
            sellerRatingsSnapshot.forEach(doc => {
                sellerTotalRating += doc.data().rating || 0;
            });
            const sellerRatingCount = sellerRatingsSnapshot.size;
            const sellerAverageRating = sellerRatingCount > 0 ? sellerTotalRating / sellerRatingCount : 0;
            const sellerUserDoc = await db.collection('users').doc(sellerId).get();
            const sellerUserData = sellerUserDoc.data();
            const sellerVerifiedFields = {
                phone: !!(sellerUserData === null || sellerUserData === void 0 ? void 0 : sellerUserData.phone),
                aadhaar: !!(sellerUserData === null || sellerUserData === void 0 ? void 0 : sellerUserData.aadhaarLast4),
                bankAccount: !!(sellerUserData === null || sellerUserData === void 0 ? void 0 : sellerUserData.bankAccount),
                landRecords: !!(sellerUserData === null || sellerUserData === void 0 ? void 0 : sellerUserData.verifiedLand),
            };
            const sellerVerifiedCount = Object.values(sellerVerifiedFields).filter(Boolean).length;
            const sellerTransactionsScore = Math.min(sellerTotalOrders * 5, 50);
            const sellerRatingScore = Math.min(sellerAverageRating * 20, 40);
            const sellerDisputeScore = sellerTotalDisputes * 10;
            const sellerVerificationScore = sellerVerifiedCount * 3.75;
            let sellerOverall = sellerTransactionsScore + sellerRatingScore - sellerDisputeScore + sellerVerificationScore;
            sellerOverall = Math.max(0, Math.min(100, Math.round(sellerOverall)));
            await db.collection('users').doc(sellerId).update({
                trustScore: {
                    overall: sellerOverall,
                    verified: sellerVerifiedCount >= 2,
                    transactions: sellerTotalOrders,
                    disputes: sellerTotalDisputes,
                    rating: Math.round(sellerAverageRating * 10) / 10,
                    ratingCount: sellerRatingCount,
                    verifiedFields: sellerVerifiedFields,
                },
                trustScoreUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Trust score updated for seller ${sellerId}: ${sellerOverall}`);
            // Recalculate trust score for buyer (if different from seller)
            if (buyerId && buyerId !== sellerId) {
                const buyerOrdersSnapshot = await db.collection('orders')
                    .where('sellerId', '==', buyerId)
                    .get();
                const buyerPurchasesSnapshot = await db.collection('orders')
                    .where('buyerId', '==', buyerId)
                    .get();
                const buyerRatingsSnapshot = await db.collection('ratings')
                    .where('ratedUserId', '==', buyerId)
                    .get();
                const buyerDisputesSnapshot = await db.collection('disputes')
                    .where('userId', '==', buyerId)
                    .get();
                const buyerTotalOrders = buyerOrdersSnapshot.size + buyerPurchasesSnapshot.size;
                const buyerTotalDisputes = buyerDisputesSnapshot.size;
                let buyerTotalRating = 0;
                buyerRatingsSnapshot.forEach(doc => {
                    buyerTotalRating += doc.data().rating || 0;
                });
                const buyerRatingCount = buyerRatingsSnapshot.size;
                const buyerAverageRating = buyerRatingCount > 0 ? buyerTotalRating / buyerRatingCount : 0;
                const buyerUserDoc = await db.collection('users').doc(buyerId).get();
                const buyerUserData = buyerUserDoc.data();
                const buyerVerifiedFields = {
                    phone: !!(buyerUserData === null || buyerUserData === void 0 ? void 0 : buyerUserData.phone),
                    aadhaar: !!(buyerUserData === null || buyerUserData === void 0 ? void 0 : buyerUserData.aadhaarLast4),
                    bankAccount: !!(buyerUserData === null || buyerUserData === void 0 ? void 0 : buyerUserData.bankAccount),
                    landRecords: !!(buyerUserData === null || buyerUserData === void 0 ? void 0 : buyerUserData.verifiedLand),
                };
                const buyerVerifiedCount = Object.values(buyerVerifiedFields).filter(Boolean).length;
                const buyerTransactionsScore = Math.min(buyerTotalOrders * 5, 50);
                const buyerRatingScore = Math.min(buyerAverageRating * 20, 40);
                const buyerDisputeScore = buyerTotalDisputes * 10;
                const buyerVerificationScore = buyerVerifiedCount * 3.75;
                let buyerOverall = buyerTransactionsScore + buyerRatingScore - buyerDisputeScore + buyerVerificationScore;
                buyerOverall = Math.max(0, Math.min(100, Math.round(buyerOverall)));
                await db.collection('users').doc(buyerId).update({
                    trustScore: {
                        overall: buyerOverall,
                        verified: buyerVerifiedCount >= 2,
                        transactions: buyerTotalOrders,
                        disputes: buyerTotalDisputes,
                        rating: Math.round(buyerAverageRating * 10) / 10,
                        ratingCount: buyerRatingCount,
                        verifiedFields: buyerVerifiedFields,
                    },
                    trustScoreUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`Trust score updated for buyer ${buyerId}: ${buyerOverall}`);
            }
        }
        catch (error) {
            console.error('Error updating trust scores:', error);
        }
    }
    return null;
});
/**
 * Cloud Function: getUserTrustScore
 * Trigger: HTTPS GET
 * Returns trust score for any user (for display in UI)
 */
exports.getUserTrustScore = functions.https.onCall(async (data, context) => {
    const userId = data.userId;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        if (!userDoc.exists || !(userData === null || userData === void 0 ? void 0 : userData.trustScore)) {
            return { trustScore: null };
        }
        return { trustScore: userData.trustScore };
    }
    catch (error) {
        console.error('Error fetching trust score:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch trust score');
    }
});
//# sourceMappingURL=trustScore.js.map