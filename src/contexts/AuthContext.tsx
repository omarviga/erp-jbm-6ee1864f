/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRoles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user roles from database
  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }

      return data?.map(r => r.role) || [];
    } catch (err) {
      console.error('Error fetching roles:', err);
      return [];
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Fetch roles with retry for RLS timing issues
    const fetchRolesWithRetry = async (userId: string, retries = 3): Promise<AppRole[]> => {
      for (let attempt = 0; attempt < retries; attempt++) {
        const roles = await fetchUserRoles(userId);
        if (roles.length > 0 || attempt === retries - 1) {
          return roles;
        }
        // Small delay before retry to allow RLS policies to propagate
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      return [];
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch roles when user logs in - use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            if (!isMounted) return;
            const roles = await fetchRolesWithRetry(session.user.id);
            if (isMounted) {
              setUserRoles(roles);
              setLoading(false);
            }
          }, 0);
        } else {
          setUserRoles([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const roles = await fetchRolesWithRetry(session.user.id);
        if (isMounted) {
          setUserRoles(roles);
        }
      }
      
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRoles([]);
  };

  const hasRole = (role: AppRole): boolean => {
    return userRoles.includes(role) || userRoles.includes('admin');
  };

  const isAdmin = userRoles.includes('admin');

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        userRoles,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
