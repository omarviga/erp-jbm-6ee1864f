import { createClient } from '@supabase/supabase-js'

// 1. Leemos las variables usando import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 2. IMPRIMIR EN CONSOLA (Esto es para debug, lo borras luego)
console.log("--- DEBUG SUPABASE ---")
console.log("URL:", supabaseUrl)
console.log("KEY:", supabaseKey ? "Cargada (Oculta)" : "UNDEFINED (ERROR AQUÍ)")

// 3. Validación de seguridad
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey)