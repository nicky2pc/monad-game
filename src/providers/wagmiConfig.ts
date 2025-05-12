import { http, createConfig } from 'wagmi';
import { farcasterFrame as miniAppConnector } from '@farcaster/frame-wagmi-connector';

const monadTestnet = {
  id: 10143, // Укажи ID сети Monad
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz	'] } },
  blockExplorers: { default: { name: 'MonadScan', url: 'https://testnet.monadexplorer.com' } },
};

export const config = createConfig({
  chains: [monadTestnet],
  transports: { [monadTestnet.id]: http() },
  connectors: [miniAppConnector()],
});




