'use client';

import { use } from 'react';
import TransactionDetail from './TransactionDetail';

interface PageProps {
  params: Promise<{ transactionId: string }>;
}

export default function TransactionDetailPage({ params }: PageProps) {
  const { transactionId } = use(params);
  return <TransactionDetail transactionId={transactionId} />;
}
