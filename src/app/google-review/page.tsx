'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { BUSINESS_LOCATIONS } from '@/config/google-business'


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

  const handleGoogleCallback = async (response: { credential: string }) => {
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

      // Save to database for tracking
      await supabase
        .from('google_review_intents')
        .insert([{
          customer_name: userData.name,
          customer_email: userData.email,
          rating: 5, // Default to 5 since we're sending to Google
          review_text: 'Direct Google review',
          completed_locations: [],
          created_at: new Date().toISOString()
        }])

      
      // Skip form, go directly to reviewing
      setStep('reviewing')

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


  // Reviewing Screen - Show all 3 location links
  if (step === 'reviewing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
          <div className="flex flex-col items-center">
            <Image 
              src="/logo.webp" 
              alt="Cleaning Professionals" 
              width={120} 
              height={40} 
              priority
              className="mb-6"
            />
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Post Your Review
            </h2>
            <p className="text-gray-600 mb-8 text-center">
              Click each location below to post your review on Google
            </p>

            <div className="space-y-4 w-full">
              {BUSINESS_LOCATIONS.map((location, index) => (
                <a
                  key={location.id}
                  href={location.reviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition">
                      <span className="text-lg font-bold text-blue-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{location.name.split(' - ')[1]}</p>
                      <p className="text-xs text-gray-500">{location.address}</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>

            <button
              onClick={() => setStep('complete')}
              className="mt-8 text-sm text-gray-600 hover:text-gray-900 transition"
            >
              Done posting reviews →
            </button>
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
          <p className="text-gray-600 mb-6 leading-relaxed">
            We truly appreciate you taking the time to share your experience. Your reviews help other customers find quality cleaning services and help us grow!
          </p>

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




