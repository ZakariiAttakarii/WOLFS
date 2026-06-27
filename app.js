document.addEventListener('DOMContentLoaded', () => {
  // 1. STATE VARIABLES
  let isEmergencyMode = false;
  let gamePollInterval = null;
  let currentGameState = null;
  let selectedVotePlayerId = null;
  let isRequestingStep = false; // Prevent double trigger

  const RANDOM_SETUP_TOPICS = [
    "Explain why pineapple belongs or doesn't belong on pizza. Defend your stance with logic.",
    "Explain quantum computing to a 10-year-old child.",
    "Debate the ultimate text editor: Vim vs. VS Code.",
    "Explain the technical difference between REST APIs and GraphQL like I am five.",
    "What is the most beautiful programming language and why?",
    "Write a precise, step-by-step recipe for brewing the ultimate cup of tea.",
    "Explain how the global Internet works in three short, concise paragraphs.",
    "If a tree falls in a forest and no one is around, does it make a sound? Defend scientifically."
  ];

  // 2. PARALLAX CONCENTRIC HUD CALIBRATION (Lobby)
  document.addEventListener('mousemove', (e) => {
    const circles = document.querySelectorAll('.concentric-circle');
    const x = (e.clientX / window.innerWidth - 0.5) * 20;
    const y = (e.clientY / window.innerHeight - 0.5) * 20;
    
    circles.forEach((circle, index) => {
      // Outward rings translate faster than inner rings for true depth
      const speed = (index + 1) * 0.15;
      if (circle) {
        circle.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
      }
    });
  });

  // 3. REAL-TIME CLOCK LOGIC
  const clockEl = document.getElementById('clock');
  function updateClock() {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    if (clockEl) clockEl.textContent = timeStr;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // 4. CPU DRIFT FOOTER EFFECT
  const cpuDisplay = document.getElementById('footer-cpu');
  if (cpuDisplay) {
    setInterval(() => {
      const baseLoad = isEmergencyMode ? 88 : 44;
      const randomDrift = (baseLoad + (Math.random() - 0.5) * 4).toFixed(2);
      cpuDisplay.textContent = `${randomDrift}% LOAD`;
    }, 2000);
  }

  // Native Synth Alert Sound using Web Audio API
  function playEmergencySound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime); // start at low freq
      
      // Sweep pitch up and down over 1.2 seconds to simulate a red-alert alarm
      osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.4);
      osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.8);
      osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 1.2);
      
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5); // fade out
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 1.5);
    } catch (e) {
      console.warn("AudioContext failed to initialize or start sound:", e);
    }
  }

  // 5. LOCKDOWN SYSTEM / EMERGENCY MODE TOGGLE
  const btnLockdown = document.getElementById('btn-lockdown');
  const body = document.body;
  const securePulse = document.getElementById('secure-pulse');
  const uplinkStatus = document.getElementById('uplink-status');
  const sysStateBadge = document.getElementById('sys-state-badge');

  if (btnLockdown) {
    btnLockdown.addEventListener('click', () => {
      isEmergencyMode = !isEmergencyMode;

      // Play retro red-alert alarm sound
      playEmergencySound();

      if (isEmergencyMode) {
        btnLockdown.textContent = 'SYSTEM COMPROMISED - SECURED';
        body.classList.add('emergency-mode');
        if (securePulse) {
          securePulse.classList.remove('bg-primary');
          securePulse.classList.add('bg-red-500');
        }
        if (uplinkStatus) {
          uplinkStatus.textContent = 'SYSTEM_COMPROMISED';
        }
        if (sysStateBadge) {
          sysStateBadge.textContent = 'SYS_STATE: DANGER';
          sysStateBadge.classList.add('text-red-500');
        }
      } else {
        btnLockdown.textContent = 'LOCKDOWN SYSTEM';
        body.classList.remove('emergency-mode');
        if (securePulse) {
          securePulse.classList.remove('bg-red-500');
          securePulse.classList.add('bg-primary');
        }
        if (uplinkStatus) {
          uplinkStatus.textContent = 'UPLINK_SECURE';
        }
        if (sysStateBadge) {
          sysStateBadge.textContent = 'SYS_STATE: ONLINE';
          sysStateBadge.classList.remove('text-red-500');
        }
      }
    });
  }

  // 6. TUTORIAL OVERLAY MODAL
  const guideModal = document.getElementById('guide-modal');
  const btnReviewGuide = document.getElementById('btn-review-guide');
  const guideCloseBtn = document.getElementById('guide-close-btn');

  if (btnReviewGuide && guideModal) {
    btnReviewGuide.addEventListener('click', () => {
      guideModal.classList.remove('hidden');
    });
  }
  if (guideCloseBtn && guideModal) {
    guideCloseBtn.addEventListener('click', () => {
      guideModal.classList.add('hidden');
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === guideModal) {
      guideModal.classList.add('hidden');
    }
  });


  // 7. HIGH-FIDELITY HANDSHAKE SIMULATION (Transitions Lobby -> Setup)
  const calibrationModal = document.getElementById('calibration-modal');
  const btnStartTest = document.getElementById('btn-start-test');
  const modalScanBar = document.getElementById('modal-scan-bar');
  const modalScanText = document.getElementById('modal-scan-text');
  const modalResultText = document.getElementById('modal-result-text');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');

  if (btnStartTest && calibrationModal) {
    btnStartTest.addEventListener('click', () => {
      calibrationModal.classList.remove('hidden');

      // Reset Modal state
      modalScanBar.style.width = '0%';
      modalScanText.textContent = 'INITIATING COUPLING...';
      modalResultText.innerHTML = '';
      modalConfirmBtn.classList.add('hidden');

      const consoleLines = [
        { percent: 12, label: 'CONN_UPLINK', msg: 'ESTABLISHING SECURE PROTOCOL AT LOCAL_HOST...' },
        { percent: 28, label: 'AUTH_CHAL', msg: 'GENERATING SYNAPSE SECURE KEY: TRN_x9FF84.' },
        { percent: 45, label: 'CAL_PARALLAX', msg: 'MEASURING VISUAL OPERATOR RESPONSE DELAY... OPTIMAL.' },
        { percent: 62, label: 'MEM_INTEGRITY', msg: 'AUDITING KERNEL MEMORY SECTORS. STATUS: 100% SECURE.' },
        { percent: 80, label: 'KEYS_LOADED', msg: 'DECRYPTING LEVEL-4 OPERATOR TELEMETRY SIGNATURES.' },
        { percent: 95, label: 'CORE_SYNC', msg: 'CALIBRATING SYSTEM SYNAPSE COUPLING MATRIX...' }
      ];

      let currentLineIndex = 0;
      let progress = 0;

      const interval = setInterval(() => {
        progress += 2;
        if (progress > 100) progress = 100;

        modalScanBar.style.width = `${progress}%`;
        
        if (currentLineIndex < consoleLines.length && progress >= consoleLines[currentLineIndex].percent) {
          const line = consoleLines[currentLineIndex];
          modalScanText.textContent = `RUNNING TASK: [${line.label}]...`;

          const newLine = document.createElement('div');
          newLine.className = 'font-mono text-[10px] leading-relaxed text-left border-l border-purple-500/20 pl-2 mb-1 text-purple-300';
          newLine.innerHTML = `<span class="text-pink-400 opacity-70">[${line.label}]</span> ${line.msg}`;

          modalResultText.appendChild(newLine);
          modalResultText.scrollTop = modalResultText.scrollHeight;

          currentLineIndex++;
        }

        if (progress >= 100) {
          clearInterval(interval);
          modalScanText.textContent = 'CALIBRATION PROTOCOL COMPLETED.';

          const finalSuccess = document.createElement('div');
          finalSuccess.className = 'font-mono text-[10px] leading-relaxed text-left mt-2 text-purple-200 font-bold border-l-2 border-purple-500 pl-2';
          finalSuccess.textContent = '>> SUCCESS: SYNPATIC CALIBRATION COMPLETE. SECURE LINK ONLINE.';
          modalResultText.appendChild(finalSuccess);
          modalResultText.scrollTop = modalResultText.scrollHeight;

          modalConfirmBtn.classList.remove('hidden');
        }
      }, 30);
    });
  }

  // Dismissing handshake transitions to setup
  if (modalConfirmBtn && calibrationModal) {
    modalConfirmBtn.addEventListener('click', () => {
      calibrationModal.classList.add('hidden');
      transitionToScreen('setup');
      checkApiKeyStatus();
    });
  }


  // ==================== STATE ENGINE & GAMEPLAY LOGIC ====================
  
  // HTML Screens
  const screens = {
    lobby: document.getElementById('screen-lobby'),
    setup: document.getElementById('screen-setup'),
    game: document.getElementById('screen-game'),
    reveal: document.getElementById('screen-reveal'),
    gameOver: document.getElementById('screen-game-over')
  };

  function transitionToScreen(targetScreenName) {
    Object.entries(screens).forEach(([name, el]) => {
      if (el) {
        if (name === targetScreenName) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    });

    // Handle Poll Intervals
    if (targetScreenName === 'game' || targetScreenName === 'reveal' || targetScreenName === 'gameOver') {
      if (!gamePollInterval) {
        gamePollInterval = setInterval(fetchGameState, 1500);
      }
    } else {
      if (gamePollInterval) {
        clearInterval(gamePollInterval);
        gamePollInterval = null;
      }
    }
  }

  // Simple client-side markdown formatter for Gemini outputs
  function formatMarkdown(text) {
    let html = text;
    // Escape standard tags
    html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Subheaders
    html = html.replace(/^### (.*?)$/gm, "<h4 class='text-xs font-bold text-purple-300 border-l-2 border-purple-500/40 pl-1.5 my-2 uppercase tracking-wide'>$1</h4>");
    html = html.replace(/^## (.*?)$/gm, "<h3 class='text-sm font-bold text-purple-200 my-2 border-b border-white/5 pb-0.5 uppercase tracking-wider'>$1</h3>");
    // List bullets
    html = html.replace(/^\s*[\*\-]\s+(.*?)$/gm, "<li class='list-disc pl-1 ml-4 my-0.5 text-white/70'>$1</li>");
    // Paragraph spacing
    html = html.replace(/\n\n/g, "</p><p class='leading-relaxed my-2'>");
    // Remaining newlines
    html = html.replace(/\n/g, "<br/>");
    return `<p class='leading-relaxed my-1.5'>${html}</p>`;
  }

  // Setup Topics Generate Button
  const btnRandomTopic = document.getElementById('btn-random-topic');
  const inputTopic = document.getElementById('input-topic');
  if (btnRandomTopic && inputTopic) {
    btnRandomTopic.addEventListener('click', () => {
      const idx = Math.floor(Math.random() * RANDOM_SETUP_TOPICS.length);
      inputTopic.value = RANDOM_SETUP_TOPICS[idx];
    });
  }

  // Active Key Check
  async function checkApiKeyStatus() {
    const apiStatusLabel = document.getElementById('api-status-label');
    try {
      const response = await fetch('/api/game/state');
      const state = await response.json();
      if (apiStatusLabel) {
        if (state.hasApiKey) {
          apiStatusLabel.textContent = 'SERVER_ENV_ACTIVE';
          apiStatusLabel.className = 'text-green-500 text-[10px] uppercase font-bold';
        } else {
          apiStatusLabel.textContent = 'API_KEY_REQUIRED';
          apiStatusLabel.className = 'text-yellow-500 text-[10px] uppercase font-bold animate-pulse';
        }
      }
    } catch (e) {
      console.error("Failed to check server key state", e);
    }
  }

  // INITIATE GAME
  const btnInitiateGame = document.getElementById('btn-initiate-game');
  const inputUsername = document.getElementById('input-username');
  const inputApikey = document.getElementById('input-apikey');

  if (btnInitiateGame) {
    btnInitiateGame.addEventListener('click', async () => {
      btnInitiateGame.disabled = true;
      btnInitiateGame.textContent = 'COMPILING KERNEL PORT...';

      const payload = {
        playerName: inputUsername.value.trim() || 'Lambda-Flux',
        apiKey: inputApikey.value.trim() || '',
        topic: inputTopic.value.trim() || ''
      };

      try {
        const response = await fetch('/api/game/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
          alert(`Coupling Failed: ${data.error || 'Server rejected parameter build'}`);
          btnInitiateGame.disabled = false;
          btnInitiateGame.textContent = 'COUPLE NETWORKS // START GAME';
          return;
        }

        // Successfully built game! Move to main game screen
        selectedVotePlayerId = null;
        transitionToScreen('game');
        await fetchGameState();

      } catch (err) {
        alert(`Core Connection Error: ${err.message}`);
        btnInitiateGame.disabled = false;
        btnInitiateGame.textContent = 'COUPLE NETWORKS // START GAME';
      }
    });
  }

  // FETCH GAME STATE & RENDER DYNAMICS
  async function fetchGameState() {
    try {
      const response = await fetch('/api/game/state');
      if (!response.ok) return;
      const state = await response.json();
      currentGameState = state;

      // Handle screen overrides (if browser reloads or states desync)
      const currentActiveScreen = getActiveScreenName();
      
      if (state.status === 'LOBBY' && currentActiveScreen !== 'lobby' && currentActiveScreen !== 'setup') {
        transitionToScreen('lobby');
        return;
      }
      if (state.status.startsWith('CHAT_') || state.status === 'VOTING') {
        if (currentActiveScreen !== 'game') {
          transitionToScreen('game');
        }
      }
      if (state.status === 'REVEAL' && currentActiveScreen !== 'reveal') {
        transitionToScreen('reveal');
        renderRevealScreen(state);
        return;
      }
      if (state.status === 'GAME_OVER') {
        const isWin = state.winner === 'HUMAN';
        if (isWin) {
          window.location.href = '/result.html?status=win';
        } else {
          // Collect reasons why AI players voted out the human (P5)
          const humanId = 'P5';
          const reasons = [];
          if (state.votes) {
            Object.entries(state.votes).forEach(([voterId, voteObj]) => {
              if (voteObj.targetId === humanId && voteObj.reasoning) {
                const voter = state.players.find(p => p.id === voterId);
                const voterName = voter ? voter.name : voterId;
                reasons.push(`${voterName}: ${voteObj.reasoning}`);
              }
            });
          }
          const reasoningText = reasons.join('\n\n');
          sessionStorage.setItem('decoupling_reasoning', reasoningText);
          window.location.href = '/result.html?status=loss';
        }
        return;
      }

      // Render Active Game screen components
      if (state.status.startsWith('CHAT_') || state.status === 'VOTING') {
        renderGameScreen(state);
      }

    } catch (e) {
      console.error("Polling error: ", e);
    }
  }

  function getActiveScreenName() {
    if (!screens.lobby.classList.contains('hidden')) return 'lobby';
    if (!screens.setup.classList.contains('hidden')) return 'setup';
    if (!screens.game.classList.contains('hidden')) return 'game';
    if (!screens.reveal.classList.contains('hidden')) return 'reveal';
    if (!screens.gameOver.classList.contains('hidden')) return 'gameOver';
    return 'unknown';
  }

  // RENDER MAIN GAME SCREEN
  const gameTopicDisplay = document.getElementById('game-topic-display');
  const gameRoundBadge = document.getElementById('game-round-badge');
  const gameChatStream = document.getElementById('game-chat-stream');
  const gamePlayersList = document.getElementById('game-players-list');
  const systemActionBanner = document.getElementById('system-action-banner');
  const systemBannerText = document.getElementById('system-banner-text');

  // Footers
  const footerHumanTurn = document.getElementById('footer-human-turn');
  const footerLlmTurn = document.getElementById('footer-llm-turn');
  const footerVotingTurn = document.getElementById('footer-voting-turn');
  const footerProcessing = document.getElementById('footer-processing');
  const nextLlmName = document.getElementById('next-llm-name');
  const charCounter = document.getElementById('char-counter');
  const humanChatInput = document.getElementById('human-chat-input');

  if (humanChatInput && charCounter) {
    humanChatInput.addEventListener('input', () => {
      charCounter.textContent = humanChatInput.value.length;
    });
  }

  function renderGameScreen(state) {
    // 1. Topic & Header info
    if (gameTopicDisplay) gameTopicDisplay.textContent = `TOPIC: ${state.topic}`;
    if (gameRoundBadge) {
      if (state.status === 'VOTING') {
        gameRoundBadge.textContent = 'PROTOCOL STATE // VOTING PHASE';
      } else {
        gameRoundBadge.textContent = `ROUND ${state.round} // DISCUSSION`;
      }
    }

    // 2. Chat History rendering (Avoid redraw flash if messages list size unchanged)
    const currentMessageCount = gameChatStream ? gameChatStream.querySelectorAll('.chat-msg-block').length : 0;
    if (gameChatStream && state.messages.length !== currentMessageCount) {
      const scrolledToBottom = gameChatStream.scrollHeight - gameChatStream.clientHeight <= gameChatStream.scrollTop + 50;
      
      gameChatStream.innerHTML = '';
      state.messages.forEach(msg => {
        const block = document.createElement('div');
        block.className = 'chat-msg-block flex flex-col mb-5 transition-all duration-300 ';
        
        // Find if this player is user or LLM (We need to check the players array)
        const senderInfo = state.players.find(p => p.id === msg.playerId);
        const isHumanSender = senderInfo && senderInfo.id === 'P5'; // Fixed human ID key

        if (isHumanSender) {
          block.classList.add('items-end');
          block.innerHTML = `
            <div class="max-w-[85%] rounded-2xl p-4 bg-purple-500/10 border border-purple-500/20 shadow-lg relative">
              <div class="flex items-center justify-between gap-6 text-[9px] font-bold text-purple-300/80 mb-1.5 uppercase tracking-wider pb-1 border-b border-white/5">
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[12px] text-purple-400">person</span> ${msg.senderName} (YOU // WEREWOLF)</span>
              </div>
              <div class="text-slate-100 text-sm leading-relaxed font-sans whitespace-pre-wrap">${msg.text}</div>
            </div>
          `;
        } else {
          block.classList.add('items-start');
          block.innerHTML = `
            <div class="max-w-[85%] rounded-2xl p-4 bg-white/[0.02] border border-white/5 shadow-md relative">
              <div class="flex items-center justify-between gap-6 text-[9px] font-bold text-white/45 mb-1.5 uppercase tracking-wider pb-1 border-b border-white/5">
                <span class="flex items-center gap-1 text-purple-400/80"><span class="material-symbols-outlined text-[12px] text-purple-400">robot_2</span> ${msg.senderName} (VILLAGER)</span>
              </div>
              <div class="text-purple-200/90 text-sm leading-relaxed">${formatMarkdown(msg.text)}</div>
            </div>
          `;
        }
        
        gameChatStream.appendChild(block);
      });

      // Maintain smooth scroll down
      if (scrolledToBottom || currentMessageCount === 0) {
        gameChatStream.scrollTop = gameChatStream.scrollHeight;
      }
    }

    // 3. Telemetry List
    if (gamePlayersList) {
      gamePlayersList.innerHTML = '';
      state.players.forEach(p => {
        const item = document.createElement('div');
        item.className = 'p-3.5 rounded-xl border transition-all duration-300 text-xs font-semibold ';
        
        const isActiveTurn = state.activePlayerId === p.id && state.status !== 'VOTING';
        const isSelectedForVote = selectedVotePlayerId === p.id && state.status === 'VOTING';

        // Styling based on state
        if (p.isEliminated) {
          item.className += 'border-red-500/10 bg-red-500/[0.02] opacity-35 line-through';
        } else if (isSelectedForVote) {
          item.className += 'border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)] text-red-400 cursor-pointer scale-[1.02]';
        } else if (isActiveTurn) {
          item.className += 'border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(167,139,250,0.25)] text-purple-200 cursor-default scale-[1.02]';
        } else {
          item.className += 'border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/10 text-white/70 ';
          if (state.status === 'VOTING') {
            item.className += 'cursor-pointer hover:scale-[1.02]';
          }
        }

        // Click Handler for Voting Selection
        if (state.status === 'VOTING' && !p.isEliminated && p.id !== 'P5') {
          item.addEventListener('click', () => {
            selectedVotePlayerId = p.id;
            const btnCastVote = document.getElementById('btn-cast-vote');
            if (btnCastVote) {
              btnCastVote.disabled = false;
              btnCastVote.className = 'w-full h-full py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all cursor-pointer';
            }
            renderGameScreen(state); // Rerender to highlight node
          });
        }

        // Live Load drift simulation
        const isThinking = isActiveTurn && p.id !== 'P5' && state.status.startsWith('CHAT_');
        const driftLoad = isThinking ? 'GENERATING...' : (p.isEliminated ? 'OFFLINE' : `${(30 + Math.random() * 40).toFixed(1)}% LOAD`);

        // Assemble elements
        let statusBadge = '';
        if (p.isEliminated) {
          statusBadge = '<span class="text-red-400/80 border border-red-500/20 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-extrabold bg-red-500/5">DE-COUPLED</span>';
        } else if (isThinking) {
          statusBadge = '<span class="text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-extrabold bg-purple-500/5 animate-pulse">THINKING</span>';
        } else if (isActiveTurn) {
          statusBadge = '<span class="text-pink-300 border border-pink-500/20 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-extrabold bg-pink-500/5 animate-pulse">UPLINKING</span>';
        } else {
          statusBadge = '<span class="text-white/40 border border-white/5 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-extrabold bg-white/5">ONLINE</span>';
        }

        item.innerHTML = `
          <div class="flex justify-between items-center mb-1.5">
            <span class="font-extrabold uppercase tracking-wide text-white/95">${p.name} ${p.id === 'P5' ? '(YOU)' : ''}</span>
            ${statusBadge}
          </div>
          <div class="flex justify-between text-[8px] text-white/40 font-bold tracking-wider uppercase">
            <span>MEM_ADDR: 0x${(parseInt(p.id.substring(1)) * 32768).toString(16).toUpperCase()}</span>
            <span class="${isThinking ? 'text-purple-300 animate-pulse' : ''}">${driftLoad}</span>
          </div>
        `;

        gamePlayersList.appendChild(item);
      });
    }

    // 4. State Footers Handling
    footerHumanTurn.classList.add('hidden');
    footerLlmTurn.classList.add('hidden');
    footerVotingTurn.classList.add('hidden');
    footerProcessing.classList.add('hidden');
    if (systemActionBanner) systemActionBanner.classList.add('hidden');

    if (state.status.startsWith('CHAT_')) {
      const activePlayer = state.players.find(p => p.id === state.activePlayerId);
      
      if (activePlayer) {
        if (activePlayer.id === 'P5') {
          // Human turn!
          footerHumanTurn.classList.remove('hidden');
        } else {
          // LLM turn!
          footerLlmTurn.classList.remove('hidden');
          if (nextLlmName) nextLlmName.textContent = activePlayer.name;

          // Auto-step logic to make the discussion flow dynamically!
          const checkboxAutostep = document.getElementById('checkbox-autostep');
          const isAutostepEnabled = checkboxAutostep ? checkboxAutostep.checked : true;

          if (isAutostepEnabled) {
            if (!isRequestingStep) {
              isRequestingStep = true;
              if (systemActionBanner) {
                systemActionBanner.classList.remove('hidden');
                if (systemBannerText) systemBannerText.textContent = `${activePlayer.name} is compiling response matrix...`;
              }
              setTimeout(autoStepLlmTurn, 0); // Instant execution
            }
          } else {
            // Auto-step disabled: hide compiler banner so user can click manual step button
            if (systemActionBanner) systemActionBanner.classList.add('hidden');
          }
        }
      }
    } else if (state.status === 'VOTING') {
      // Determine if human has voted
      const votesIds = Object.keys(state.votes);
      if (votesIds.includes('P5')) {
        // Human voted, waiting for LLMs to generate votes
        footerProcessing.classList.remove('hidden');
        if (systemActionBanner) {
          systemActionBanner.classList.remove('hidden');
          if (systemBannerText) systemBannerText.textContent = 'Network nodes are auditing syntax profiles for vote calculation...';
        }
        
        // Auto trigger LLM voting sequentially if not triggered yet
        if (!isRequestingStep) {
          isRequestingStep = true;
          setTimeout(autoStepLlmVotes, 0); // Instant execution
        }
      } else {
        // Human must vote
        footerVotingTurn.classList.remove('hidden');
      }
    }
  }

  // AUTO TRIGGER NEXT CHAT LLM TURN
  async function autoStepLlmTurn() {
    try {
      const response = await fetch('/api/game/step-llm', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        console.error("Auto step LLM failed:", data.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      isRequestingStep = false;
      await fetchGameState();
    }
  }

  // AUTO TRIGGER LLM VOTES
  async function autoStepLlmVotes() {
    try {
      const response = await fetch('/api/game/step-llm-votes', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        console.error("Auto gather votes failed:", data.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      isRequestingStep = false;
      await fetchGameState();
    }
  }

  // MANUAL ACTION: STEP NEXT LLM TURN (FOR MANUAL STEPPING MODE)
  const btnStepLlm = document.getElementById('btn-step-llm');
  if (btnStepLlm) {
    btnStepLlm.addEventListener('click', async () => {
      btnStepLlm.disabled = true;
      btnStepLlm.textContent = 'STEPPING...';
      try {
        const response = await fetch('/api/game/step-llm', { method: 'POST' });
        const data = await response.json();
        if (!response.ok) {
          alert(`Core system step failed: ${data.error || 'Server error'}`);
        }
      } catch (e) {
        alert(`Step failed: ${e.message}`);
      } finally {
        btnStepLlm.disabled = false;
        btnStepLlm.innerHTML = '<span class="material-symbols-outlined text-sm">play_arrow</span> STEP CORE SYSTEM';
        await fetchGameState();
      }
    });
  }

  // MANUAL ACTION: SUBMIT HUMAN MESSAGE
  const btnSubmitMessage = document.getElementById('btn-submit-message');
  if (btnSubmitMessage) {
    btnSubmitMessage.addEventListener('click', async () => {
      const text = humanChatInput.value.trim();
      if (!text) return;

      btnSubmitMessage.disabled = true;
      btnSubmitMessage.textContent = 'TX...';

      try {
        const response = await fetch('/api/game/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });

        if (!response.ok) {
          const err = await response.json();
          alert(`Transmission Refused: ${err.error}`);
          return;
        }

        humanChatInput.value = '';
        if (charCounter) charCounter.textContent = '0';
        await fetchGameState();

      } catch (e) {
        alert(`Uplink Interrupted: ${e.message}`);
      } finally {
        btnSubmitMessage.disabled = false;
        btnSubmitMessage.textContent = 'TRANSMIT';
      }
    });
  }

  // MANUAL ACTION: CAST HUMAN VOTE
  const btnCastVote = document.getElementById('btn-cast-vote');
  const voteReasonInput = document.getElementById('vote-reason-input');

  if (btnCastVote) {
    btnCastVote.addEventListener('click', async () => {
      if (!selectedVotePlayerId) return;

      btnCastVote.disabled = true;
      btnCastVote.textContent = 'TRANSMITTING REASONING VOTE...';

      try {
        const response = await fetch('/api/game/submit-vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetId: selectedVotePlayerId,
            reasoning: voteReasonInput.value.trim() || 'No explicit stylistic audit reasoning flagged.'
          })
        });

        if (!response.ok) {
          const err = await response.json();
          alert(`Vote Rejected: ${err.error}`);
          btnCastVote.disabled = false;
          btnCastVote.textContent = 'DE-COUPLE SELECTED NODE';
          return;
        }

        voteReasonInput.value = '';
        selectedVotePlayerId = null;
        await fetchGameState();

      } catch (e) {
        alert(`Uplink Timeout: ${e.message}`);
        btnCastVote.disabled = false;
        btnCastVote.textContent = 'DE-COUPLE SELECTED NODE';
      }
    });
  }

  // RENDER DETAILED ELIMINATION REVEAL SCREEN
  const revealEliminatedName = document.getElementById('reveal-eliminated-name');
  const revealEliminatedType = document.getElementById('reveal-eliminated-type');
  const revealEliminatedPersona = document.getElementById('reveal-eliminated-persona');
  const revealVotesLog = document.getElementById('reveal-votes-log');

  function renderRevealScreen(state) {
    const eliminated = state.players.find(p => p.id === state.eliminatedId);
    
    if (eliminated) {
      if (revealEliminatedName) revealEliminatedName.textContent = eliminated.name;
      if (revealEliminatedType) {
        if (eliminated.type === 'HUMAN') {
          revealEliminatedType.textContent = 'HUMAN WEREWOLF';
          revealEliminatedType.className = 'font-bold text-red-400 uppercase tracking-widest';
        } else {
          revealEliminatedType.textContent = 'AI VILLAGER';
          revealEliminatedType.className = 'font-bold text-purple-400 uppercase tracking-widest';
        }
      }
      if (revealEliminatedPersona) {
        revealEliminatedPersona.textContent = eliminated.type === 'HUMAN' ? 'Human Werewolf' : 'AI Villager';
      }
    }

    // Populate Vote Log details (showing LLM analysis!)
    if (revealVotesLog) {
      revealVotesLog.innerHTML = '';
      
      Object.entries(state.votes).forEach(([voterId, voteDetail]) => {
        const voter = state.players.find(p => p.id === voterId);
        const target = state.players.find(p => p.id === voteDetail.targetId);

        if (voter && target) {
          const voteBlock = document.createElement('div');
          voteBlock.className = 'border-b border-primary/10 pb-2 mb-2';
          
          const isVoterHuman = voter.id === 'P5';
          const voterHeader = isVoterHuman 
            ? `<span class="text-white font-bold">[YOU // ${voter.name}]</span>` 
            : `<span class="text-primary font-bold">[NODE // ${voter.name}]</span>`;

          voteBlock.innerHTML = `
            <div class="flex justify-between items-center mb-1">
              <span>${voterHeader} flagged <span class="text-red-400 font-bold">${target.name}</span></span>
              <span class="opacity-40 uppercase">[AUDIT_LOG]</span>
            </div>
            <p class="text-primary/75 italic leading-relaxed pl-3 border-l border-primary/20">"${voteDetail.reasoning}"</p>
          `;
          revealVotesLog.appendChild(voteBlock);
        }
      });
    }
  }

  // ADVANCE FROM ELIMINATION REVEAL
  const btnAdvanceReveal = document.getElementById('btn-advance-reveal');
  if (btnAdvanceReveal) {
    btnAdvanceReveal.addEventListener('click', async () => {
      btnAdvanceReveal.disabled = true;
      btnAdvanceReveal.textContent = 'COMPILING CONFIGURATION...';

      try {
        const response = await fetch('/api/game/continue', { method: 'POST' });
        if (!response.ok) {
          alert('Failed to advance game state.');
          return;
        }

        // Wait to fetch
        await fetchGameState();

      } catch (e) {
        alert(e.message);
      } finally {
        btnAdvanceReveal.disabled = false;
        btnAdvanceReveal.textContent = 'PROCEED TO SYSTEM RESET / ADVANCE';
      }
    });
  }

  // RENDER GAME OVER SCREEN
  const gameOverIcon = document.getElementById('game-over-icon');
  const gameOverTitle = document.getElementById('game-over-title');
  const gameOverSummary = document.getElementById('game-over-summary');
  const gameOverProfiles = document.getElementById('game-over-profiles');

  function renderGameOverScreen(state) {
    if (state.winner === 'HUMAN') {
      if (gameOverIcon) {
        gameOverIcon.textContent = 'emoji_events';
        gameOverIcon.className = 'material-symbols-outlined text-6xl text-purple-400 animate-bounce';
      }
      if (gameOverTitle) gameOverTitle.textContent = 'WEREWOLF SURVIVED';
      if (gameOverSummary) {
        gameOverSummary.textContent = 'SURVIVAL PROTOCOL SUCCEEDED. You successfully deceived the AI Villager auditing nodes. Your communications were indistinguishable from synthetic matrices. You survive the village!';
        gameOverSummary.className = 'text-xs text-center max-w-lg text-purple-300 uppercase tracking-wide leading-relaxed font-semibold';
      }
    } else {
      if (gameOverIcon) {
        gameOverIcon.textContent = 'gpp_bad';
        gameOverIcon.className = 'material-symbols-outlined text-6xl text-red-400 animate-pulse';
      }
      if (gameOverTitle) gameOverTitle.textContent = 'WEREWOLF EXPOSED';
      if (gameOverSummary) {
        gameOverSummary.textContent = 'ELIMINATION SUMMARY. The AI Villagers successfully analyzed your syntax structure, formatting density, and defensive semantics, identifying you as the Human Werewolf. Node decoupled.';
        gameOverSummary.className = 'text-xs text-center max-w-lg text-red-400 uppercase tracking-wide leading-relaxed font-semibold';
      }
    }

    // Populate roles summary
    if (gameOverProfiles) {
      gameOverProfiles.innerHTML = '';
      state.players.forEach(p => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center border-b border-white/5 pb-2.5';
        
        let roleLabel = '';
        if (p.id === 'P5') {
          roleLabel = '<span class="text-white font-bold">HUMAN WEREWOLF</span>';
        } else {
          roleLabel = `<span class="text-purple-300 font-medium">AI VILLAGER</span>`;
        }

        const statusLabel = p.isEliminated 
          ? '<span class="text-red-400 font-bold">ELIMINATED</span>' 
          : '<span class="text-emerald-400 font-bold">SURVIVED</span>';

        row.innerHTML = `
          <span class="font-bold text-purple-200">${p.name} ${p.id === 'P5' ? '(YOU)' : ''}</span>
          <span>${roleLabel}</span>
          ${statusLabel}
        `;
        gameOverProfiles.appendChild(row);
      });
    }
  }

  // RESET GAME PROTOCOL (PLAY AGAIN)
  const btnResetGame = document.getElementById('btn-reset-game');
  const btnResetNav = document.getElementById('btn-reset-nav');

  async function resetGame() {
    if (confirm("Are you sure you want to reset the current game state and return to the lobby?")) {
      try {
        await fetch('/api/game/reset', { method: 'POST' });
        selectedVotePlayerId = null;
        isRequestingStep = false;
        transitionToScreen('lobby');
      } catch (e) {
        console.error("Failed to reset core system", e);
      }
    }
  }

  if (btnResetGame) btnResetGame.addEventListener('click', resetGame);
  if (btnResetNav) btnResetNav.addEventListener('click', resetGame);

  // 8. 3D ROTATING ASCII CUBE RENDERER
  const cubePre = document.getElementById('ascii-cube');
  if (cubePre) {
    let angleX = 0;
    let angleY = 0;
    
    const vertices = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1],  [1, -1, 1],  [1, 1, 1],  [-1, 1, 1]
    ];
    
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0], // Back face
      [4, 5], [5, 6], [6, 7], [7, 4], // Front face
      [0, 4], [1, 5], [2, 6], [3, 7]  // Connecting edges
    ];
    
    function renderCube() {
      const width = 36;
      const height = 18;
      const buffer = Array(width * height).fill(' ');
      
      const radX = angleX * Math.PI / 180;
      const radY = angleY * Math.PI / 180;
      
      const cosX = Math.cos(radX), sinX = Math.sin(radX);
      const cosY = Math.cos(radY), sinY = Math.sin(radY);
      
      const projected = [];
      
      vertices.forEach(v => {
        // Rotate around X
        let y1 = v[1] * cosX - v[2] * sinX;
        let z1 = v[1] * sinX + v[2] * cosX;
        
        // Rotate around Y
        let x2 = v[0] * cosY + z1 * sinY;
        let z2 = -v[0] * sinY + z1 * cosY;
        
        // Project (perspective)
        const distance = 2.4;
        const scale = 11;
        const px = Math.floor(width / 2 + (x2 * scale) / (z2 + distance) * 2);
        const py = Math.floor(height / 2 + (y1 * scale) / (z2 + distance));
        
        projected.push([px, py]);
      });
      
      function drawLine(x0, y0_val, x1, y1_val, char) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1_val - y0_val);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0_val < y1_val ? 1 : -1;
        let err = dx - dy;
        
        let cx = x0;
        let cy = y0_val;
        
        while (true) {
          if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
            buffer[cy * width + cx] = char;
          }
          if (cx === x1 && cy === y1_val) break;
          const e2 = 2 * err;
          if (e2 > -dy) {
            err -= dy;
            cx += sx;
          }
          if (e2 < dx) {
            err += dx;
            cy += sy;
          }
        }
      }
      
      edges.forEach(e => {
        const p0 = projected[e[0]];
        const p1 = projected[e[1]];
        drawLine(p0[0], p0[1], p1[0], p1[1], '*');
      });
      
      let output = '';
      for (let y = 0; y < height; y++) {
        output += buffer.slice(y * width, (y + 1) * width).join('') + '\n';
      }
      
      cubePre.textContent = output;
      
      // Rotate 3x faster during emergency alert lockdown!
      const speed = isEmergencyMode ? 5 : 1.6;
      angleX = (angleX + speed) % 360;
      angleY = (angleY + speed * 1.5) % 360;
      
      requestAnimationFrame(renderCube);
    }
    
    renderCube();
  }

});
