// integrations/supabase/client.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 1. Leemos las variables usando import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// 2. IMPRIMIR EN CONSOLA (Esto es para debug, lo borras luego)
console.log("--- DEBUG SUPABASE ---")
console.log("URL:", supabaseUrl)
console.log("KEY:", supabaseKey ? "Cargada (Oculta)" : "UNDEFINED (ERROR AQUÍ)")

// 3. Validación de seguridad
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env')
}

// 4. Declarar tipos globales para TypeScript
declare global {
  interface Window {
    __supabaseTrack?: Array<{
      timestamp: string;
      url: string;
      instanceId: string;
    }>;
    __supabaseInstance?: SupabaseClient;
  }
}

// 5. Singleton para garantizar una sola instancia
let supabaseInstance: SupabaseClient | null = null;

const initSupabase = (): SupabaseClient => {
  if (supabaseInstance) {
    console.log('🔄 Usando instancia existente de Supabase');
    return supabaseInstance;
  }

  console.log('🚀 Creando nueva instancia de Supabase');

  supabaseInstance = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Añade un storageKey único
      storageKey: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,
      storage: typeof window !== 'undefined' ? localStorage : undefined,
    }
  });

  // Tracking en desarrollo
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    if (!window.__supabaseTrack) {
      window.__supabaseTrack = [];
    }
    window.__supabaseTrack.push({
      timestamp: new Date().toISOString(),
      url: supabaseUrl,
      instanceId: Math.random().toString(36).substr(2, 9)
    });

    // Guardar referencia global para debug
    window.__supabaseInstance = supabaseInstance;

    console.log('📊 Supabase instances track:', window.__supabaseTrack.length);

    // Mostrar warning si hay múltiples instancias
    if (window.__supabaseTrack.length > 1) {
      console.warn('⚠️ Se detectaron múltiples instancias de Supabase:', window.__supabaseTrack.length);
    }
  }

  return supabaseInstance;
};

// 6. Exportar la instancia única
export const supabase = initSupabase();

// 7. Función para debug
export const debugSupabase = () => {
  if (import.meta.env.DEV) {
    console.group('🔧 DEBUG SUPABASE');
    console.log('URL:', supabaseUrl);
    console.log('Instance:', supabaseInstance ? '✅ Creada' : '❌ No creada');
    console.log('Track count:', window.__supabaseTrack?.length || 0);

    if (window.__supabaseTrack && window.__supabaseTrack.length > 1) {
      console.warn('MÚLTIPLES INSTANCIAS DETECTADAS:');
      window.__supabaseTrack.forEach((track, index) => {
        console.log(`  ${index + 1}. ${track.timestamp} - ${track.instanceId}`);
      });
    }
    console.groupEnd();
  }
};

// 8. Función para limpiar tracking (opcional)
export const cleanupSupabaseTracking = () => {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    window.__supabaseTrack = [];
    console.log('🧹 Tracking de Supabase limpiado');
  }
};