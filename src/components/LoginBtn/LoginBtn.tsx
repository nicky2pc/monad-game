import React, { useEffect, useState } from 'react';
import {usePrivy, useDelegatedActions, useWallets, type WalletWithMetadata,} from '@privy-io/react-auth';
import { faucet } from '../../game/utils.ts';
import { useTransactions } from '../../hooks/useTransactions.ts';
import { useBalance } from '../../hooks/useBalance.ts';

export default function LoginBtn() {
  const {ready, authenticated, login, isModalOpen, logout, exportWallet, user} = usePrivy();
  const {handleFaucet} = useTransactions();
  const {wallets} = useWallets();
  const [isLoading, setIsLoading] = useState(false);
  const { balance, updateBalance } = useBalance();

  const privyWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');

  const onFaucet = async () => {
    if (!privyWallet || !ready) return; 
    setIsLoading(true);
    
    try {
      await handleFaucet(privyWallet.address);
      
      setTimeout(async () => {
        await updateBalance(privyWallet);
        setIsLoading(false);
      }, 3000);
      
    } catch (error) {
      console.error("Faucet error in LoginBtn:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (privyWallet) {
      updateBalance(privyWallet);
    }
  }, [privyWallet]);

  const handleLogin = () => {
    if (authenticated) {
      logout();
    } else {
      login()
    }
  };


  return (
    <>
      <button className='login-btn' onClick={() => handleLogin()} disabled={!ready}>
      {authenticated ? 'Logout' : 'Login'}
    </button>
      {
        authenticated && (
       <>
           <button className='export-wallet-btn' onClick={() => exportWallet()}>
            Export Wallet
          </button>
          <button className='delegate-wallet-btn' disabled={!ready || !privyWallet || isLoading} onClick={onFaucet}>
            Faucet
          </button>
          <div className='balance-container'>
            <p>{balance} MON</p>
          </div>
       </>
        )
      }
    </>
  )
}
