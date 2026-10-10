import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ansglvivcwqcmnrlmlkq.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_Key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuc2dsdml2Y3dxY21ucmxtbGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MzA1NzcsImV4cCI6MjEwNzIwNjU3N30.R8bLRXl7QFGeN3ambCPmsTHEfD1LYdnxrNgD-1ZS704'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
