/**
 * Google Business Profile Configuration
 * 
 * To get your Google review links:
 * 1. Log into Google Business Profile: https://business.google.com/
 * 2. Select your business location
 * 3. Click on "Get more reviews" or "Share review form"
 * 4. Copy the short link (format: https://g.page/r/XXXXX/review)
 * 5. Add it to the configuration below
 * 
 * The g.page links are the official short URLs provided by Google.
 * They automatically redirect users to the review page for your business.
 */

export interface BusinessLocation {
  id: string
  name: string
  address: string
  placeId: string
  reviewUrl: string
}

export const BUSINESS_LOCATIONS: BusinessLocation[] = [
  {
    id: 'melbourne',
    name: 'Cleaning Professionals - Melbourne VIC',
    address: 'Melbourne VIC, Australia',
    placeId: 'CatIouiPpkIsEBM', // Extracted from g.page URL
    reviewUrl: 'https://g.page/r/CatIouiPpkIsEBM/review'
  },
  {
    id: 'brunswick',
    name: 'Cleaning Professionals - Brunswick',
    address: 'Coburg VIC 3058, Australia',
    placeId: 'CZTz9YgMQeIEEBM', // Extracted from g.page URL
    reviewUrl: 'https://g.page/r/CZTz9YgMQeIEEBM/review'
  },
  {
    id: 'epping',
    name: 'Cleaning Professionals - Epping',
    address: '6 Eva Pl, Epping VIC 3076, Australia',
    placeId: 'CUm3TZyufX2PEBM', // Extracted from g.page URL
    reviewUrl: 'https://g.page/r/CUm3TZyufX2PEBM/review'
  }
]

/**
 * Helper function to get review URL for a specific location
 */
export const getReviewUrl = (locationId: string): string => {
  const location = BUSINESS_LOCATIONS.find(loc => loc.id === locationId)
  return location?.reviewUrl || ''
}

/**
 * Helper function to get all location names
 */
export const getLocationNames = (): string[] => {
  return BUSINESS_LOCATIONS.map(loc => loc.name)
}

/**
 * Helper function to validate if all place IDs are configured
 */
export const areAllPlaceIdsConfigured = (): boolean => {
  return BUSINESS_LOCATIONS.every(
    loc => loc.placeId && loc.placeId.length > 0 && loc.reviewUrl.includes('g.page')
  )
}

