import 'server-only';
import { getAdminClient } from '@/lib/supabase/admin';

export class InsufficientCreditsError extends Error {
  readonly code = 'insufficient_credits';
  readonly balance: number;
  readonly needed: number;

  constructor(balance: number, needed: number, message = 'You do not have enough credits.') {
    super(message);
    this.name = 'InsufficientCreditsError';
    this.balance = balance;
    this.needed = needed;
  }
}

export async function getBalance(userId: string): Promise<number> {
  const admin = getAdminClient();

  // 1. Try get_balance RPC if available
  try {
    const { data, error } = await admin.rpc('get_balance', { p_user: userId });
    if (!error && typeof data === 'number') {
      return data;
    }
  } catch {
    // Ignore RPC missing error
  }

  // 2. Query credit_wallets table directly
  try {
    const { data: walletByUser, error: errUser } = await admin
      .from('credit_wallets')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (!errUser && walletByUser && typeof walletByUser.balance === 'number') {
      return walletByUser.balance;
    }

    const { data: walletById, error: errId } = await admin
      .from('credit_wallets')
      .select('balance')
      .eq('id', userId)
      .maybeSingle();

    if (!errId && walletById && typeof walletById.balance === 'number') {
      return walletById.balance;
    }
  } catch (err) {
    console.warn('Failed to query credit balance:', err);
  }

  return 0;
}

export async function spendCredits(
  userId: string,
  amount: number,
  reason: string,
  ref: string
): Promise<number> {
  if (amount <= 0) {
    return await getBalance(userId);
  }

  const admin = getAdminClient();
  const { data, error } = await admin.rpc('spend_credits', {
    p_user: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref: ref,
  });

  if (error) {
    const errorMsg = (error.message || '').toLowerCase();
    const errorDetails = (error.details || '').toLowerCase();
    const errorHint = ((error as { hint?: string }).hint || '').toLowerCase();
    if (
      errorMsg.includes('insufficient_credits') ||
      errorDetails.includes('insufficient_credits') ||
      errorHint.includes('insufficient_credits')
    ) {
      const currentBalance = await getBalance(userId);
      throw new InsufficientCreditsError(currentBalance, amount);
    }
    throw new Error(`Failed to spend credits: ${error.message}`);
  }

  return typeof data === 'number' ? data : Number(data) || 0;
}

export async function refundCredits(
  userId: string,
  amount: number,
  reason: string,
  ref: string
): Promise<number> {
  if (amount <= 0) {
    return await getBalance(userId);
  }

  const admin = getAdminClient();
  const { data, error } = await admin.rpc('refund_credits', {
    p_user: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref: ref,
  });

  if (error) {
    console.error('Failed to refund credits:', error);
    throw new Error(`Failed to refund credits: ${error.message}`);
  }

  return typeof data === 'number' ? data : Number(data) || 0;
}

export interface CreditSummary {
  balance: number;
  totalReceived: number;
  totalSpent: number;
}

