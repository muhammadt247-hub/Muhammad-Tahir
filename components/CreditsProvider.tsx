'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useTransition } from 'react';
import { useAuth } from '@/components/AuthProvider';

export interface CreditTransaction {
  createdAt: string;
  amount: number;
  kind: string;
  reason: string;
}

export interface CreditsContextValue {
  balance: number;
  received: number;
  spent: number;
  transactions: CreditTransaction[];
  loading: boolean;
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  openDialog: () => void;
  refresh: () => Promise<void>;
  updateBalanceLocally: (creditsRemaining: number) => void;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [received, setReceived] = useState<number>(0);
  const [spent, setSpent] = useState<number>(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const fetchCredits = useCallback(async () => {
    if (!user) {
      setBalance(0);
      setReceived(0);
      setSpent(0);
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/credits', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        startTransition(() => {
          setBalance(typeof data.balance === 'number' ? data.balance : 0);
          setReceived(typeof data.totalReceived === 'number' ? data.totalReceived : 0);
          setSpent(typeof data.totalSpent === 'number' ? data.totalSpent : 0);
          setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
        });
      }
    } catch (err) {
      console.warn('Failed to fetch credits:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load once after login
  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchCredits();
    } else {
      setBalance(0);
      setReceived(0);
      setSpent(0);
      setTransactions([]);
      setLoading(false);
    }
  }, [user, fetchCredits]);

  // Refresh when the browser tab regains focus
  useEffect(() => {
    if (!user) return;
    const handleFocus = () => {
      fetchCredits();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, fetchCredits]);

  // Fast direct update after generation response (creditsRemaining from response, no extra request)
  const updateBalanceLocally = useCallback((creditsRemaining: number) => {
    if (typeof creditsRemaining === 'number') {
      setBalance(creditsRemaining);
    }
  }, []);

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
    // Refresh when credits dialog opens
    fetchCredits();
  }, [fetchCredits]);

  const value: CreditsContextValue = {
    balance,
    received,
    spent,
    transactions,
    loading,
    isDialogOpen,
    setIsDialogOpen,
    openDialog,
    refresh: fetchCredits,
    updateBalanceLocally,
  };

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

export function useCredits(): CreditsContextValue {
  const context = useContext(CreditsContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}
