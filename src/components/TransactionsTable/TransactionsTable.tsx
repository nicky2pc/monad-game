import React, { useEffect, useRef } from 'react';
import { Transaction, TransactionsTableProps } from '../../types.ts';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useTransactions } from '../../hooks/useTransactions.ts';
import './TransactionsTable.css';

const TransactionsTable: React.FC<TransactionsTableProps> = ({ transactions, clearTransactions }) => {
  const prevTransactionsRef = useRef<Transaction[]>([]);
  const { logout } = usePrivy();
  const { handleFaucet } = useTransactions();
  const { wallets } = useWallets();

  const handleInteractiveLink = (e: React.MouseEvent<HTMLTableElement>) => {
    const target = e.target as HTMLElement;
    
    if (target.classList.contains('interactive-link')) {
      e.preventDefault();
      const action = target.getAttribute('data-action');
      
      if (action === 'logout') {
        logout();
      } else if (action === 'faucet') {
        const privyWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
        if (privyWallet) {
          handleFaucet(privyWallet.address);
        }
      }
    }
  };

  useEffect(() => {
    const prevTransactions = prevTransactionsRef.current;
    if (prevTransactions.length !== transactions.length) {
   
    } else {
      const changed = transactions.some((tx, index) => {
        const prevTx = prevTransactions[index];
        if (!prevTx) return true;
        
        const hasChanged = 
          tx.id !== prevTx.id ||
          tx.type !== prevTx.type ||
          tx.link !== prevTx.link ||
          tx.date !== prevTx.date ||
          tx.error !== prevTx.error;
        
        return hasChanged;
      });
      
    }
    
    prevTransactionsRef.current = [...transactions];
  }, [transactions]);

 

  const handleClearTransactions = () => {
    if (clearTransactions) {
      if (window.confirm('Are you sure you want to clear all transactions?')) {
        clearTransactions();
      }
    }
  };

  return (
    <div className="transactions">
      <div className="header">
        <h2>Transactions {transactions.length ? `(${transactions.length})` : null}</h2>
        {clearTransactions && transactions.length > 0 && (
          <button onClick={handleClearTransactions} className="clear-btn">
            Clear transactions
          </button>
        )}
      </div>
      {transactions.length ? (
        <div className="table-wrapper">
          <table className="transactions-table" onClick={handleInteractiveLink}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Link</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, index) => (
                <tr datatype={tx.type.split(" ")[0].replace(":", "")} key={`${tx.id}-${index}`}>
                  <td>{tx.type}</td>
                  <td>
                    {tx.error ? (
                      <span dangerouslySetInnerHTML={{ __html: tx.error }} />
                    ) : !tx.link || tx.link === "Pending..." || tx.link === "Not processed" ? (
                      <span>{tx.link}</span>
                    ) : (

                    tx.userAddress ? (
                      <span>Congrats, you <a href={tx.link} target="_blank" rel="noopener noreferrer">minted</a> 1 <a target="_blank" rel="noopener noreferrer" href={`https://magiceden.io/u/${tx.userAddress}?activeTab=%22allItems%22&chains=%5B%22monad-testnet%22%5D&wallets=%5B%22${tx.userAddress}%22%5D`}>Fire Molandak</a> </span>
                     
                    ) : (
                      <a href={tx.link} target="_blank" rel="noopener noreferrer">
                        {tx.link?.length > 60 ? tx.link?.slice(0, 60) + "..." : tx.link}
                      </a>
                    )
                    )}
                  </td>
                  <td>{new Date(tx.date).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <span className="regular">You have no transactions</span>
      )}
    </div>
  );
};

export default TransactionsTable; 