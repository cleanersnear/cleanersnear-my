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
    __googleSignInTimeout?: NodeJS.Timeout
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
  const [redirectCountdown, setRedirectCountdown] = useState(5)

  // Auto-redirect countdown effect
  useEffect(() => {
    if (redirectCountdown > 0 && redirectCountdown < 5) {
      const timer = setTimeout(() => {
        setRedirectCountdown(redirectCountdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (redirectCountdown === 0) {
      window.location.href = '/feedback'
    }
  }, [redirectCountdown])

  // Initialize Google Sign-In
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (typeof window !== 'undefined' && window.google) {
        try {
          // Get Google Client ID from environment variable
          const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
          
          if (!clientId) {
            console.error('Google Client ID not configured')
            setIsLoadingGoogle(false)
            setRedirectCountdown(4)
            return
          }
          
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCallback,
            auto_select: false,
            cancel_on_tap_outside: false
          })
          
          setIsLoadingGoogle(false)
          
          // Show the One Tap UI
          // Note: prompt() may fail with NetworkError if domains aren't authorized
          window.google.accounts.id.prompt()
          
          // Set a backup timeout - if user doesn't sign in within 3 seconds,
          // likely means OAuth error occurred (NetworkError)
          const promptTimeout = setTimeout(() => {
            // If still on welcome step (not moved to form), assume error
            console.log('Google Sign-In appears to have failed - redirecting to feedback')
            setRedirectCountdown(4)
          }, 3000)
          
          // Store timeout reference to clear it if user signs in successfully
          if (typeof window !== 'undefined') {
            window.__googleSignInTimeout = promptTimeout
          }
        } catch (error) {
          console.error('Error initializing Google Sign-In:', error)
          setIsLoadingGoogle(false)
          // Auto-redirect to feedback after 5 seconds if error
          setRedirectCountdown(4)
        }
      }
    }

    // Timeout to catch if Google Sign-In script fails to load
    const loadTimeout = setTimeout(() => {
      if (isLoadingGoogle) {
        console.error('Google Sign-In script failed to load in time')
        setIsLoadingGoogle(false)
        setRedirectCountdown(4)
      }
    }, 10000) // 10 second timeout

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    
    script.onload = () => {
      clearTimeout(loadTimeout)
      initializeGoogleSignIn()
    }
    
    script.onerror = () => {
      clearTimeout(loadTimeout)
      console.error('Failed to load Google Sign-In script')
      setIsLoadingGoogle(false)
      setRedirectCountdown(4)
    }
    
    document.body.appendChild(script)

    return () => {
      clearTimeout(loadTimeout)
      if (typeof window !== 'undefined' && window.__googleSignInTimeout) {
        clearTimeout(window.__googleSignInTimeout)
      }
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGoogleCallback = (response: { credential: string }) => {
    // Clear the redirect timeout since user signed in successfully
    if (typeof window !== 'undefined' && window.__googleSignInTimeout) {
      clearTimeout(window.__googleSignInTimeout)
    }

    try {
      if (!response || !response.credential) {
        console.error('No credential received from Google')
        setRedirectCountdown(4)
        return
      }

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
      // Redirect to feedback form instead of showing alert
      setRedirectCountdown(4)
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
            
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Share Your Experience
            </h1>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Help us grow by sharing your experience on Google! Your review will be posted to all our locations, making it easier for others to find quality cleaning services.
            </p>

            <div className="bg-blue-50 rounded-lg p-4 mb-6 w-full">
              <p className="text-sm text-gray-700 font-medium mb-2">Your review will be posted to:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {BUSINESS_LOCATIONS.map(location => (
                  <li key={location.id} className="flex items-center">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    {location.name}
                  </li>
                ))}
              </ul>
            </div>

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

            {redirectCountdown < 5 && redirectCountdown > 0 && (
              <div className="w-full space-y-3 animate-in fade-in duration-500">
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-yellow-900 mb-1">
                        Google Sign-In Not Available
                      </h3>
                      <p className="text-sm text-yellow-800 mb-3">
                        We&apos;re having trouble connecting to Google. Don&apos;t worry - you can still leave feedback using our regular form!
                      </p>
                      <div className="flex items-center gap-2 text-sm text-yellow-700">
                        <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Redirecting in {redirectCountdown} seconds...</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <a
                  href="/feedback"
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-3.5 px-6 rounded-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Go to Feedback Form Now
                </a>
              </div>
            )}

            {!isLoadingGoogle && redirectCountdown === 5 && (
              <>
                <p className="text-xs text-gray-500 mt-4">
                  🔒 Secure sign-in with your Google account • We&apos;ll auto-fill your details
                </p>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600 text-center mb-3">
                    Prefer not to sign in with Google?
                  </p>
                  <a
                    href="/feedback"
                    className="w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Use Regular Feedback Form
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </>
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
          {/* Google Account Sync Banner */}
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            {reviewData.googlePicture && (
              <Image 
                src={reviewData.googlePicture} 
                alt="Profile" 
                width={48}
                height={48}
                className="w-12 h-12 rounded-full border-2 border-green-300"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span className="text-sm font-semibold text-green-800">Synced with Google Account</span>
              </div>
              <p className="text-xs text-green-700">{reviewData.customerEmail}</p>
            </div>
            <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>

          <div className="flex flex-col items-center mb-6">
            <Image 
              src="/logo.webp" 
              alt="Cleaning Professionals" 
              width={120} 
              height={40} 
              priority
              className="mb-4"
            />
            <h2 className="text-2xl font-bold text-gray-900">Write Your Review</h2>
            <p className="text-gray-600 text-sm mt-2">This review will be posted to all 3 locations</p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={reviewData.customerName}
                  readOnly
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-gray-50 text-gray-700 cursor-not-allowed"
                  placeholder="John Smith"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Auto-filled from your Google account</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={reviewData.customerEmail}
                  readOnly
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-gray-50 text-gray-700 cursor-not-allowed"
                  placeholder="john@example.com"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Auto-filled from your Google account</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Rating *
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewData({ ...reviewData, rating: star })}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <svg
                      className={`w-10 h-10 ${star <= reviewData.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Review *
              </label>
              <textarea
                required
                value={reviewData.reviewText}
                onChange={(e) => setReviewData({ ...reviewData, reviewText: e.target.value })}
                rows={5}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
                placeholder="Tell others about your experience with Cleaning Professionals..."
                minLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 50 characters</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-800">Important</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    You&apos;ll be redirected to Google to post this review on each of our 3 business locations. Please complete all 3 to help us the most!
                  </p>
                </div>
              </div>
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


