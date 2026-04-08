/**
 * Central user-facing copy used as fallback when translation context is unavailable.
 * Prefer using t() from useLanguage() in components instead.
 */
export const UI = {
  errorTitleHi: 'कुछ गलत हुआ',
  errorTitleEn: 'Something went wrong',
  tryAgainHi: 'फिर कोशिश करें',
  tryAgainEn: 'Try Again',
  aiUnavailable: 'AI सेवा उपलब्ध नहीं — कुछ देर बाद कोशिश करें',
  marketEmptyHi: 'कोई लिस्टिंग नहीं मिली',
  marketEmptyEn: 'No listings found',
  addFirstListing: 'Add Your First Listing',
} as const;
