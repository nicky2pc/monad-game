import { sdk } from '@farcaster/frame-sdk';
import { useEffect } from 'react';

import './App.css';
import Game from './components/Game/Game.tsx';
import { Providers } from './providers/Provider.tsx';
function App() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return (
    <div className="App">
      <Providers>
        <Game />
      </Providers>
    </div>
  );
}

export default App;