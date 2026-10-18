'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { setActiveUserId } from '@/lib/storage';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfileName: (name: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isConfigured: false,
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfileName: async () => ({ success: false }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const isConfigured = isSupabaseConfigured();
  const [loading, setLoading] = useState(isConfigured);

  const fetchProfile = useCallback(async (currentUser: User) => {
    if (!isConfigured) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (data && !error) {
        setProfile({
          id: data.id,
          email: data.email || currentUser.email || '',
          display_name:
            data.display_name ||
            currentUser.user_metadata?.display_name ||
            currentUser.email?.split('@')[0] ||
            'Creator',
          avatar_url: data.avatar_url || null,
          updated_at: data.updated_at,
        });
      } else {
        // Fallback to user metadata
        const fallbackName =
          currentUser.user_metadata?.display_name ||
          currentUser.email?.split('@')[0] ||
          'Creator';
        setProfile({
          id: currentUser.id,
          email: currentUser.email || '',
          display_name: fallbackName,
        });
      }
    } catch (err) {
      console.warn('Failed to load user profile:', err);
      if (currentUser) {
        setProfile({
          id: currentUser.id,
          email: currentUser.email || '',
          display_name:
            currentUser.user_metadata?.display_name ||
            currentUser.email?.split('@')[0] ||
            'Creator',
        });
      }
    }
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const supabase = createClient();

    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setActiveUserId(currentUser ? currentUser.id : null);
      if (currentUser) {
        fetchProfile(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setActiveUserId(currentUser ? currentUser.id : null);

      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const isProtected =
          path.startsWith('/generator') ||
          path.startsWith('/adobe-analytics') ||
          path.startsWith('/tools') ||
          path.startsWith('/account');
        if (isProtected) {
          window.location.assign('/login');
        } else {
          router.refresh();
        }
      }

      if (event === 'INITIAL_SESSION' && !session) {
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const isPublic =
          path === '/login' ||
          path === '/signup' ||
          path === '/forgot-password' ||
          path === '/reset-password' ||
          path.startsWith('/auth/');
        if (isPublic) {
          // do nothing
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured, fetchProfile, router]);

  const signOut = useCallback(async () => {
    try {
      if (isConfigured) {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
      setUser(null);
      setProfile(null);
      setActiveUserId(null);
      toast.success('Signed out successfully');
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Sign out error:', err);
      toast.error('Failed to sign out');
    }
  }, [isConfigured, router]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  const updateProfileName = useCallback(
    async (newName: string) => {
      if (!user) return { success: false, error: 'Not authenticated' };
      const trimmed = newName.trim();
      if (!trimmed) return { success: false, error: 'Display name cannot be empty' };

      try {
        const supabase = createClient();
        // Update user metadata in Auth
        await supabase.auth.updateUser({
          data: { display_name: trimmed },
        });

        // Update profiles table
        const { error: dbError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            display_name: trimmed,
            email: user.email,
            updated_at: new Date().toISOString(),
          });

        if (dbError) {
          console.warn('Profile table upsert error:', dbError);
        }

        setProfile((prev) =>
          prev
            ? { ...prev, display_name: trimmed }
            : { id: user.id, email: user.email || '', display_name: trimmed }
        );

        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update name';
        return { success: false, error: msg };
      }
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isConfigured,
        signOut,
        refreshProfile,
        updateProfileName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
