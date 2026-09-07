// --- Fake Poker: Texas Hold'em Game Engine ---

const SUITS = [
  { symbol: '♠', color: 'black' },
  { symbol: '♥', color: 'red' },
  { symbol: '♦', color: 'red' },
  { symbol: '♣', color: 'black' }
];

const RANKS = [
  { rank: '2', val: 2 },
  { rank: '3', val: 3 },
  { rank: '4', val: 4 },
  { rank: '5', val: 5 },
  { rank: '6', val: 6 },
  { rank: '7', val: 7 },
  { rank: '8', val: 8 },
  { rank: '9', val: 9 },
  { rank: '10', val: 10 },
  { rank: 'J', val: 11 },
  { rank: 'Q', val: 12 },
  { rank: 'K', val: 13 },
  { rank: 'A', val: 14 }
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Sound Synthesizer via Web Audio API
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playChip() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 + Math.random() * 400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playCard() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  playWin() {
    if (!this.enabled || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.1);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.1 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + idx * 0.1);
      osc.stop(this.ctx.currentTime + idx * 0.1 + 0.25);
    });
  }
}

const sounds = new SoundManager();

// Hand Evaluator (7-card Texas Hold'em)
class HandEvaluator {
  static evaluate7(cards) {
    if (cards.length < 5) return { rankValue: -1, name: 'Incomplete' };
    const combos = this.combinations(cards, 5);
    let best = null;
    for (const combo of combos) {
      const eval5 = this.evaluate5(combo);
      if (!best || this.compare(eval5, best) > 0) {
        best = eval5;
      }
    }
    return best;
  }

  static combinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const head = arr[0];
    const tail = arr.slice(1);
    const withHead = this.combinations(tail, k - 1).map(c => [head, ...c]);
    const withoutHead = this.combinations(tail, k);
    return [...withHead, ...withoutHead];
  }

  static evaluate5(cards) {
    const sorted = [...cards].sort((a, b) => b.val - a.val);
    const vals = sorted.map(c => c.val);
    const isFlush = sorted.every(c => c.suit === sorted[0].suit);
    
    // Check Straight (including A-2-3-4-5 wheel)
    let isStraight = false;
    let straightHigh = vals[0];
    if (
      vals[0] - vals[1] === 1 &&
      vals[1] - vals[2] === 1 &&
      vals[2] - vals[3] === 1 &&
      vals[3] - vals[4] === 1
    ) {
      isStraight = true;
    } else if (
      vals[0] === 14 &&
      vals[1] === 5 &&
      vals[2] === 4 &&
      vals[3] === 3 &&
      vals[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5; // Wheel straight high card is 5
    }

    // Rank counts
    const counts = {};
    vals.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const freqGroups = Object.keys(counts)
      .map(v => ({ val: Number(v), count: counts[v] }))
      .sort((a, b) => b.count - a.count || b.val - a.val);

    const pattern = freqGroups.map(g => g.count).join('');

    if (isStraight && isFlush) {
      if (straightHigh === 14) {
        return { category: 9, tieBreakers: [14], name: 'Royal Flush' };
      }
      return { category: 8, tieBreakers: [straightHigh], name: `Straight Flush (${this.rankName(straightHigh)} High)` };
    }

    if (pattern === '41') {
      return { category: 7, tieBreakers: [freqGroups[0].val, freqGroups[1].val], name: `Four of a Kind (${this.rankName(freqGroups[0].val)}s)` };
    }

    if (pattern === '32') {
      return { category: 6, tieBreakers: [freqGroups[0].val, freqGroups[1].val], name: `Full House (${this.rankName(freqGroups[0].val)}s full of ${this.rankName(freqGroups[1].val)}s)` };
    }

    if (isFlush) {
      return { category: 5, tieBreakers: vals, name: `Flush (${this.rankName(vals[0])} High)` };
    }

    if (isStraight) {
      return { category: 4, tieBreakers: [straightHigh], name: `Straight (${this.rankName(straightHigh)} High)` };
    }

    if (pattern === '311') {
      return { category: 3, tieBreakers: [freqGroups[0].val, freqGroups[1].val, freqGroups[2].val], name: `Three of a Kind (${this.rankName(freqGroups[0].val)}s)` };
    }

    if (pattern === '221') {
      return { category: 2, tieBreakers: [freqGroups[0].val, freqGroups[1].val, freqGroups[2].val], name: `Two Pair (${this.rankName(freqGroups[0].val)}s & ${this.rankName(freqGroups[1].val)}s)` };
    }

    if (pattern === '2111') {
      return { category: 1, tieBreakers: [freqGroups[0].val, freqGroups[1].val, freqGroups[2].val, freqGroups[3].val], name: `Pair of ${this.rankName(freqGroups[0].val)}s` };
    }

    return { category: 0, tieBreakers: vals, name: `High Card (${this.rankName(vals[0])})` };
  }

  static compare(a, b) {
    if (a.category !== b.category) return a.category - b.category;
    for (let i = 0; i < Math.max(a.tieBreakers.length, b.tieBreakers.length); i++) {
      const tbA = a.tieBreakers[i] || 0;
      const tbB = b.tieBreakers[i] || 0;
      if (tbA !== tbB) return tbA - tbB;
    }
    return 0;
  }

  static rankName(val) {
    const map = { 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: '10' };
    return map[val] || String(val);
  }
}

// Game State & Logic
class PokerGame {
  constructor() {
    this.players = [
      { id: 0, name: 'You', isHuman: true, chips: 1000, currentBet: 0, folded: false, allIn: false, holeCards: [] },
      { id: 1, name: 'Bob', isHuman: false, chips: 1000, currentBet: 0, folded: false, allIn: false, holeCards: [] },
      { id: 2, name: 'Alice', isHuman: false, chips: 1000, currentBet: 0, folded: false, allIn: false, holeCards: [] },
      { id: 3, name: 'Charlie', isHuman: false, chips: 1000, currentBet: 0, folded: false, allIn: false, holeCards: [] }
    ];
    this.deck = [];
    this.communityCards = [];
    this.pot = 0;
    this.dealerIdx = 0;
    this.currentTurnIdx = 0;
    this.currentHighestBet = 0;
    this.minRaise = 20;
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.phase = 'IDLE'; // IDLE, PRE-FLOP, FLOP, TURN, RIVER, SHOWDOWN
    this.turnHistoryCount = 0;
    this.lastAggressorIdx = -1;
    this.roundOver = false;
    this.lastWinners = [];

    this.bindDOM();
  }

  bindDOM() {
    this.potDisplay = document.getElementById('pot-amount');
    this.phaseBadge = document.getElementById('game-phase');
    this.communityCardsEl = document.getElementById('community-cards');
    this.startBtn = document.getElementById('start-btn');
    this.resetBtn = document.getElementById('reset-game-btn');
    this.soundBtn = document.getElementById('sound-btn');
    this.startControls = document.getElementById('start-controls');
    this.bettingControls = document.getElementById('betting-controls');
    this.foldBtn = document.getElementById('fold-btn');
    this.checkCallBtn = document.getElementById('check-call-btn');
    this.raiseBtn = document.getElementById('raise-btn');
    this.raiseSlider = document.getElementById('raise-slider');
    this.raiseVal = document.getElementById('raise-val');
    this.handRankDesc = document.getElementById('hand-rank-desc');
    this.logMessages = document.getElementById('log-messages');
    this.logPanel = document.getElementById('log-panel');
    this.logToggleBtn = document.getElementById('log-toggle-btn');
    this.closeLogBtn = document.getElementById('close-log-btn');
    this.liveTicker = document.getElementById('live-ticker');
    this.tickerText = document.getElementById('ticker-text');

    // Unlock audio on first touch/click anywhere (iOS Safari / mobile policy)
    const unlockAudio = () => {
      sounds.init();
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('touchstart', unlockAudio, { passive: true });
    document.addEventListener('click', unlockAudio, { passive: true });

    this.startBtn.addEventListener('click', () => {
      sounds.init();
      this.startNewHand();
    });

    this.resetBtn.addEventListener('click', () => {
      if (confirm('Reset all player chips to $1,000?')) {
        this.players.forEach(p => { p.chips = 1000; });
        this.log('All chip stacks reset to $1,000.', 'system');
        this.updateUI();
      }
    });

    this.soundBtn.addEventListener('click', () => {
      sounds.enabled = !sounds.enabled;
      this.soundBtn.innerText = sounds.enabled ? '🔊' : '🔇';
    });

    // Mobile Log Drawer / Modal Toggle
    if (this.logToggleBtn) {
      this.logToggleBtn.addEventListener('click', () => {
        this.logPanel.classList.toggle('open');
      });
    }

    if (this.liveTicker) {
      this.liveTicker.addEventListener('click', () => {
        this.logPanel.classList.add('open');
      });
    }

    if (this.closeLogBtn) {
      this.closeLogBtn.addEventListener('click', () => {
        this.logPanel.classList.remove('open');
      });
    }

    this.foldBtn.addEventListener('click', () => this.handleAction('fold'));
    this.checkCallBtn.addEventListener('click', () => this.handleAction('call'));
    this.raiseBtn.addEventListener('click', () => {
      const amount = parseInt(this.raiseSlider.value, 10);
      this.handleAction('raise', amount);
    });

    this.raiseSlider.addEventListener('input', (e) => {
      this.raiseVal.innerText = `$${e.target.value}`;
      this.raiseBtn.innerText = `Raise to $${e.target.value}`;
    });

    document.querySelectorAll('.quick-bet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        this.setQuickBet(type);
      });
    });
  }

  log(msg, type = 'action') {
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.innerText = msg;
    this.logMessages.appendChild(div);
    this.logMessages.scrollTop = this.logMessages.scrollHeight;

    if (this.tickerText) {
      this.tickerText.innerText = msg;
    }
  }

  createDeck() {
    this.deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.deck.push({
          suit: suit.symbol,
          rank: rank.rank,
          val: rank.val,
          color: suit.color
        });
      }
    }
    // Fisher-Yates Shuffle
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  startNewHand() {
    // Check if player has chips
    if (this.players[0].chips <= 0) {
      this.players[0].chips = 500;
      this.log('Re-bought $500 in chips for You!', 'system');
    }
    // Revive bankrupt bots with chips
    this.players.forEach(p => {
      if (p.chips <= 0) p.chips = 500;
    });

    this.dealerIdx = (this.dealerIdx + 1) % this.players.length;
    this.createDeck();
    this.communityCards = [];
    this.pot = 0;
    this.currentHighestBet = 0;
    this.minRaise = this.bigBlind;
    this.roundOver = false;
    this.lastWinners = [];

    this.players.forEach(p => {
      p.folded = false;
      p.allIn = false;
      p.cardsRevealed = false;
      p.currentBet = 0;
      p.holeCards = [this.deck.pop(), this.deck.pop()];
    });

    sounds.playCard();
    this.phase = 'PRE-FLOP';
    this.log('--- New Hand Dealt ---', 'system');

    // Post Blinds
    const sbIdx = (this.dealerIdx + 1) % this.players.length;
    const bbIdx = (this.dealerIdx + 2) % this.players.length;
    this.postBet(this.players[sbIdx], this.smallBlind, 'Small Blind');
    this.postBet(this.players[bbIdx], this.bigBlind, 'Big Blind');
    this.currentHighestBet = this.bigBlind;

    // Action starts after BB pre-flop
    this.currentTurnIdx = (bbIdx + 1) % this.players.length;
    this.turnHistoryCount = 0;
    this.lastAggressorIdx = bbIdx;

    this.startControls.style.display = 'none';
    this.updateUI();
    this.nextTurn();
  }

  postBet(player, amount, label = 'Bet') {
    const betAmount = Math.min(player.chips, amount);
    player.chips -= betAmount;
    player.currentBet += betAmount;
    this.pot += betAmount;
    if (player.chips === 0) player.allIn = true;
    sounds.playChip();
    this.log(`${player.name} posts ${label} $${betAmount}`);
  }

  async nextTurn() {
    // Check if only 1 active player remains
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      this.bettingControls.style.display = 'none';
      await sleep(500);
      for (const p of this.players) {
        p.cardsRevealed = true;
      }
      this.updateUI();
      await sleep(700);
      this.awardPot([activePlayers[0]], 'everyone else folded');
      return;
    }

    // Check if betting round is complete
    const eligibleToAct = activePlayers.filter(p => !p.allIn);
    const allBetsEqual = eligibleToAct.every(p => p.currentBet === this.currentHighestBet);

    if (this.turnHistoryCount >= activePlayers.length && (allBetsEqual || eligibleToAct.length <= 1)) {
      await this.advancePhase();
      return;
    }

    // Find next eligible player
    let loops = 0;
    while (loops < this.players.length) {
      const p = this.players[this.currentTurnIdx];
      if (!p.folded && !p.allIn) {
        break;
      }
      this.currentTurnIdx = (this.currentTurnIdx + 1) % this.players.length;
      loops++;
    }

    // If nobody else can act (e.g. all-in), advance to showdown
    if (eligibleToAct.length <= 1 && allBetsEqual) {
      await this.advancePhase();
      return;
    }

    this.turnHistoryCount++;
    this.updateUI();

    const currentPlayer = this.players[this.currentTurnIdx];
    if (currentPlayer.isHuman) {
      this.promptHumanAction();
    } else {
      this.bettingControls.style.display = 'none';
      setTimeout(() => this.botAction(currentPlayer), 900);
    }
  }

  promptHumanAction() {
    const human = this.players[0];
    this.bettingControls.style.display = 'flex';

    const callAmount = this.currentHighestBet - human.currentBet;
    if (callAmount <= 0) {
      this.checkCallBtn.innerText = 'Check';
      this.checkCallBtn.className = 'btn check-btn';
    } else {
      const needed = Math.min(callAmount, human.chips);
      this.checkCallBtn.innerText = `Call $${needed}`;
      this.checkCallBtn.className = 'btn check-btn';
    }

    // Raise Slider setup
    const minTarget = this.currentHighestBet + this.minRaise;
    const maxTarget = human.chips + human.currentBet;

    if (maxTarget <= this.currentHighestBet) {
      // Human can't raise, only call/all-in
      this.raiseBtn.disabled = true;
      this.raiseSlider.disabled = true;
      this.raiseBtn.innerText = 'Cannot Raise';
    } else {
      this.raiseBtn.disabled = false;
      this.raiseSlider.disabled = false;
      this.raiseSlider.min = Math.min(minTarget, maxTarget);
      this.raiseSlider.max = maxTarget;
      this.raiseSlider.value = Math.min(minTarget, maxTarget);
      this.raiseVal.innerText = `$${this.raiseSlider.value}`;
      this.raiseBtn.innerText = `Raise to $${this.raiseSlider.value}`;
    }
  }

  setQuickBet(type) {
    const human = this.players[0];
    const max = human.chips + human.currentBet;
    const min = Math.min(this.currentHighestBet + this.minRaise, max);

    let target = min;
    if (type === 'half') {
      target = Math.max(min, Math.min(max, Math.floor(this.pot / 2) + this.currentHighestBet));
    } else if (type === 'pot') {
      target = Math.max(min, Math.min(max, this.pot + this.currentHighestBet));
    } else if (type === 'allin') {
      target = max;
    }

    this.raiseSlider.value = target;
    this.raiseVal.innerText = `$${target}`;
    this.raiseBtn.innerText = target === max ? `All-In ($${target})` : `Raise to $${target}`;
  }

  handleAction(action, targetTotalBet = 0) {
    const p = this.players[this.currentTurnIdx];

    if (action === 'fold') {
      p.folded = true;
      this.log(`${p.name} folds.`);
    } else if (action === 'call') {
      const needed = this.currentHighestBet - p.currentBet;
      if (needed <= 0) {
        this.log(`${p.name} checks.`);
      } else {
        const bet = Math.min(needed, p.chips);
        p.chips -= bet;
        p.currentBet += bet;
        this.pot += bet;
        if (p.chips === 0) p.allIn = true;
        sounds.playChip();
        this.log(`${p.name} calls $${bet}.`);
      }
    } else if (action === 'raise') {
      const added = targetTotalBet - p.currentBet;
      const actualAdded = Math.min(added, p.chips);
      p.chips -= actualAdded;
      p.currentBet += actualAdded;
      this.pot += actualAdded;
      
      const raiseDiff = p.currentBet - this.currentHighestBet;
      if (raiseDiff > this.minRaise) {
        this.minRaise = raiseDiff;
      }
      this.currentHighestBet = p.currentBet;
      if (p.chips === 0) p.allIn = true;
      sounds.playChip();
      this.log(`${p.name} raises to $${p.currentBet}!`);
      this.turnHistoryCount = 1; // Reset round turn counter on raise
    }

    this.currentTurnIdx = (this.currentTurnIdx + 1) % this.players.length;
    this.nextTurn();
  }

  botAction(bot) {
    const callNeeded = this.currentHighestBet - bot.currentBet;
    const handEval = HandEvaluator.evaluate7([...bot.holeCards, ...this.communityCards]);
    const botStrength = handEval.category; // 0 (high card) to 9 (royal flush)

    // Pre-flop basic strength heuristic
    const isPair = bot.holeCards[0].val === bot.holeCards[1].val;
    const highCardVal = Math.max(bot.holeCards[0].val, bot.holeCards[1].val);
    const preFlopScore = isPair ? (highCardVal * 2) : (highCardVal + (bot.holeCards[0].suit === bot.holeCards[1].suit ? 3 : 0));

    // Simple decision engine
    if (callNeeded === 0) {
      // Can check for free
      if ((this.phase === 'PRE-FLOP' && preFlopScore >= 20) || botStrength >= 2) {
        // Raise occasionally if strong
        if (Math.random() < 0.6 && bot.chips > this.bigBlind * 2) {
          const raiseAmount = Math.min(bot.currentBet + this.bigBlind * 2, bot.chips + bot.currentBet);
          this.handleAction('raise', raiseAmount);
          return;
        }
      }
      this.handleAction('call'); // Check
    } else {
      // Must put in chips to continue
      const potOdds = callNeeded / (this.pot + callNeeded);

      if (callNeeded > bot.chips * 0.6 && botStrength < 2 && preFlopScore < 20) {
        // Too expensive for weak hand
        this.handleAction('fold');
      } else if (callNeeded <= this.bigBlind * 2 || botStrength >= 1 || preFlopScore >= 16) {
        // Call or raise
        if (botStrength >= 3 && Math.random() < 0.5 && bot.chips > callNeeded * 2) {
          const raiseAmount = Math.min(this.currentHighestBet + this.minRaise * 2, bot.chips + bot.currentBet);
          this.handleAction('raise', raiseAmount);
        } else {
          this.handleAction('call');
        }
      } else {
        // Weak hand facing bet -> fold
        this.handleAction('fold');
      }
    }
  }

  async advancePhase() {
    // Hide controls during card dealing
    this.bettingControls.style.display = 'none';

    // Reset bets for active players
    this.players.forEach(p => { p.currentBet = 0; });
    this.currentHighestBet = 0;
    this.minRaise = this.bigBlind;
    this.turnHistoryCount = 0;
    this.updateUI();

    if (this.phase === 'PRE-FLOP') {
      this.phase = 'FLOP';
      this.deck.pop(); // Burn card
      this.log('--- Dealing Flop ---', 'system');
      this.updateUI();
      await sleep(500);

      // Card 1
      this.communityCards.push(this.deck.pop());
      sounds.playCard();
      this.updateUI();
      await sleep(400);

      // Card 2
      this.communityCards.push(this.deck.pop());
      sounds.playCard();
      this.updateUI();
      await sleep(400);

      // Card 3
      this.communityCards.push(this.deck.pop());
      sounds.playCard();
      this.updateUI();
      await sleep(750); // Pause to assess the full flop
    } else if (this.phase === 'FLOP') {
      this.phase = 'TURN';
      this.deck.pop(); // Burn card
      this.log('--- Dealing Turn ---', 'system');
      this.updateUI();
      await sleep(850); // Suspenseful pause before the Turn!

      this.communityCards.push(this.deck.pop());
      sounds.playCard();
      this.updateUI();
      await sleep(750);
    } else if (this.phase === 'TURN') {
      this.phase = 'RIVER';
      this.deck.pop(); // Burn card
      this.log('--- Dealing River ---', 'system');
      this.updateUI();
      await sleep(950); // Suspenseful pause before the River!

      this.communityCards.push(this.deck.pop());
      sounds.playCard();
      this.updateUI();
      await sleep(800);
    } else if (this.phase === 'RIVER') {
      this.phase = 'SHOWDOWN';
      await this.showdown();
      return;
    }

    // Next round starts with player to the left of dealer
    this.currentTurnIdx = (this.dealerIdx + 1) % this.players.length;
    this.updateUI();
    this.nextTurn();
  }

  async showdown() {
    this.bettingControls.style.display = 'none';
    this.phase = 'SHOWDOWN';
    this.updateUI();
    this.log('=== SHOWDOWN ===', 'system');
    await sleep(700);

    const activePlayers = this.players.filter(p => !p.folded);

    // Dramatically reveal each bot's cards one by one!
    for (const p of this.players) {
      if (!p.isHuman) {
        p.cardsRevealed = true;
        sounds.playCard();
        this.updateUI();

        if (!p.folded) {
          const evalResult = HandEvaluator.evaluate7([...p.holeCards, ...this.communityCards]);
          this.log(`${p.name} reveals: ${evalResult.name}`);
        } else {
          this.log(`${p.name} had folded.`);
        }
        await sleep(900); // Dramatic pause per bot reveal!
      }
    }

    this.log('Determining the winner...', 'system');
    await sleep(850); // Final suspense pause!

    const results = activePlayers.map(p => {
      const evalResult = HandEvaluator.evaluate7([...p.holeCards, ...this.communityCards]);
      return { player: p, eval: evalResult };
    });

    results.sort((a, b) => HandEvaluator.compare(b.eval, a.eval));

    // Find winners (handle ties)
    const bestEval = results[0].eval;
    const winners = results.filter(r => HandEvaluator.compare(r.eval, bestEval) === 0).map(r => r.player);

    this.awardPot(winners, bestEval.name);
  }

  awardPot(winners, reason) {
    sounds.playWin();
    const share = Math.floor(this.pot / winners.length);
    const names = winners.map(w => w.name).join(' & ');
    winners.forEach(w => { w.chips += share; });

    this.log(`🏆 ${names} won $${this.pot} with ${reason}!`, 'winner');

    this.pot = 0;
    this.phase = 'IDLE';
    this.roundOver = true;
    this.lastWinners = winners;
    this.bettingControls.style.display = 'none';
    this.startControls.style.display = 'flex';
    this.startBtn.innerText = 'Next Hand';
    this.updateUI();
  }

  updateUI() {
    this.potDisplay.innerText = `$${this.pot}`;
    this.phaseBadge.innerText = this.phase;

    // Render Community Cards
    this.communityCardsEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      if (this.communityCards[i]) {
        this.communityCardsEl.appendChild(this.renderCardDOM(this.communityCards[i]));
      } else {
        const slot = document.createElement('div');
        slot.className = 'card-slot';
        this.communityCardsEl.appendChild(slot);
      }
    }

    // Render Players
    this.players.forEach(p => {
      const seat = document.getElementById(`seat-${p.id}`);
      const chipsEl = document.getElementById(`chips-${p.id}`);
      const betEl = document.getElementById(`bet-${p.id}`);
      const dealerEl = document.getElementById(`dealer-${p.id}`);
      const statusEl = document.getElementById(`status-${p.id}`);
      const cardsEl = document.getElementById(`cards-${p.id}`);

      chipsEl.innerText = `$${p.chips}`;

      if (p.currentBet > 0) {
        betEl.innerText = `$${p.currentBet}`;
        betEl.classList.add('show');
      } else {
        betEl.classList.remove('show');
      }

      if (this.dealerIdx === p.id) {
        dealerEl.classList.add('show');
      } else {
        dealerEl.classList.remove('show');
      }

      // Active Turn Indicator
      if (this.phase !== 'IDLE' && this.phase !== 'SHOWDOWN' && this.currentTurnIdx === p.id && !p.folded) {
        seat.classList.add('active-turn');
      } else {
        seat.classList.remove('active-turn');
      }

      // Status text
      if (p.folded) {
        if (statusEl) {
          statusEl.innerText = 'Folded';
          statusEl.className = 'player-status folded';
        }
      } else if (p.allIn) {
        if (statusEl) {
          statusEl.innerText = 'All-In';
          statusEl.className = 'player-status';
        }
      } else if (statusEl) {
        if (this.roundOver) {
          const isWinner = this.lastWinners && this.lastWinners.some(w => w.id === p.id);
          if (this.communityCards.length >= 3) {
            const evalResult = HandEvaluator.evaluate7([...p.holeCards, ...this.communityCards]);
            statusEl.innerText = isWinner ? `🏆 ${evalResult.name}` : evalResult.name;
            statusEl.className = isWinner ? 'player-status winner-text' : 'player-status';
          } else {
            statusEl.innerText = isWinner ? '🏆 Winner' : 'Active';
            statusEl.className = isWinner ? 'player-status winner-text' : 'player-status';
          }
        } else if (p.cardsRevealed && this.communityCards.length >= 3) {
          const evalResult = HandEvaluator.evaluate7([...p.holeCards, ...this.communityCards]);
          statusEl.innerText = evalResult.name;
          statusEl.className = 'player-status';
        } else {
          statusEl.innerText = this.phase === 'IDLE' ? 'Ready' : 'In Hand';
          statusEl.className = 'player-status';
        }
      }

      // Cards rendering: Human always visible, bots revealed sequentially or at round end
      cardsEl.innerHTML = '';
      if (p.holeCards.length > 0) {
        if (p.isHuman || this.roundOver || p.cardsRevealed) {
          p.holeCards.forEach(c => {
            const cardEl = this.renderCardDOM(c);
            if (p.folded) {
              cardEl.classList.add('card-folded');
            }
            cardsEl.appendChild(cardEl);
          });
        } else {
          // Face-down bot cards during active play
          cardsEl.appendChild(this.renderCardDOM(null, true));
          cardsEl.appendChild(this.renderCardDOM(null, true));
        }
      }
    });

    // Update Human Hand Evaluation Preview
    const human = this.players[0];
    if (human.holeCards.length > 0 && !human.folded) {
      const allVisible = [...human.holeCards, ...this.communityCards];
      if (allVisible.length >= 5) {
        const evalResult = HandEvaluator.evaluate7(allVisible);
        this.handRankDesc.innerText = evalResult.name;
        this.handRankDesc.style.display = 'block';
      } else {
        this.handRankDesc.innerText = 'Pre-Flop';
        this.handRankDesc.style.display = 'block';
      }
    } else {
      this.handRankDesc.style.display = 'none';
    }
  }

  renderCardDOM(card, isBack = false) {
    const cardEl = document.createElement('div');
    if (isBack) {
      cardEl.className = 'card back';
      return cardEl;
    }

    cardEl.className = `card ${card.color}`;
    cardEl.innerHTML = `
      <div class="card-corner top-left">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.suit}</span>
      </div>
      <div class="card-center">${card.suit}</div>
      <div class="card-corner bottom-right">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.suit}</span>
      </div>
    `;
    return cardEl;
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  window.pokerGame = new PokerGame();
});
