export type Database = {
  public: {
    Tables: {
      bookings: {
        Row: {
          id: string
          booking_number: string
          customer_id: string
          service_type: string
          status: string
          total_price: number
          location: {
            address: string
            suburb: string
            state: string
            postcode: string
            country: string
          }
          scheduling: {
            date: string
            time: string
            duration: number
            notes?: string
          }
          created_at: string
          updated_at: string
        }
      }
      customers: {
        Row: {
          id: string
          booking_id: string
          first_name: string
          last_name: string
          email: string | null
          phone: string
          address: {
            street: string
            suburb: string
            state: string
            postcode: string
            country: string
          }
          scheduling: {
            preferred_time?: string
            preferred_days?: string[]
            notes?: string
          }
          created_at: string
          updated_at: string
        }
      }
      feedback: {
        Row: {
          id: string
          booking_number: string
          feedback_option: string
          rating: number
          feedback: string
          name: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_number: string
          feedback_option: string
          rating: number
          feedback: string
          name: string
          email: string
          created_at?: string
          updated_at?: string
        }
      }
      google_review_intents: {
        Row: {
          id: string
          customer_name: string
          customer_email: string
          rating: number
          review_text: string
          completed_locations: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_name: string
          customer_email: string
          rating: number
          review_text: string
          completed_locations?: string[]
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 