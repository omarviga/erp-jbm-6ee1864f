import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type NotificationType = 'info' | 'warning' | 'success' | 'error' | 'alert';
export type NotificationCategory = 'inventario' | 'transferencia' | 'venta' | 'corte_caja' | 'produccion' | 'sistema';

export interface Notificacion {
  id: string;
  user_id: string | null;
  tipo: NotificationType;
  categoria: NotificationCategory;
  titulo: string;
  mensaje: string;
  leida: boolean;
  referencia_id: string | null;
  referencia_tipo: string | null;
  created_at: string;
}

interface UseNotificacionesReturn {
  notificaciones: Notificacion[];
  noLeidas: number;
  isLoading: boolean;
  marcarComoLeida: (id: string) => Promise<void>;
  marcarTodasLeidas: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useNotificaciones(): UseNotificacionesReturn {
  const { user } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotificaciones = useCallback(async () => {
    if (!user) {
      setNotificaciones([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotificaciones((data as Notificacion[]) || []);
    } catch (error) {
      console.error('Error fetching notificaciones:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const marcarComoLeida = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotificaciones(prev =>
        prev.map(n => (n.id === id ? { ...n, leida: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user]);

  const marcarTodasLeidas = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('user_id', user.id)
        .eq('leida', false);

      if (error) throw error;

      setNotificaciones(prev =>
        prev.map(n => ({ ...n, leida: true }))
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user]);

  // Suscripción a notificaciones en tiempo real
  useEffect(() => {
    if (!user) return;

    fetchNotificaciones();

    const channel = supabase
      .channel('notificaciones-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
        },
        (payload: RealtimePostgresChangesPayload<Notificacion>) => {
          const newNotif = payload.new as Notificacion;
          
          // Solo mostrar si es para este usuario o es global
          if (newNotif.user_id === null || newNotif.user_id === user.id) {
            setNotificaciones(prev => [newNotif, ...prev]);
            
            // Mostrar toast según el tipo
            const toastMessage = `${newNotif.titulo}: ${newNotif.mensaje}`;
            switch (newNotif.tipo) {
              case 'success':
                toast.success(toastMessage);
                break;
              case 'error':
                toast.error(toastMessage);
                break;
              case 'warning':
                toast.warning(toastMessage);
                break;
              case 'alert':
                toast.error(toastMessage, { duration: 10000 });
                break;
              default:
                toast.info(toastMessage);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotificaciones]);

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  return {
    notificaciones,
    noLeidas,
    isLoading,
    marcarComoLeida,
    marcarTodasLeidas,
    refetch: fetchNotificaciones,
  };
}

// Función helper para crear notificaciones desde cualquier parte de la app
export async function crearNotificacion({
  userId,
  tipo = 'info',
  categoria = 'sistema',
  titulo,
  mensaje,
  referenciaId,
  referenciaTipo,
}: {
  userId?: string | null;
  tipo?: NotificationType;
  categoria?: NotificationCategory;
  titulo: string;
  mensaje: string;
  referenciaId?: string;
  referenciaTipo?: string;
}) {
  try {
    const { error } = await supabase.from('notificaciones').insert({
      user_id: userId ?? null,
      tipo,
      categoria,
      titulo,
      mensaje,
      referencia_id: referenciaId ?? null,
      referencia_tipo: referenciaTipo ?? null,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error };
  }
}
