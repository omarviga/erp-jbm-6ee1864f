// hooks/useSupabase.ts
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export const useSupabase = () => {
    useEffect(() => {
        if (import.meta.env.DEV) {
            console.log('🔄 useSupabase hook montado');
        }

        return () => {
            if (import.meta.env.DEV) {
                console.log('🔄 useSupabase hook desmontado');
            }
        };
    }, []);

    return { supabase };
};