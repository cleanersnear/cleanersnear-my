'use client'

import { useEffect } from 'react'
import Image from 'next/image'

export default function Home() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = 'https://www.cleaningprofessionals.com.au'
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="text-center">
        <Image 
          src="/logo.webp" 
          alt="Cleaning Professionals" 
          width={180} 
          height={60} 
          priority
          className="mb-4"
        />
        <p className="text-gray-500 mt-4">Redirecting to main website...</p>
      </div>
    </main>
  )
}
