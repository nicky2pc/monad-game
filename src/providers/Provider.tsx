import React from 'react';
import { ProvidersProps } from '../types.ts';
import { FrameMultiplierProvider } from './FrameMultiplierProvider.tsx';
import PrivyWalletProvider from './PrivyWalletProvider.tsx';
export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <PrivyWalletProvider>
      <FrameMultiplierProvider>
        {children}
      </FrameMultiplierProvider>
    </PrivyWalletProvider>
  );
};

export default Providers; 