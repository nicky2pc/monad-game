import React, { useState, useRef, useEffect } from 'react';
import { CONFIG } from '../../game/config.ts';
import { Mondalak } from '../../game/classes/Mondalak.ts';
import { Bullet } from '../../game/classes/Bullet.ts';
import { GameState } from '../../types.ts';
import { Enemy } from '../../game/classes/Enemy.ts';
import { Heart } from '../../game/classes/Heart.ts';
import { Buff } from '../../game/classes/Heart.ts';
import createEnemy from '../../game/createEnemy.ts';
import { loadSounds, playRandomSound, playSound, getLeaderBoard, getAuthLeaderBoard } from '../../game/utils.ts';
import { useFrameMultiplier } from '../../providers/FrameMultiplierProvider.tsx';
import { useTransactions } from '../../hooks/useTransactions.ts';
import { useBalance } from '../../hooks/useBalance.ts';
import LeaderboardPopup from '../LeaderboardPopup/LeaderboardPopup.tsx';
import TransactionsTable from '../TransactionsTable/TransactionsTable.tsx';
import GameUI from '../GameUI/GameUI.tsx';
import LoginBtn from '../LoginBtn/LoginBtn.tsx';
import {usePrivy, useWallets} from '@privy-io/react-auth';
const Game = () => {

  const {authenticated, ready, login, user} = usePrivy();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const explosions = useRef<{ x: number; y: number; frame: number, width: number, height: number }[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const playerTank = useRef<Mondalak | null>(null);
  const bullets = useRef<Bullet[]>([]);
  const isDead = useRef<boolean>(false);
  const audioPool = useRef<HTMLAudioElement[]>([]);
  const hearts = useRef<Heart[]>([]);
  const buffs = useRef<Buff[]>([]);
  const killCountRef = useRef<number>(0);
  const totalScoreRef = useRef<number>(0);
  const countdownRef = useRef<boolean>(false);
  const isSoundOn = useRef<boolean>(true);
  const buffTimerRef = useRef<NodeJS.Timeout | null>(null);
  const frameMultiplier = useFrameMultiplier(); 
  const { transactions, handleMint, handleTotalScore, clearTransactions, handleFaucet } = useTransactions();
  const {wallets} = useWallets();
  const {balance, updateBalance} = useBalance();
  
  type ImageCache = {
    enemies: {
      [key: string]: HTMLImageElement;
    }
    fire: {
      [key: string]: HTMLImageElement;
    }
    player: {
      [key: string]: HTMLImageElement;
    };
  };
  
  const imageCache = {
    enemies: {},  
    fire: {},
    player: {}
  } as ImageCache;

  const imageCacheRef = useRef<ImageCache>({
    enemies: {},
    fire: {},
    player: {},
  });  
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [sounds, setSounds] = useState<{ [key: string]: HTMLAudioElement[] } | null>(null);
  const [soundBtnLabelOn, setSoundBtnLabelOn] = useState(true);
  const [volume, setVolume] = useState(100);
  const volumeRef = useRef<number>(100);
  const [countdownValue, setCountdownValue] = useState<number>(3);
  const [buffTimerValue, setBuffTimerValue] = useState<number>(0);
  const [isStartButtonDisabled, setIsStartButtonDisabled] = useState(true);
  const [gameStat, setGameStat] = useState({
    totalScore: 0,
    killCount: 0,
    fireMondalakKillKount: 0,
    damageTaken: 0,
    damageGiven: 0,
    healsUsed: 0,
    buffsTaken: 0
  });

  useEffect(()=> {
    if (user) {
      console.log(user);
    }
  }, [user])

  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  const [showFaucetModal, setShowFaucetModal] = useState(false);

  const updateGameStat = (
    key: keyof typeof gameStat,
    value: number | ((prev: number) => number)
  ) => {
    setGameStat(prev => ({
      ...prev,
      [key]: typeof value === "function" ? (value as (prev: number) => number)(prev[key]) : value
    }));
  };

  const [explosionFrames, setExplosionFrames] = useState<HTMLImageElement[]>([]);

  const [isMobile, setIsMobile] = useState(false);

  const bulletPoolRef = useRef<Bullet[]>([]);
  
  const isUnsupportedBrowser = () => {
    const ua = navigator.userAgent.toLowerCase();
    return (
      (ua.includes("firefox")) ||
      (ua.includes("safari") && !ua.includes("chrome")) ||
      (ua.includes("edg/") && !ua.includes("chrome")) ||  
      ua.includes("tor") 
    );
  };

  const startCountdown = () => {
    setGameState('countdown');
    countdownRef.current = true;
    setCountdownValue(3);

    let counter = 3;
    const countdownInterval = setInterval(() => {
      counter--;
      setCountdownValue(counter);

      if (counter <= 0) {
        clearInterval(countdownInterval);
        countdownRef.current = false;
        setGameState('playing');
      }
    }, 1000);
  };

  const startBuffTimer = (number: number, playerTank: React.RefObject<{ isBuffed: boolean }>) => {
    if (!playerTank.current || gameState !== "playing") return;

    setBuffTimerValue(number);
    playerTank.current.isBuffed = true;

    if (buffTimerRef.current) {
      clearInterval(buffTimerRef.current);
    }

    let counter = number;

    const buffCountDown = setInterval(() => {
      counter--;
      setBuffTimerValue(counter);

      if (counter <= 0) {
        clearInterval(buffCountDown);
        buffTimerRef.current = null;
        if (playerTank.current) {
          playerTank.current.isBuffed = false;
        }
      }
    }, 1000);

    buffTimerRef.current = buffCountDown;
  };

  const preloadImages = async () => {
    const imageCacheEnemies = {
      "default": [
        "/chars/10.svg",
        "/chars/11.svg",
        "/chars/12.svg",
        "/chars/13.svg",
        "/chars/14.svg",
      ],
    };
    const imageCacheFire = {
      "fire": ["/chars/8.svg"]
    };
  
    const imageCachePlayer = {
      "main": ["/chars/15.svg"]
    };
  
    const loadImage = (src: string) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
      });
    };
  
    const enemyImages = await Promise.all(
      Object.entries(imageCacheEnemies).flatMap(([key, srcList]) =>
        srcList.map(async (src, index) => {
          const img = await loadImage(src);
          imageCache.enemies[index] = img;
        })
      )
    );

    const enemyFireImages = await Promise.all(
      Object.entries(imageCacheFire).flatMap(([key, srcList]) =>
        srcList.map(async (src, index) => {
          const img = await loadImage(src);
          imageCache.fire[index] = img;
        })
      )
    );
  
    const playerImages = await Promise.all(
      Object.entries(imageCachePlayer).flatMap(([key, srcList]) =>
        srcList.map(async (src, index) => {
          const img = await loadImage(src);
          imageCache.player[index] =  img;
        })
      )
    );
  
    const explosionFramesArr = await Promise.all(
      Array.from({ length: 151 - 16 + 1 }, (_, i) => 16 + i).map(async (i) => {
        const img = await loadImage(`/explotion/frame(${i}).png`);
        return img;
      })
    );
  
    setExplosionFrames(explosionFramesArr);
    imageCacheRef.current = imageCache;
  };

  const toggleSound = () => {
    setSoundBtnLabelOn(!isSoundOn.current)
    isSoundOn.current = !isSoundOn.current;
  };

  const resetGameObjects = () => {
    playerTank.current = new Mondalak(
      canvasRef.current!.width / 2,
      canvasRef.current!.width / 2,
      true,
      CONFIG.BULLET_SPEED,
      CONFIG.FIRE_RATE,
      "#c005c7",
      "main",
      imageCacheRef.current.player[0]
    );

    bullets.current = [];
    hearts.current = [];
    buffs.current = [];
    buffTimerRef.current = null;

    updateGameStat("killCount", 0);
    updateGameStat("fireMondalakKillKount", 0);
    updateGameStat("damageTaken", 0);
    updateGameStat("damageGiven", 0);
    updateGameStat("totalScore", 0);
    updateGameStat("healsUsed", 0);
    updateGameStat("buffsTaken", 0);

    setBuffTimerValue(0);
    killCountRef.current = 0;
    totalScoreRef.current = 0;

    isDead.current = false;
    audioPool.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    audioPool.current = [];

    if (gameState === "countdown") {
      enemies.current = [];
      spawnEnemies(0);
    }

    if (bulletPoolRef.current.length === 0) {
      for (let i = 0; i < 50; i++) {
        bulletPoolRef.current.push(new Bullet(0, 0, 0, 0, '', 0, false, 0, ''));
      }
    }
  };

  const spawnEnemies = (killCount) => {
    if (!killCount) {
      createEnemy(enemies.current, 1, true, "default", frameMultiplier, imageCacheRef.current);
      return;
    }

    const maxEnemiesAllowed = Math.min(CONFIG.MAX_ENEMIES_BEGINNING + Math.floor(killCount / 10), CONFIG.MAX_ENEMIES);

    if (enemies.current.length < maxEnemiesAllowed) {
      const enemiesToSpawn = maxEnemiesAllowed - enemies.current.length;

      for (let i = 0; i < enemiesToSpawn; i++) {
        const spawnDelay = 150 + Math.random() * (430 - 150);
        setTimeout(() => {
          if (enemies.current.length < maxEnemiesAllowed) {
            const enemyType = Math.random() < 0.05 ? "fire" : "default";
            const difficulty = Math.min(Math.floor(killCount / 10), 10);
            const adjustedDifficulty = enemyType === "fire" ? difficulty * 10 : difficulty;
            enemies.current = createEnemy(enemies.current, adjustedDifficulty, false, enemyType, frameMultiplier, imageCacheRef.current);
          }
        }, spawnDelay);
      }
    }
  };

  const handleStopGame = async () => {
    const totalScore = totalScoreRef.current;
    handleTotalScore(totalScore, true);
    setGameState("gameover");

    if (authenticated && wallets.length > 0) {
      const privyWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
      if (privyWallet) {
        setTimeout(async () => {
          await updateBalance(privyWallet);
        }, 1000);
      }
    }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1100px)");

    const handleResize = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleResize);
    return () => mediaQuery.removeEventListener("change", handleResize);
  }, []);

  useEffect(() => {
      loadSounds().then(loadedSounds => {
        Object.values(loadedSounds).forEach(categoryAudios => {
          categoryAudios.forEach(audio => {
            audio.volume = (volumeRef.current / 100) * 0.10;
          });
        });
        setSounds(loadedSounds);
      });
      
      preloadImages().then(() => {
        setAssetsLoaded(true);
      });
      
      setTimeout(() => {
        setIsStartButtonDisabled(false);
      }, 1000);
  }, []);

  useEffect(() => {
    if (gameState === "playing" || gameState === "countdown") {
      if ( assetsLoaded ) {
        resetGameObjects();
      } else {
        preloadImages().then(() => {
          setAssetsLoaded(true);
          resetGameObjects();
        });
      }

    } else {
      playerTank.current = null;
      enemies.current = [];
      bullets.current = [];
    }

  }, [gameState]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    canvasRef.current.width = CONFIG.CANVAS_WIDTH;
    canvasRef.current.height = CONFIG.CANVAS_HEIGHT;

    const keys = { w: false, a: false, s: false, d: false };
    const mouse = { x: 0, y: 0, shooting: false };

    const keyHandler = (e: KeyboardEvent, isKeyDown: boolean) => {
      switch (e.key.toLowerCase()) {
        case 'w': case 'ц': keys.w = isKeyDown; break;
        case 'a': case 'ф': keys.a = isKeyDown; break;
        case 's': case 'ы': case "і": keys.s = isKeyDown; break;
        case 'd': case 'в': keys.d = isKeyDown; break;
      }
    };

    const getScale = () => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return rect.width / CONFIG.CANVAS_WIDTH;
    };

    const mouseMoveHandler = (e: MouseEvent) => {
      const scale = getScale();

      const rect = canvasRef.current!.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) / scale;
      mouse.y = (e.clientY - rect.top) / scale;
    };

    const killEnemy = (enemy, enemyIndex) => {
      explosions.current.push({ x: enemy.x, y: enemy.y, frame: 16, width: 100, height: 96 });
      enemies.current.splice(enemyIndex, 1);

      setGameStat(prev => {
        const newKillCount = prev.killCount + 1;
        killCountRef.current = newKillCount;
        totalScoreRef.current = prev.totalScore + (enemy.type === "fire" ? 3 : 1);
        spawnEnemies(newKillCount);
        
        return {
          ...prev,
          totalScore: prev.totalScore + (enemy.type === "fire" ? 3 : 1),
          killCount: newKillCount,
          fireMondalakKillKount: enemy.type === "fire" ? prev.fireMondalakKillKount + 1 : prev.fireMondalakKillKount
        };
      });
      setTimeout(() => {
        const totalScore = totalScoreRef.current;
        handleTotalScore(totalScore, false);
      }, 0);

      if (enemy.type === "fire" && authenticated) {
        setTimeout(() => {
          const totalScore = totalScoreRef.current;
          handleMint(totalScore);
        }, 0);
      } 

      audioPool.current = playRandomSound(sounds, "kill", isSoundOn.current, audioPool.current, volumeRef.current);
    };

    const updateGameState = () => {
      if (!playerTank.current || !canvasRef.current) return;

      let newX = playerTank.current.x;
      let newY = playerTank.current.y;

      if (keys.w) newY -= playerTank.current.speed * frameMultiplier;
      if (keys.s) newY += playerTank.current.speed * frameMultiplier;
      if (keys.a) newX -= playerTank.current.speed * frameMultiplier;
      if (keys.d) newX += playerTank.current.speed * frameMultiplier;

      newX = Math.max(45, Math.min(canvasRef.current!.width - 45, newX));
      newY = Math.max(45, Math.min(canvasRef.current!.height - 45, newY));

      playerTank.current.updatePosition(newX, newY);

      const dx = mouse.x - playerTank.current.x;
      const dy = mouse.y - playerTank.current.y;
      playerTank.current.angle = Math.atan2(dy, dx);

      if (mouse.shooting && Date.now() - playerTank.current.lastShot > CONFIG.FIRE_RATE) {

        const barrelEndX = playerTank.current.x + Math.cos(playerTank.current.angle) * playerTank.current.barrelSize;
        const barrelEndY = playerTank.current.y + Math.sin(playerTank.current.angle) * playerTank.current.barrelSize;

        const audioPoolNew: HTMLAudioElement[] = playSound("/sound/shoot/shooooot.mp3", isSoundOn.current, audioPool.current, volumeRef.current - 4);

        audioPool.current = audioPoolNew;

        const bullet = new Bullet(
          barrelEndX,
          barrelEndY,
          playerTank.current.angle,
          playerTank.current.bulletSpeed * frameMultiplier,
          playerTank.current.bulletColor,
          playerTank.current.isBuffed ? 18 : 7,
          playerTank.current.isPlayer,
          playerTank.current.isBuffed ? 2 : 1,
          "player"
        );
        bullets.current.push(bullet);
        playerTank.current.lastShot = Date.now();
      }

      bullets.current = bullets.current.filter(bullet => !bullet.isExpired);
      bullets.current.forEach(bullet => bullet.update());

      bullets.current.forEach((bullet, bulletIndex) => {
        if (playerTank.current && !bullet.isExpired) {
          const dx = playerTank.current.x - bullet.x;
          const dy = playerTank.current.y - bullet.y;
          if (Math.sqrt(dx * dx + dy * dy) < 35) {
            const dead = playerTank.current.takeDamage(bullet.damage);

            bullets.current.splice(bulletIndex, 1);
            updateGameStat("damageTaken", prev => prev + bullet.damage);
            if (dead && !isDead.current) {
              const totalScore = totalScoreRef.current;
              handleTotalScore(totalScore, true);

              isDead.current = true;
              explosions.current.push({ x: playerTank.current.x, y: playerTank.current.y, frame: 16, width: 400, height: 395 });

              playRandomSound(sounds, "death", isSoundOn.current, audioPool.current, volumeRef.current);

              
              setTimeout(() => {
                setGameState("gameover");
              }, 1000);
            } else {
              const audioPoolNew: HTMLAudioElement[] = playSound("/sound/applepay.mp3", isSoundOn.current, audioPool.current, volumeRef.current - 10);
              audioPool.current = audioPoolNew;
            }
          }
        }

        enemies.current.forEach((enemy, enemyIndex) => {
          if (bullet.isPlayer) {
            const dx = enemy.x - bullet.x;
            const dy = enemy.y - bullet.y;
            if (Math.sqrt(dx * dx + dy * dy) < (enemy.width / 2)) {
              const result = enemy.takeDamage(bullet.damage);
              bullets.current.splice(bulletIndex, 1);
              updateGameStat("damageGiven", prev => prev + bullet.damage);
              
              switch (result) {
                case "drop_heart":
                  hearts.current.push(new Heart(
                    enemy.x,
                    enemy.y
                  ))

                  killEnemy(enemy, enemyIndex);
                  return;
                case "drop_buff":
                  buffs.current.push(new Buff(
                    enemy.x,
                    enemy.y
                  ))

                  killEnemy(enemy, enemyIndex);
                  return;
                case false:
                  const pool = playRandomSound(sounds, "hit", isSoundOn.current, audioPool.current, volumeRef.current);
                  audioPool.current = pool;
                  return;
              }
            }
          }
        });

      });
      hearts.current.forEach((heart, heartIndex) => {
        if (playerTank.current) {
          const dx = playerTank.current.x - heart.x;
          const dy = playerTank.current.y - heart.y;

          if (Math.sqrt(dx * dx + dy * dy) < (playerTank.current.width / 2) && playerTank.current.health < playerTank.current.maxHealth) {
            hearts.current.splice(heartIndex, 1);
            const audioPoolNew: HTMLAudioElement[] = playSound("/sound/heal.mp3", isSoundOn.current, audioPool.current, volumeRef.current);

            audioPool.current = audioPoolNew;
            playerTank.current.heal();
            updateGameStat("healsUsed", prev => prev + 1);

          }

          const expired = heart.isExpired();
          if (expired) {
            hearts.current.splice(heartIndex, 1);
          }
        }
      })

      buffs.current.forEach((buff, buffIndex) => {
        if (playerTank.current) {
          const dx = playerTank.current.x - buff.x;
          const dy = playerTank.current.y - buff.y;

          if (Math.sqrt(dx * dx + dy * dy) < (playerTank.current.width / 2)) {
            buffs.current.splice(buffIndex, 1);
            const audioPoolNew: HTMLAudioElement[] = playSound("/sound/heal.mp3", isSoundOn.current, audioPool.current, volumeRef.current);

            audioPool.current = audioPoolNew;
            playerTank.current.isBuffed = true;
            startBuffTimer(10, playerTank);
            updateGameStat("buffsTaken", prev => prev + 1);

          }

          const expired = buff.isExpired();
          if (expired) {
            buffs.current.splice(buffIndex, 1);
          }
        }
      })

      enemies.current.forEach(enemy => {
        const bullet = enemy.updateAI(playerTank.current!.x, playerTank.current!.y);
        if (bullet) {
          bullets.current.push(bullet);
        }
      });
   

      if (killCountRef.current > 10) {
        playerTank.current.maxHealth = 8
      }
    };

    const gameLoop = () => {
      if (!playerTank.current) return;
      
      ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
      ctx.fillStyle = '#ffccff';
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
      
      const drawMap = (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = '#800080';
        for (let y = 0; y < CONFIG.MAP.length; y++) {
          for (let x = 0; x < CONFIG.MAP[y].length; x++) {
            if (CONFIG.MAP[y][x] === 1) {
              ctx.fillRect(
                x * CONFIG.CELL_SIZE,
                y * CONFIG.CELL_SIZE,
                CONFIG.CELL_SIZE - 1,
                CONFIG.CELL_SIZE - 1
              );
            }
          }
        }
      };

      drawMap(ctx);

      if (gameState === "playing") {
        updateGameState();
      }

      playerTank.current.draw(ctx, isDead.current);

      enemies.current.forEach(enemy => enemy.draw(ctx));

      bullets.current.forEach(bullet => bullet.draw(ctx));

      hearts.current.forEach(heart => heart.draw(ctx));
      buffs.current.forEach(buff => buff.drawBuff(ctx));

      explosions.current.forEach((explosion, index) => {
        if (explosion.frame >= explosionFrames.length) {
          explosions.current.splice(index, 1);
          return;
        }
        ctx.drawImage(explosionFrames[explosion.frame], explosion.x - (explosion.width / 2) + (10 / 2),
          explosion.y - (explosion.height / 2) + (20 / 2), explosion.height, explosion.height);
        explosion.frame += Math.ceil(frameMultiplier);
      });

      
    

      requestAnimationFrame(gameLoop);
    };

    window.addEventListener('keydown', (e) => keyHandler(e, true));
    window.addEventListener('keyup', (e) => keyHandler(e, false));
    canvasRef.current.addEventListener('mousemove', mouseMoveHandler);
    canvasRef.current.addEventListener('mousedown', () => mouse.shooting = true);
    canvasRef.current.addEventListener('mouseup', () => mouse.shooting = false);

    gameLoop();

    return () => {
      window.removeEventListener('keydown', (e) => keyHandler(e, true));
      window.removeEventListener('keyup', (e) => keyHandler(e, false));
      canvasRef.current?.removeEventListener('mousemove', mouseMoveHandler);
    };
  }, [gameState]);

  const handleVolumeChange = (value: number) => {
    setVolume(value); 
    volumeRef.current = value; 
    setSoundBtnLabelOn(value > 0);
    
    audioPool.current.forEach(audio => {
      audio.volume = (value / 100) * 0.10;
    });

    if (sounds) {
      Object.values(sounds).forEach(categoryAudios => {
        categoryAudios.forEach(audio => {
          audio.volume = (value / 100) * 0.10;
        });
      });
    }
  };

  const checkBalanceAndStartGame = async () => {
    if (authenticated && wallets.length > 0) {
      const privyWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
      
      if (privyWallet) {
        const currentBalance = await updateBalance(privyWallet);
        
        if (currentBalance && parseFloat(currentBalance) < 0.003) {
          setShowFaucetModal(true);
          return;
        }
      }
    }
    
    startCountdown();
  };

  const handleFaucetAndStartGame = async () => {
    if (authenticated && wallets.length > 0) {
      const privyWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
      
      if (privyWallet) {
        try {
          await handleFaucet(privyWallet.address);
          
          setTimeout(async () => {
            await updateBalance(privyWallet);
            setShowFaucetModal(false);
            startCountdown();
          }, 5000);
        } catch (error) {
          console.error("Faucet error in Game:", error);
          setShowFaucetModal(false);
          startCountdown();
        }
      }
    }
  };

  if (isUnsupportedBrowser()) {
    return (
      <div className="bg-mobile bg">
        <div className="mobile-warning">
          <h2>Unsupported browser</h2>
          <p>Please use browser from the list below.</p>
          <ul style={{
            textAlign: "left",
            padding: 0,
            margin: 0
          }}>
            <li>Chrome</li>
            <li>Edge (Chrome based)</li>
            <li>Safari (Chrome based)</li>
          </ul>
        </div>
      </div>
    );
  }


  

  if (isMobile) {
    return (
      <div className="bg-mobile bg">
        <div className="mobile-warning">
          <h2>Desktop version only</h2>
          <p>Please use a larger screen to play the game.</p>
        </div>
      </div>
    );
  }



  return (
    <div className="game-container">

      <div>
        <canvas ref={canvasRef} width={canvasRef.current?.width} height={canvasRef.current?.height}></canvas>
        {
          gameState === "countdown" && (
            <>
              <div className="coundown bg">
                <h1>{countdownValue}</h1>
              </div>
            </>
          )
        }

      <LeaderboardPopup 
        isOpen={isLeaderboardOpen} 
        onClose={() => setIsLeaderboardOpen(false)} 
      />

      {showFaucetModal && (
        <div 
          onClick={() => {
            setShowFaucetModal(false);
            startCountdown();
          }}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1200px',
            height: '900px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              position: 'relative', 
              backgroundColor: 'rgb(131 102 235)', 
              padding: '40px 38px  20px 38px ', 
              borderRadius: '10px',
              width: '500px',
              minHeight: '550px',
              margin: '0 auto',
              backgroundImage: 'url(/logo_2.png)',
              backgroundSize: 'contain',
              backgroundPosition: 'center 15px',
              backgroundRepeat: 'no-repeat'
            }}
          >
            <button 
              onClick={() => {
                setShowFaucetModal(false);
                startCountdown();
              }}
              style={{ 
                position: 'absolute', 
                top: '5px', 
                right: '5px',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '20px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
            
            <p style={{ color: '#fff', marginBottom: '450px', marginTop: '12px', textAlign: 'center', fontSize: '24px', fontWeight: 'bold' }}>
              We recommend using the Faucet to play <br /> on-chain. 
              
            </p>
            <span style={{ fontSize: '15px', display: 'block', color: '#fff', fontWeight: 'bold', letterSpacing: '0.05em', textAlign: 'center' }}>
                You can get 0.1 MON right now, and 1 MON after you kill 20+ gaynanimals in total
              </span>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: "20px" }}>
              <button 
                onClick={handleFaucetAndStartGame}
                style={{ 
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#6e54ff',
                  fontWeight: 'bold',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  marginTop: 'auto'
                }}
              >
                Faucet
              </button>
            </div>
          </div>
        </div>
      )}

        {gameState === 'playing' && (
          <GameUI
            killCount={gameStat.killCount}
            buffTimerValue={buffTimerValue}
            soundBtnLabelOn={soundBtnLabelOn}
            onSoundToggle={toggleSound}
            onStopGame={handleStopGame}
            volume={volume}
            onVolumeChange={handleVolumeChange}
          />
        )}
        {gameState === 'menu' && (
          <>
            <div className="bg">
              <h1 className='total-score h1'>Kill everyone <br /> Dodge everything</h1>
                <button disabled={isStartButtonDisabled} className="leaderboard-button" onClick={() => setIsLeaderboardOpen(true)}>
                  Leaderboard
                </button>
                <LoginBtn />

                <a 
                  href="https://twitter.com/monagayanimals" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#000',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    transition: 'opacity 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" fill="white"/>
                  </svg>
                </a>

              <div className="game-menu" style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexDirection: authenticated ? "row-reverse" : "column" ,
                gap: "29px",
                top: authenticated ? "50%" : "54%"
              }}>
             
                <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "10px"
              }} className="flex-wrapper">
                {!authenticated && (
                        <button className='ui-login-btn' onClick={() => login()} disabled={!ready}>
                          Start / Login
                        </button>
                 )}  

                  <button className={authenticated ? "play-btn" : "play-btn-guest"} onClick={checkBalanceAndStartGame} disabled={isStartButtonDisabled}>
                    {authenticated ? "Play" : "Play as a guest"}
                  </button>
                </div>
                  <button disabled={isStartButtonDisabled} style={{
                  marginRight: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "rgba(255, 255, 255, 0.6)",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "32px"
                }}>
                  <span className="counter-label" style={{ color: "#fff" }}>
                    🔊
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    style={{
                      width: "140px",
                      accentColor: "#6e54ff"
                    }}
                    onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                  />
                </button> 
              </div>
            </div>

          </>
        )}

        {gameState === 'gameover' && (
          <>
            <div className="bg">
              <h1 className='total-score h1'>Your total score: {gameStat.totalScore}</h1>
              <button className="leaderboard-button" onClick={() => setIsLeaderboardOpen(true)}>
                  Leaderboard
                </button>
                <LoginBtn />

              {/* Круглая кнопка X в правом нижнем углу */}
              <a 
                href="https://twitter.com/monagayanimals" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  right: '20px',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#000',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'opacity 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" fill="white"/>
                </svg>
              </a>

              <div className="game-menu" style={{ display: 'flex', 
                alignItems: 'center',
                 justifyContent: 'center',
                 flexDirection: authenticated ? "row-reverse" : "column" ,
                 gap: "29px",
                 top: authenticated ? "50%" : "49%"
                   }}>
              <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "10px"
              }} className="flex-wrapper">
                {!authenticated && (
                        <button className='ui-login-btn' onClick={() => login()} disabled={!ready}>
                          Start / Login
                        </button>
                 )}  
                   <button className={authenticated ? "play-btn" : "play-btn-guest"} onClick={checkBalanceAndStartGame}>
                  {authenticated ? "Play again" : "Play as a guest"}
                </button>
                  </div>
              
                <button 
                  onClick={() => {
                    const text = `I just scored ${gameStat.totalScore} points in @monagayanimals on the @monad_xyz testnet! Can you beat my score?`;
                    const url = "https://monagaynanimals.xyz/";
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                  }}
                  style={{ marginLeft: '10px', backgroundColor: '#000000', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  Share results on <img src="/x.jpg" alt="X logo" style={{ height: '20px', width: 'auto' }} />
                </button>
              </div>

              <div className="game-stat">

                <div className="row">
                  <div className="col">
                    <span>Total kills: {gameStat.killCount}</span>
                    <span>Bosses killed: {gameStat.fireMondalakKillKount}</span>
                    <span>Damage dealt: {gameStat.damageGiven}</span>
                  </div>
                  <div className="col">
                    <span>Damage taken: {gameStat.damageTaken}</span>
                    <span>Heals used: {gameStat.healsUsed}</span>
                    <span>Buffs taken: {gameStat.buffsTaken}</span>
                  </div>
                </div>
              </div>
            </div>
          </>

        )}
      </div>
      <TransactionsTable transactions={transactions} clearTransactions={clearTransactions} key={transactions.length} />
    </div>
  );
};
export default Game;

