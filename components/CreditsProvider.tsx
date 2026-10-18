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
  used: number;
  transactions: CreditTransaction[];
  loading: boolean;
  hasError: boolean;
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
  const [used, setUsed] = useState<number>(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const fetchCredits = useCallback(async () => {
    if (!user) {
      setBalance(0);
      setReceived(0);
      setUsed(0);
      setTransactions([]);
      setLoading(false);
      setHasError(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/credits', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        const leftVal =
          typeof data.left === 'number'
            ? data.left
            : typeof data.balance === 'number'
            ? data.balance
            : 0;
        const recVal =
          typeof data.received === 'number'
            ? data.received
            : typeof data.totalReceived === 'number'
            ? data.totalReceived
            : 0;
        const usedVal =
          typeof data.used === 'number'
            ? data.used
            : typeof data.totalSpent === 'number'
            ? data.totalSpent
            : 0;

        startTransition(() => {
          setBalance(leftVal);
          setReceived(recVal);
          setUsed(usedVal);
          setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
          setHasError(false);
        });
      } else {
        setHasError(true);
      }
    } catch (err) {
      console.warn('Failed to fetch credits:', err);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load once after login
  useEffect(() => {
    queueMicrotask(() => {
      fetchCredits();
    });
  }, [fetchCredits]);

  // Refresh when the browser tab regains focus
  useEffect(() => {
    if (!user) return;
    const handleFocus = () => {
      fetchCredits();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, fetchCredits]);

  // Fast direct update after generation response (creditsRemaining from response)
  const updateBalanceLocally = useCallback((creditsRemaining: number) => {
    if (typeof creditsRemaining === 'number') {
      setBalance(creditsRemaining);
      setHasError(false);
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
    spent: used,
    used,
    transactions,
    loading,
    hasError,
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
