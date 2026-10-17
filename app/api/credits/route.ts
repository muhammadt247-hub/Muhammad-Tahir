import { NextResponse } from 'next/server';
import { createClient, requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Please log in to view credits.' } },
      { status: 401 }
    );
  }

  const supabase = await createClient();

  let balance = 0;
  let totalReceived = 0;
  let totalSpent = 0;

  // 1. Call my_credit_summary() RPC using normal logged-in client
  try {
    const { data: summaryData, error: summaryError } = await supabase.rpc('my_credit_summary');
    if (!summaryError && summaryData && summaryData.length > 0) {
      const row = summaryData[0];
      balance = typeof row.balance === 'number' ? row.balance : Number(row.balance) || 0;
      totalReceived = typeof row.total_received === 'number' ? row.total_received : Number(row.total_received) || 0;
      totalSpent = typeof row.total_spent === 'number' ? row.total_spent : Number(row.total_spent) || 0;
    } else if (summaryError) {
      console.warn('my_credit_summary RPC error:', summaryError.message);
    }
  } catch (err) {
    console.warn('Failed to call my_credit_summary RPC:', err);
  }

  // 2. Read latest 10 rows of credit_transactions for the logged-in user
  let transactions: Array<{
    createdAt: string;
    amount: number;
    kind: string;
    reason: string;
  }> = [];

  try {
    const { data: txData, error: txError } = await supabase
      .from('credit_transactions')
      .select('created_at, amount, kind, reason')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!txError && Array.isArray(txData)) {
      transactions = txData.map((row) => ({
        createdAt: row.created_at || new Date().toISOString(),
        amount: typeof row.amount === 'number' ? row.amount : Number(row.amount) || 0,
        kind: row.kind || 'transaction',
        reason: row.reason || '',
      }));
    } else if (txError) {
      console.warn('credit_transactions query error:', txError.message);
    }
  } catch (err) {
    console.warn('Failed to query credit_transactions:', err);
  }

  return NextResponse.json({
    balance,
    totalReceived,
    totalSpent,
    transactions,
  });
}
