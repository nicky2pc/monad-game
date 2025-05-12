import { useState, useEffect } from 'react';
import { CONFIG } from '../game/config.ts';
import { Transaction, UseTransactionsReturn, UpdateTransactionCallback, LeaderboardResponse } from '../types.ts';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';

const TRANSACTIONS_UPDATED_EVENT = 'transactions-updated';

const dispatchTransactionsUpdated = (transactions: Transaction[]) => {
  const event = new CustomEvent(TRANSACTIONS_UPDATED_EVENT, { detail: transactions });
  window.dispatchEvent(event);
};

let globalTransactions: Transaction[] = (() => {
  const savedTransactions = localStorage.getItem("transactions");
  if (!savedTransactions) return [];

  let parsedTransactions = JSON.parse(savedTransactions);

  parsedTransactions = parsedTransactions.map(tx => 
    (!tx.link || tx.link === "Pending...") ? { ...tx, link: "Not processed" } : tx
  );

  localStorage.setItem("transactions", JSON.stringify(parsedTransactions));
  return parsedTransactions;
})();

const updateGlobalTransactions = (newTransactions: Transaction[]) => {
  globalTransactions = newTransactions;
  localStorage.setItem("transactions", JSON.stringify(globalTransactions));
  dispatchTransactionsUpdated(globalTransactions);
};

export const useTransactions = (): UseTransactionsReturn => {
  const {wallets} = useWallets();
  const {authenticated, user} = usePrivy();
  const privyWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
  
  const [transactions, setTransactions] = useState<Transaction[]>(globalTransactions);

  useEffect(() => {
    const handleTransactionsUpdated = (event: CustomEvent<Transaction[]>) => {
      if (event.detail) {
        setTransactions([...event.detail]);
      } else {
        setTransactions([...globalTransactions]);
      }
    };

    window.addEventListener(TRANSACTIONS_UPDATED_EVENT, handleTransactionsUpdated as EventListener);
    
    setTransactions([...globalTransactions]);
    
    return () => {
      window.removeEventListener(TRANSACTIONS_UPDATED_EVENT, handleTransactionsUpdated as EventListener);
    };
  }, []);

  const updateTransactions = (transaction: Transaction, callback: UpdateTransactionCallback) => {
    const { id, type } = transaction;
    
    const updated = [transaction, ...globalTransactions];
    if (updated.length > CONFIG.MAX_TRANSACTIONS) {
      updated.length = CONFIG.MAX_TRANSACTIONS;
    }
    
    updateGlobalTransactions(updated);

    callback()
      .then((data) => {
        const updatedTransactions = globalTransactions.map(tx => {
          if (tx.id === id && tx.type === type) {
            if (tx.type === "Faucet") {
              if (data?.tx) {
                return {
                  ...tx,
                  type: `Faucet: ${data.mon} MON`,
                  link: `https://testnet.monadexplorer.com/tx/${data.tx}`,
                  date: Date.now(),
                  error: ""
                };
              } else if (data?.error) {
                const formatSeconds = (seconds: number) => {
                  const totalSeconds = Math.floor(seconds);
                  
                  if (totalSeconds >= 86400) {
                    const days = Math.floor(totalSeconds / 86400);
                    const hours = Math.floor((totalSeconds % 86400) / 3600);
                    return `${days}d ${hours}h`;
                  }
                  else if (totalSeconds >= 3600) {
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const remainingSeconds = totalSeconds % 60;
                    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
                  } else {
                    const minutes = Math.floor(totalSeconds / 60);
                    const remainingSeconds = totalSeconds % 60;
                    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
                  }
                };
                return {
                  ...tx,
                  link: "",
                  date: Date.now(),
                  error: data.error + (data?.deadline_seconds ? " " + formatSeconds(data?.deadline_seconds) + " left" : "")
                };
              }
            }
            
            return {
              ...tx,
              link: data?.url ?? tx.link,
              date: Date.now(),
              error: data?.error ?? tx.error
            };
          }
          return tx;
        });
        
        updateGlobalTransactions(updatedTransactions);
      })
      .catch(() => {
        const updatedTransactions = globalTransactions.map(tx =>
          tx.id === id && tx.type === type
            ? { ...tx, link: "", date: Date.now(), error: tx.error ? tx.error : "Unexpected error" }
            : tx
        );
        
        updateGlobalTransactions(updatedTransactions);
      });
  };

  const handleMint = (killCount: number) => {
    const transaction: Transaction = {
      id: Date.now(),
      type: `Mint: ${killCount}`,
      link: "Pending...",
      date: Date.now(),
      error: "",
      userAddress: privyWallet?.address || ""
    };

    updateTransactions(transaction, () => import('../game/utils.ts').then(m => m.mint(wallets, authenticated)));
  };

  const handleFaucet = async (address: string) => {
    const transaction: Transaction = {
      id: Date.now(),
      type: `Faucet`,
      link: "Pending...",
      date: Date.now(),
      error: ""
    };
    
    const updated = [transaction, ...globalTransactions];
    if (updated.length > CONFIG.MAX_TRANSACTIONS) {
      updated.length = CONFIG.MAX_TRANSACTIONS;
    }
    updateGlobalTransactions(updated);
    
    return new Promise<void>((resolve, reject) => {
      import('../game/utils.ts')
        .then(utils => {
          return utils.faucet(address);
        })
        .then(data => {
          
          const currentTransactions = [...globalTransactions];
          
          const updatedTransactions = currentTransactions.map(tx => {
            if (tx.id === transaction.id && tx.type === transaction.type) {
              
              if (data && 'mon' in data) {
                if (data.tx) {
                  const updatedTx = {
                    ...tx,
                    type: `Faucet: ${data.mon} MON`,
                    link: `https://testnet.monadexplorer.com/tx/0x${data.tx}`,
                    date: Date.now(),
                    error: ""
                  };
                  return updatedTx;
                } 
                else {
                  const updatedTx = {
                    ...tx,
                    type: `Faucet: ${data.mon} MON`,
                    link: "",
                    date: Date.now(),
                    error: "No transaction hash was returned."
                  };
                  return updatedTx;
                }
              } else if (data?.error || data.deadline_seconds) {
                const formatSeconds = (seconds: number) => {
                  if (!seconds) return "";
                  const totalSeconds = Math.floor(seconds);
                  
                  if (totalSeconds >= 86400) {
                    const days = Math.floor(totalSeconds / 86400);
                    const hours = Math.floor((totalSeconds % 86400) / 3600);
                    return `${days}d ${hours}h`;
                  }
                  else if (totalSeconds >= 3600) {
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const remainingSeconds = totalSeconds % 60;
                    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
                  } else {
                    const minutes = Math.floor(totalSeconds / 60);
                    const remainingSeconds = totalSeconds % 60;
                    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
                  }
                };
                
                const updatedTx = {
                  ...tx,
                  link: "",
                  date: Date.now(),
                  error: data.error + (data.deadline_seconds ? " " + formatSeconds(data.deadline_seconds) + " left" : "")
                };
                return updatedTx;
              }
            }
            return tx;
          });
          
          
          updateGlobalTransactions(updatedTransactions);
          
          dispatchTransactionsUpdated(updatedTransactions);
          
          resolve();
        })
        .catch(error => {
          console.error("Faucet API error:", error);
          
          const currentTransactions = [...globalTransactions];
          
          const updatedTransactions = currentTransactions.map(tx =>
            tx.id === transaction.id && tx.type === transaction.type
              ? { ...tx, link: "", date: Date.now(), error: "Unexpected error: " + (error?.message || String(error)) }
              : tx
          );
          
          updateGlobalTransactions(updatedTransactions);
          
          dispatchTransactionsUpdated(updatedTransactions);
          
          resolve();
        });
    });
  };

  const handleTotalScore = (score: number, isDead = false) => {
    const transaction: Transaction = {
      id: Date.now(),
      type: isDead ? `Death: ${score}` : `Kill: ${score}`,
      link: "Pending...",
      date: Date.now(),
      error: ""
    };

    updateTransactions(transaction, () => {
      if ( authenticated ) {
        return import('../game/utils.ts').then(m => m.sendTransaction(score, wallets, authenticated, isDead, user))
      } else {
        return import('../game/utils.ts').then(m => m.sendTransactionAsGuest({score, isDead}))
      }
    });
  };

  const clearTransactions = () => {
    updateGlobalTransactions([]);
  };

  return {
    transactions,
    handleMint,
    handleTotalScore,
    handleFaucet,
    clearTransactions
  };
}; 