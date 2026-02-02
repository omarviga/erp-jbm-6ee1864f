import { createClient } from '@supabase/supabase-js'

// 1. Leemos las variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 2. ⚠️ DEBUGGING: Esto te dirá la verdad en la consola del navegador
console.log("--- CONFIGURACIÓN SUPABASE ---")
console.log("URL detectada:", supabaseUrl ? supabaseUrl : "❌ VACÍA (Undefined)")
console.log("Key detectada:", supabaseAnonKey ? "✅ CARGADA (Oculta)" : "❌ VACÍA (Undefined)")

// 3. Validación de seguridad para evitar que la app explote sin aviso
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '🛑 ERROR FATAL: Faltan las variables de entorno. \n' +
    'Asegúrate de tener el archivo .env en la RAÍZ del proyecto y reiniciar la terminal.'
  )
}

// 4. Crear el cliente solo si todo está bien
export const supabase = createClient(supabaseUrl, supabaseAnonKey)