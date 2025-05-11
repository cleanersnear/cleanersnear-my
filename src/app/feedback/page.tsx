'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

import Image from 'next/image'
import Script from 'next/script'

const FEEDBACK_OPTIONS = [
  { value: 'great', label: 'Great', color: 'bg-emerald-50 text-emerald-600', icon: '👍' },
  { value: 'ok', label: 'Okay', color: 'bg-amber-50 text-amber-600', icon: '👌' },
  { value: 'reclean', label: 'Needs reclean', color: 'bg-rose-50 text-rose-600', icon: '🧹' },
]

function FeedbackForm() {
  const searchParams = useSearchParams()
  const bookingNumber = searchParams.get('booking')
  const supabase = createClientComponentClient()
  
  const [form, setForm] = useState({
    feedbackOption: '',
    rating: 5,
    feedback: '',
    bookingNumber: bookingNumber || '',
    name: '',
    email: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isFetchingCustomer, setIsFetchingCustomer] = useState(true)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!bookingNumber) {
        setIsFetchingCustomer(false)
        return
      }
      
      try {
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select('id')
          .eq('booking_number', bookingNumber)
          .single()
          
        if (bookingError) throw bookingError
        if (!booking) throw new Error('Booking not found')
        
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('first_name, last_name, email')
          .eq('booking_id', booking.id)
          .single()
          
        if (customerError) throw customerError
        if (!customer) throw new Error('Customer not found')
        
        setForm(prev => ({
          ...prev,
          name: `${customer.first_name} ${customer.last_name}`,
          email: customer.email || ''
        }))
      } catch {
        // Silent fail, leave fields empty
      } finally {
        setIsFetchingCustomer(false)
      }
    }
    
    fetchCustomerData()
  }, [bookingNumber, supabase])

  useEffect(() => {
    if (success) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            window.location.href = 'https://www.cleaningprofessionals.com.au/';
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [success]);

  const handleOptionClick = (value: string) => {
    let defaultRating = 5
    if (value === 'ok') defaultRating = 4
    if (value === 'reclean') defaultRating = 3
    
    setForm(prev => ({ ...prev, feedbackOption: value, rating: defaultRating }))
    setError(null)
  }

  const handleStarClick = (star: number) => {
    setForm(prev => ({ ...prev, rating: star }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    if (!form.feedbackOption) {
      setError('Please select a feedback option.')
      setIsLoading(false)
      return
    }
    
    try {
      const { error } = await supabase
        .from('feedback')
        .insert([{
          booking_number: form.bookingNumber,
          feedback_option: form.feedbackOption,
          rating: form.rating,
          feedback: form.feedback,
          name: form.name,
          email: form.email,
          created_at: new Date().toISOString()
        }])
        
      if (error) throw error
      setSuccess(true)
    } catch (err: unknown) {
      const errorMessage = 
        err instanceof Error ? err.message :
        typeof err === 'object' && err && 'message' in err && typeof (err as {message: string}).message === 'string' 
          ? (err as {message: string}).message :
        'Failed to submit feedback';
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <>
        <Script id="structured-data" type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Cleaning Professionals Melbourne",
            "url": "https://www.cleaningprofessionals.com.au",
            "logo": "https://www.cleaningprofessionals.com.au/logo.webp",
            "sameAs": [
              "https://www.facebook.com/cleaningprofessionals",
              "https://www.instagram.com/cleaningprofessionals"
            ],
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Melbourne",
              "addressRegion": "VIC",
              "addressCountry": "AU"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "reviewCount": "500"
            }
          })}
        </Script>

        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-medium text-gray-800">Thank you!</h2>
              <p className="text-gray-500 mt-2 mb-6 text-center">We appreciate your feedback and will use it to improve our service.</p>
              <p className="text-sm text-gray-400 mb-4">Redirecting to home page in {countdown} seconds...</p>
              <a 
                href="https://www.cleaningprofessionals.com.au/"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Go to Home Page
              </a>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Script id="structured-data" type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Cleaning Professionals Melbourne",
          "url": "https://www.cleaningprofessionals.com.au",
          "logo": "https://www.cleaningprofessionals.com.au/logo.webp",
          "sameAs": [
            "https://www.facebook.com/cleaningprofessionals",
            "https://www.instagram.com/cleaningprofessionals"
          ],
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Melbourne",
            "addressRegion": "VIC",
            "addressCountry": "AU"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "reviewCount": "500"
          }
        })}
      </Script>

      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-md w-full">
          <div className="flex flex-col items-center mb-6">
            <Image 
              src="/logo.webp" 
              alt="Cleaning Professionals" 
              width={120} 
              height={40} 
              priority
              className="mb-4"
            />
            <h1 className="text-xl font-medium text-gray-800">We value your feedback</h1>
            {bookingNumber && (
              <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                Booking #{bookingNumber}
              </span>
            )}
          </div>
          
          {!form.feedbackOption ? (
            <div className="space-y-3 mb-6">
              <p className="text-gray-500 text-center mb-4">How was your cleaning experience?</p>
              {FEEDBACK_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleOptionClick(opt.value)}
                  className={`w-full flex items-center px-4 py-3 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${opt.color} border border-gray-100`}
                >
                  <span className="text-xl mr-3">{opt.icon}</span>
                  <span className="font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center">
                <span className="text-lg mr-2">
                  {FEEDBACK_OPTIONS.find(o => o.value === form.feedbackOption)?.icon}
                </span>
                <span className="font-medium">
                  {FEEDBACK_OPTIONS.find(o => o.value === form.feedbackOption)?.label}
                </span>
                <button
                  type="button"
                  className="ml-auto text-sm text-indigo-600 hover:text-indigo-800"
                  onClick={() => setForm(prev => ({ ...prev, feedbackOption: '' }))}
                >
                  Change
                </button>
              </div>
              
              <div className="border-t border-b border-gray-100 py-4">
                <p className="text-sm text-gray-500 mb-2">Your rating</p>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleStarClick(star)}
                      className="focus:outline-none"
                    >
                      <svg
                        className={`w-6 h-6 ${star <= form.rating ? 'text-amber-400' : 'text-gray-200'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
              
              {(form.name || form.email) && (
                <div className="text-xs text-gray-400">
                  {form.name && <span>{form.name}</span>}
                  {form.name && form.email && <span className="mx-1">•</span>}
                  {form.email && <span>{form.email}</span>}
                </div>
              )}
              
              <div>
                <textarea
                  name="feedback"
                  value={form.feedback}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition resize-none"
                  placeholder="Tell us more about your experience (optional)"
                />
              </div>
              
              {error && (
                <div className="text-rose-600 text-sm bg-rose-50 p-2 rounded">{error}</div>
              )}
              
              <button
                type="submit"
                disabled={isLoading || isFetchingCustomer}
                className="w-full flex justify-center items-center py-3 px-4 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:bg-indigo-400"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : 'Submit Feedback'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

// Loading component
function FeedbackLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-500">Loading feedback form...</p>
        </div>
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<FeedbackLoading />}>
      <FeedbackForm />
    </Suspense>
  )
} 