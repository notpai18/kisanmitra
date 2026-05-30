/**
 * KisanMitra Cloud Functions
 *
 * Exported Functions:
 * - Trust Score: calculateTrustScore, onOrderCompleted, getUserTrustScore
 * - Alerts: onGroupListingItemAdded, onGroupListingCreated, onCropReportHighSeverity, getAlerts, markAlertRead
 * - Scheduled: processDailyTasks, processWeeklyDigest, triggerManualAlert
 */

export * from './trustScore';
export * from './alerts';
export * from './scheduled';

// Default function for Firebase Functions runtime
// This exports all functions at root level for Firebase to discover
import * as trustScore from './trustScore';
import * as alerts from './alerts';
import * as scheduled from './scheduled';

export default {
  // Trust Score Functions
  calculateTrustScore: trustScore.calculateTrustScore,
  onOrderCompleted: trustScore.onOrderCompleted,
  getUserTrustScore: trustScore.getUserTrustScore,

  // Alert Functions
  onGroupListingItemAdded: alerts.onGroupListingItemAdded,
  onGroupListingCreated: alerts.onGroupListingCreated,
  onCropReportHighSeverity: alerts.onCropReportHighSeverity,
  getAlerts: alerts.getAlerts,
  markAlertRead: alerts.markAlertRead,

  // Scheduled Functions
  processDailyTasks: scheduled.processDailyTasks,
  processWeeklyDigest: scheduled.processWeeklyDigest,
  triggerManualAlert: scheduled.triggerManualAlert,
};