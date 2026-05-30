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
exports.onCropReportHighSeverity = exports.markAlertRead = exports.getAlerts = exports.onGroupListingCreated = exports.onGroupListingItemAdded = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Helper: Send notification to user
 */
async function sendNotification(userId, title, body, data) {
    const userTokensSnapshot = await db.collection('users').doc(userId).collection('tokens').get();
    if (userTokensSnapshot.empty) {
        console.log(`No tokens found for user ${userId}`);
        return;
    }
    const tokens = userTokensSnapshot.docs.map(doc => doc.id);
    const payload = {
        notification: {
            title,
            body,
        },
        data,
    };
    try {
        await admin.messaging().sendToDevice(tokens, payload);
        console.log(`Notification sent to user ${userId}`);
    }
    catch (error) {
        console.error('Error sending notification:', error);
    }
}
/**
 * Helper: Create alert in Firestore
 */
async function createAlert(alert) {
    const alertRef = await db.collection('alerts').add(Object.assign(Object.assign({}, alert), { createdAt: admin.firestore.FieldValue.serverTimestamp(), read: false }));
    return alertRef.id;
}
/**
 * Helper: Get users in district
 */
async function getUsersInDistrict(district) {
    const snapshot = await db.collection('users')
        .where('district', '==', district)
        .get();
    return snapshot.docs.map(doc => doc.id);
}
/**
 * Cloud Function: onGroupListingItemAdded
 * Trigger: Firestore on group listing item creation
 * Sends alerts when listing reaches 50%, 75%, 100% of target
 */
exports.onGroupListingItemAdded = functions.firestore
    .document('groupListings/{listingId}/items/{itemId}')
    .onCreate(async (snap, context) => {
    const itemData = snap.data();
    const listingId = context.params.listingId;
    console.log(`New item added to listing ${listingId}:`, itemData);
    try {
        // Get the parent listing
        const listingDoc = await db.collection('groupListings').doc(listingId).get();
        const listing = listingDoc.data();
        if (!listing) {
            console.log('Listing not found');
            return null;
        }
        // Get all items to calculate current total
        const itemsSnapshot = await db.collection(`groupListings/${listingId}/items`).get();
        const currentQuantity = itemsSnapshot.docs.reduce((sum, doc) => {
            return sum + (doc.data().quantity || 0);
        }, 0);
        const targetQuantity = listing.quantity;
        const progressPercent = (currentQuantity / targetQuantity) * 100;
        console.log(`Listing progress: ${currentQuantity}/${targetQuantity} (${progressPercent.toFixed(1)}%)`);
        // Update listing current quantity
        await db.collection('groupListings').doc(listingId).update({
            currentQuantity,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Check thresholds and send alerts
        if (progressPercent >= 100) {
            // Fulfilled - notify organizer and all participants
            console.log('Listing FULFILLED!');
            // Update status
            await db.collection('groupListings').doc(listingId).update({
                status: 'fulfilled',
            });
            // Alert to organizer
            await createAlert({
                type: 'listing_fulfilled',
                title: 'Group Listing Fulfilled! 🎉',
                message: `Your listing "${listing.groupName}" for ${listing.crop} has reached its target of ${targetQuantity} quintals!`,
                district: listing.district || '',
                listingId,
                priority: 'high',
            });
            await sendNotification(listing.organizerId, 'Listing Fulfilled! 🎉', `${listing.groupName} has reached its target!`, { listingId, type: 'listing_fulfilled' });
            // Alert to participants
            for (const itemDoc of itemsSnapshot.docs) {
                const participantId = itemDoc.data().userId;
                if (participantId !== listing.organizerId) {
                    await sendNotification(participantId, 'Listing Fully Booked! 🌾', `${listing.crop} listing is now full. Delivery soon.`, { listingId, type: 'listing_fulfilled' });
                }
            }
        }
        else if (progressPercent >= 75) {
            // 75% reached - notify all farmers in district
            console.log('Listing at 75%!');
            const users = await getUsersInDistrict(listing.district || '');
            const title = 'Group Listing Almost Full! ⚡';
            const message = `${listing.groupName} is at 75% (${currentQuantity}/${targetQuantity} q). ${(targetQuantity - currentQuantity).toFixed(0)} q remaining!`;
            for (const userId of users) {
                if (userId !== listing.organizerId) {
                    await createAlert({
                        type: 'listing_progress',
                        title,
                        message,
                        district: listing.district || '',
                        listingId,
                        priority: 'medium',
                    });
                    await sendNotification(userId, title, message, { listingId, type: 'listing_progress' });
                }
            }
        }
        else if (progressPercent >= 50) {
            // 50% reached - notify farmers
            console.log('Listing at 50%!');
            const users = await getUsersInDistrict(listing.district || '');
            const title = 'Group Listing Half Full 🌾';
            const message = `${listing.groupName} has reached 50%. Join now to secure your spot!`;
            for (const userId of users.slice(0, 20)) { // Limit to 20 notifications
                if (userId !== listing.organizerId) {
                    await sendNotification(userId, title, message, { listingId, type: 'listing_progress' });
                }
            }
        }
        return null;
    }
    catch (error) {
        console.error('Error processing group listing item:', error);
        return null;
    }
});
/**
 * Cloud Function: onGroupListingCreated
 * Trigger: Firestore on new group listing
 * Sends notification to district farmers about new listing
 */
exports.onGroupListingCreated = functions.firestore
    .document('groupListings/{listingId}')
    .onCreate(async (snap, context) => {
    const listing = snap.data();
    console.log(`New group listing created: ${listing.groupName}`);
    try {
        // Get users in the district
        const users = await getUsersInDistrict(listing.district || '');
        const title = 'New Group Listing! 🌾';
        const message = `${listing.groupName} - ${listing.crop}, ${listing.quantity} q needed. Deadline: ${listing.deadline}`;
        // Create alerts for district users
        for (const userId of users.slice(0, 50)) { // Limit to 50
            if (userId !== listing.organizerId) {
                await createAlert({
                    type: 'new_listing',
                    title,
                    message,
                    district: listing.district || '',
                    listingId: context.params.listingId,
                    priority: 'low',
                });
                await sendNotification(userId, title, message, {
                    listingId: context.params.listingId,
                    type: 'new_listing',
                });
            }
        }
        return null;
    }
    catch (error) {
        console.error('Error sending new listing notifications:', error);
        return null;
    }
});
/**
 * Cloud Function: getAlerts
 * Trigger: HTTPS GET
 * Returns active alerts for a user or district
 */
exports.getAlerts = functions.https.onCall(async (data, context) => {
    const { district, userId, limit = 20 } = data;
    if (!userId && !district) {
        throw new functions.https.HttpsError('invalid-argument', 'userId or district required');
    }
    try {
        let query = db.collection('alerts')
            .orderBy('createdAt', 'desc')
            .limit(limit);
        if (district) {
            query = query.where('district', '==', district);
        }
        const snapshot = await query.get();
        const alerts = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        return { alerts };
    }
    catch (error) {
        console.error('Error fetching alerts:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch alerts');
    }
});
/**
 * Cloud Function: markAlertRead
 * Trigger: HTTPS POST
 * Marks an alert as read
 */
exports.markAlertRead = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const { alertId } = data;
    if (!alertId) {
        throw new functions.https.HttpsError('invalid-argument', 'alertId required');
    }
    try {
        await db.collection('alerts').doc(alertId).update({ read: true });
        return { success: true };
    }
    catch (error) {
        console.error('Error marking alert read:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update alert');
    }
});
/**
 * Cloud Function: onCropReportHighSeverity
 * Trigger: Firestore on new high-severity crop report
 * Sends disease alerts to farmers in the same district
 */
exports.onCropReportHighSeverity = functions.firestore
    .document('users/{userId}/cropReports/{reportId}')
    .onCreate(async (snap, context) => {
    var _a, _b;
    const report = snap.data();
    console.log(`New crop report created for ${report.cropType} by user ${context.params.userId}`);
    // Only alert for high severity non-healthy reports
    if (report.isHealthy === true || report.severity !== 'High') {
        console.log('Skipping alert: not high severity or healthy crop');
        return null;
    }
    try {
        const district = report.district || ((_a = report.location) === null || _a === void 0 ? void 0 : _a.district);
        const state = report.state || ((_b = report.location) === null || _b === void 0 ? void 0 : _b.state);
        if (!district) {
            console.log('No district found in report, skipping alert');
            return null;
        }
        // Get users in the same district
        const usersSnapshot = await db.collection('users')
            .where('district', '==', district)
            .get();
        // Get recent disease alerts to avoid spam (within last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentAlertsSnapshot = await db.collection('alerts')
            .where('type', '==', 'disease_alert')
            .where('district', '==', district)
            .where('createdAt', '>', admin.firestore.Timestamp.fromDate(oneDayAgo))
            .get();
        // If we already sent an alert for this disease today, skip
        const existingDiseases = recentAlertsSnapshot.docs.map(doc => doc.data().diseaseName);
        if (existingDiseases.includes(report.diseaseName)) {
            console.log(`Disease alert already sent for ${report.diseaseName} in ${district} today`);
            return null;
        }
        const title = `⚠️ ${report.diseaseName} Alert in ${district}`;
        const message = `${report.cropType} crops may be at risk. ${report.diseaseName} detected in nearby area. Check your crops and take preventive action.`;
        // Create alerts for district users (limit to 50)
        for (const userDoc of usersSnapshot.docs.slice(0, 50)) {
            if (userDoc.id !== context.params.userId) {
                await createAlert({
                    type: 'disease_alert',
                    title,
                    message,
                    district,
                    listingId: '', // Not a listing alert
                    priority: 'high',
                });
                await sendNotification(userDoc.id, title, message, {
                    type: 'disease_alert',
                    cropType: report.cropType,
                    diseaseName: report.diseaseName,
                });
            }
        }
        console.log(`Disease alert sent for ${report.diseaseName} to ${Math.min(usersSnapshot.size, 50)} users in ${district}`);
        return null;
    }
    catch (error) {
        console.error('Error sending disease alert:', error);
        return null;
    }
});
//# sourceMappingURL=alerts.js.map