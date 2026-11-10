'use client';

import React from 'react';
import { usePOS } from '@/context/POSContext';
import { ThermalReceipt } from './ThermalReceipt';

export const ThermalReceiptContainer: React.FC = () => {
  const { currentOrderToPrint } = usePOS();

  if (!currentOrderToPrint) return null;

  return (
    <div className="hidden print:block">
      <ThermalReceipt order={currentOrderToPrint} />
    </div>
  );
};

