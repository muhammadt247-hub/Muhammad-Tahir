import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) {
    return user;
  }
  if (!user || !user.id) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Please log in to view credits.' } },
      { status: 401 }
    );
  }

  const admin = getAdminClient();

  // 1. Read balance from credit_wallets for user.id
  let left = 0;
  try {
    const { data: walletData, error: walletError } = await admin
      .from('credit_wallets')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    if (walletError) {
      console.error('Failed to read credit_wallets:', walletError);
      return NextResponse.json(
        { error: { code: 'credits_unavailable', message: 'Failed to read credit balance.' } },
        { status: 500 }
      );
    }

    if (walletData && typeof walletData.balance === 'number') {
      left = walletData.balance;
    }
  } catch (err) {
    console.error('Failed to query credit_wallets:', err);
    return NextResponse.json(
      { error: { code: 'credits_unavailable', message: 'Failed to query credit_wallets.' } },
      { status: 500 }
    );
  }

  // 2. Read rows from credit_transactions for user.id
  let received = 0;
  let used = 0;
  let transactions: Array<{
    createdAt: string;
    amount: number;
    kind: string;
    reason: string;
  }> = [];

  try {
    const { data: txRows, error: txError } = await admin
      .from('credit_transactions')
      .select('created_at, amount, kind, reason')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('Failed to read credit_transactions:', txError);
      return NextResponse.json(
        { error: { code: 'credits_unavailable', message: 'Failed to read credit transactions.' } },
        { status: 500 }
      );
    }

    const allRows = txRows || [];

    for (const row of allRows) {
      const amt = typeof row.amount === 'number' ? row.amount : Number(row.amount) || 0;
      const kind = (row.kind || '').toLowerCase();
      if (kind === 'bonus' || kind === 'grant') {
        received += amt;
      }
    }

    // used = max(0, received - left)
    used = Math.max(0, received - left);

    // Latest 10 transactions
    transactions = allRows.slice(0, 10).map((row) => ({
      createdAt: row.created_at || new Date().toISOString(),
      amount: typeof row.amount === 'number' ? row.amount : Number(row.amount) || 0,
      kind: row.kind || 'transaction',
      reason: row.reason || '',
    }));
  } catch (err) {
    console.error('Failed to query credit_transactions:', err);
    return NextResponse.json(
      { error: { code: 'credits_unavailable', message: 'Failed to query credit transactions.' } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    left,
    balance: left,
    received,
    totalReceived: received,
    used,
    totalSpent: used,
    transactions,
  });
}
