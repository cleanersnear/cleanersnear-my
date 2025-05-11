import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cleaning Professionals Melbourne - Customer Feedback",
  description: "Share your experience with Melbourne's leading cleaning service. Your feedback helps us maintain our high standards of professional cleaning services across Melbourne, including end of lease, commercial, and residential cleaning.",
  keywords: "cleaning feedback, Melbourne cleaners, cleaning service review, end of lease cleaning feedback, commercial cleaning review",
  authors: [{ name: "Cleaning Professionals Melbourne" }],
  metadataBase: new URL('https://www.cleaningprofessionals.com.au'),
  openGraph: {
    title: 'Cleaning Professionals Melbourne - Customer Feedback',
    description: 'Share your experience with Melbourne\'s leading cleaning service',
    url: 'https://www.cleaningprofessionals.com.au',
    siteName: 'Cleaning Professionals Melbourne',
    locale: 'en_AU',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  verification: {
    google: 'your-google-verification-code', // You'll need to add your actual Google verification code
  },
  alternates: {
    canonical: 'https://www.cleaningprofessionals.com.au/feedback'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#fff' }}>{children}</body>
    </html>
  );
}
