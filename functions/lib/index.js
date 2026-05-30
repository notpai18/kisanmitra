"use strict";
/**
 * KisanMitra Cloud Functions
 *
 * Exported Functions:
 * - Trust Score: calculateTrustScore, onOrderCompleted, getUserTrustScore
 * - Alerts: onGroupListingItemAdded, onGroupListingCreated, onCropReportHighSeverity, getAlerts, markAlertRead
 * - Scheduled: processDailyTasks, processWeeklyDigest, triggerManualAlert
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
__exportStar(require("./trustScore"), exports);
__exportStar(require("./alerts"), exports);
__exportStar(require("./scheduled"), exports);
// Default function for Firebase Functions runtime
// This exports all functions at root level for Firebase to discover
const trustScore = __importStar(require("./trustScore"));
const alerts = __importStar(require("./alerts"));
const scheduled = __importStar(require("./scheduled"));
exports.default = {
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
//# sourceMappingURL=index.js.map