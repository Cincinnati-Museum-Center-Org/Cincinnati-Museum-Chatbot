/**
 * Dashboard Configuration
 * 
 * Thresholds and settings for the admin dashboard.
 * Modify these values to adjust when metrics are flagged as "needs attention".
 */

export const dashboardConfig = {
  // Satisfaction Rate Thresholds
  satisfaction: {
    // Below this percentage, satisfaction is flagged as "Needs attention"
    goodThreshold: 50, // percentage
    // Above this percentage, satisfaction is flagged as "Excellent"
    excellentThreshold: 80, // percentage
  },

  // Response Time Thresholds (in milliseconds)
  responseTime: {
    // Below this time, response is "Fast"
    fastThreshold: 4000, // 2 seconds
    // Below this time, response is "Within target"
    targetThreshold: 6000, // 5 seconds
    // Above targetThreshold, response is "Above target" (needs attention)
  },

  // Negative Feedback Thresholds
  negativeFeedback: {
    // Above this count in the period, it's flagged as "Review needed"
    warningThreshold: 5,
    // Above this count, it's flagged as "Critical"
    criticalThreshold: 20,
  },

  // Conversations per day thresholds
  conversations: {
    // Below this daily average is considered low activity
    lowActivityThreshold: 10,
    // Above this daily average is considered high activity
    highActivityThreshold: 100,
  },

  // Pagination settings
  pagination: {
    // Number of conversations per page
    pageSize: 20,
  },

  // Data periods
  periods: {
    // Default days for stats overview
    statsDefaultDays: 7,
    // Default days for feedback summary
    feedbackDefaultDays: 30,
  },
};

// Helper functions for threshold evaluation
export function getSatisfactionStatus(rate: number): { label: string; isGood: boolean } {
  if (rate >= dashboardConfig.satisfaction.excellentThreshold) {
    return { label: 'Excellent', isGood: true };
  }
  if (rate >= dashboardConfig.satisfaction.goodThreshold) {
    return { label: 'Good', isGood: true };
  }
  return { label: 'Needs attention', isGood: false };
}

export function getResponseTimeStatus(ms: number): { label: string; isGood: boolean } {
  if (ms <= dashboardConfig.responseTime.fastThreshold) {
    return { label: 'Fast', isGood: true };
  }
  if (ms <= dashboardConfig.responseTime.targetThreshold) {
    return { label: 'Within target', isGood: true };
  }
  return { label: 'Above target', isGood: false };
}

export function getNegativeFeedbackStatus(count: number): { label: string; isGood: boolean } {
  if (count === 0) {
    return { label: 'All clear', isGood: true };
  }
  if (count <= dashboardConfig.negativeFeedback.warningThreshold) {
    return { label: 'Review needed', isGood: false };
  }
  if (count <= dashboardConfig.negativeFeedback.criticalThreshold) {
    return { label: 'High volume', isGood: false };
  }
  return { label: 'Critical', isGood: false };
}
