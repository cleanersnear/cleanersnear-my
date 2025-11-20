'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { BUSINESS_LOCATIONS } from '@/config/google-business'

interface ReviewData {
  customerName: string
  customerEmail: string
  googlePicture?: string
  rating: number
  reviewText: string
  completedLocations: string[]
}

interface GoogleUser {
  email: string
  name: string
  picture: string
  given_name: string
  family_name: string
}

// Declare google type for TypeScript
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          prompt: () => void
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string
              size?: string
              type?: string
              shape?: string
              text?: string
              width?: number
            }
          ) => void
        }
      }
    }
  }
}

export default function GoogleReviewPage() {
  const supabase = createClientComponentClient()
  const [step, setStep] = useState<'welcome' | 'form' | 'reviewing' | 'complete'>('welcome')
  const [reviewData, setReviewData] = useState<ReviewData>({
    customerName: '',
    customerEmail: '',
    rating: 5,
    reviewText: '',
    completedLocations: []
  })
  const [currentLocationIndex, setCurrentLocationIndex] = useState(0)
  const [countdown, setCountdown] = useState(10)
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(true)

  // Initialize Google Sign-In
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (typeof window !== 'undefined' && window.google) {
        try {
          // Get Google Client ID from environment variable
          const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
          
          if (!clientId) {
            console.error('Google Client ID not configured in environment variables')
            setIsLoadingGoogle(false)
            return
          }
          
          console.log('Initializing Google Sign-In with Client ID:', clientId.substring(0, 20) + '...')
          
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCallback,
            auto_select: false,
            cancel_on_tap_outside: false
          })
          
          setIsLoadingGoogle(false)
          console.log('Google Sign-In initialized successfully')
          
        } catch (error) {
          console.error('Error initializing Google Sign-In:', error)
          setIsLoadingGoogle(false)
        }
      }
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    
    script.onload = () => {
      console.log('Google Sign-In script loaded')
      initializeGoogleSignIn()
    }
    
    script.onerror = () => {
      console.error('Failed to load Google Sign-In script')
      setIsLoadingGoogle(false)
    }
    
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGoogleCallback = (response: { credential: string }) => {
    try {
      if (!response || !response.credential) {
        console.error('No credential received from Google')
        return
      }

      console.log('Google Sign-In successful, processing user data...')

      // Decode JWT token to get user info
      const base64Url = response.credential.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )

      const userData: GoogleUser = JSON.parse(jsonPayload)

      console.log('User data received:', userData.name, userData.email)

      // Set user data from Google account
      setReviewData({
        customerName: userData.name,
        customerEmail: userData.email,
        googlePicture: userData.picture,
        rating: 5,
        reviewText: '',
        completedLocations: []
      })

      setStep('form')
    } catch (error) {
      console.error('Error processing Google sign-in:', error)
      alert('Failed to sign in with Google. Please try again.')
    }
  }

  // Countdown for final redirect
  useEffect(() => {
    if (step === 'complete') {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            window.location.href = 'https://www.cleaningprofessionals.com.au/'
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [step])

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Save review intent to database
    try {
      await supabase
        .from('google_review_intents')
        .insert([{
          customer_name: reviewData.customerName,
          customer_email: reviewData.customerEmail,
          rating: reviewData.rating,
          review_text: reviewData.reviewText,
          completed_locations: [],
          created_at: new Date().toISOString()
        }])

      // Start the review process
      setStep('reviewing')
      openNextReviewWindow()
    } catch (error) {
      console.error('Error saving review intent:', error)
      alert('Failed to save review. Please try again.')
    }
  }

  const openNextReviewWindow = () => {
    if (currentLocationIndex < BUSINESS_LOCATIONS.length) {
      const location = BUSINESS_LOCATIONS[currentLocationIndex]
      // Open Google review page in new tab
      window.open(location.reviewUrl, '_blank', 'width=800,height=900')
    }
  }

  const handleLocationCompleted = () => {
    const location = BUSINESS_LOCATIONS[currentLocationIndex]
    const updatedLocations = [...reviewData.completedLocations, location.id]
    
    setReviewData(prev => ({
      ...prev,
      completedLocations: updatedLocations
    }))

    // Update database
    supabase
      .from('google_review_intents')
      .update({ 
        completed_locations: updatedLocations,
        updated_at: new Date().toISOString()
      })
      .eq('customer_email', reviewData.customerEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(() => {
        if (currentLocationIndex < BUSINESS_LOCATIONS.length - 1) {
          // Move to next location
          setCurrentLocationIndex(currentLocationIndex + 1)
          setTimeout(() => openNextReviewWindow(), 2000)
        } else {
          // All locations completed
          setStep('complete')
        }
      })
  }

  const handleSkipLocation = () => {
    if (currentLocationIndex < BUSINESS_LOCATIONS.length - 1) {
      setCurrentLocationIndex(currentLocationIndex + 1)
      setTimeout(() => openNextReviewWindow(), 1000)
    } else {
      setStep('complete')
    }
  }

  // Welcome Screen
  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
          <div className="flex flex-col items-center text-center">
            <Image 
              src="/logo.webp" 
              alt="Cleaning Professionals" 
              width={140} 
              height={47} 
              priority
              className="mb-6"
            />
            
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Share Your Experience
            </h1>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Help us grow by sharing your experience on Google!
            </p>

            {/* Google Sign-In Button Container */}
            <div 
              id="google-signin-button" 
              className="w-full flex justify-center mb-4"
              ref={(element) => {
                if (element && !isLoadingGoogle && window.google) {
                  try {
                    window.google.accounts.id.renderButton(element, {
                      theme: 'outline',
                      size: 'large',
                      type: 'standard',
                      shape: 'rectangular',
                      text: 'continue_with',
                      width: element.offsetWidth
                    })
                  } catch (error) {
                    console.error('Error rendering Google button:', error)
                  }
                }
              }}
            ></div>

            {isLoadingGoogle && (
              <div className="w-full flex items-center justify-center py-3">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span className="text-sm text-gray-600">Loading Google Sign-In...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Form Screen
  if (step === 'form') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
          {/* Simple Google Sync Indicator */}
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            </div>
          </div>

          <div className="flex flex-col items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Write Your Review</h2>
            <p className="text-gray-600 text-sm mt-2">This review will be posted to all 3 locations</p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div className="text-center space-y-1">
              <p className="text-base font-medium text-gray-900">{reviewData.customerName}</p>
              <p className="text-sm text-gray-600">{reviewData.customerEmail}</p>
            </div>

            <div>
              <div className="flex gap-1 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewData({ ...reviewData, rating: star })}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <svg
                      className={`w-8 h-8 ${star <= reviewData.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <textarea
                required
                value={reviewData.reviewText}
                onChange={(e) => setReviewData({ ...reviewData, reviewText: e.target.value })}
                rows={5}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
                placeholder="Tell others about your experience with Cleaning Professionals..."
                minLength={50}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              Continue to Google Reviews
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Reviewing Screen
  if (step === 'reviewing') {
    const currentLocation = BUSINESS_LOCATIONS[currentLocationIndex]
    const progress = ((reviewData.completedLocations.length) / BUSINESS_LOCATIONS.length) * 100

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
          <div className="flex flex-col items-center">
            <div className="w-full mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>{reviewData.completedLocations.length} of {BUSINESS_LOCATIONS.length} completed</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📍</span>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Review Location {currentLocationIndex + 1} of {BUSINESS_LOCATIONS.length}
            </h2>
            <p className="text-lg text-gray-700 font-medium mb-6 text-center">
              {currentLocation.name}
            </p>

            <div className="bg-blue-50 rounded-lg p-4 mb-6 w-full">
              <p className="text-sm text-gray-700 mb-3">
                <strong>Your Review:</strong>
              </p>
              <div className="flex mb-2">
                {[...Array(reviewData.rating)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600 italic">
                &quot;{reviewData.reviewText.substring(0, 100)}{reviewData.reviewText.length > 100 ? '...' : ''}&quot;
              </p>
            </div>

            <div className="space-y-3 w-full">
              <button
                onClick={handleLocationCompleted}
                className="w-full bg-green-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                I&apos;ve Posted the Review
              </button>

              <button
                onClick={openNextReviewWindow}
                className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Open Review Page Again
              </button>

              <button
                onClick={handleSkipLocation}
                className="w-full bg-gray-200 text-gray-700 font-medium py-2 px-6 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                Skip This Location
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              Can&apos;t see the Google review window? Make sure pop-ups are enabled for this site.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Complete Screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Thank You! 🎉
          </h2>
          <p className="text-gray-600 mb-4 leading-relaxed">
            We truly appreciate you taking the time to share your experience. Your reviews help other customers find quality cleaning services and help us grow!
          </p>

          <div className="bg-green-50 rounded-lg p-4 mb-6 w-full">
            <p className="text-sm font-medium text-green-800 mb-2">
              Reviews Posted: {reviewData.completedLocations.length} of {BUSINESS_LOCATIONS.length}
            </p>
            <div className="space-y-1">
              {BUSINESS_LOCATIONS.map(location => (
                <div key={location.id} className="flex items-center text-sm">
                  {reviewData.completedLocations.includes(location.id) ? (
                    <>
                      <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="text-green-700">{location.name}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/>
                      </svg>
                      <span className="text-gray-500">{location.name} (skipped)</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            Redirecting to homepage in {countdown} seconds...
          </p>

          <a 
            href="https://www.cleaningprofessionals.com.au/"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Return to Homepage
          </a>
        </div>
      </div>
    </div>
  )
}




