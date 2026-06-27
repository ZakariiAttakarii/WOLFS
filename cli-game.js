#!/usr/bin/env node

/**
 * WOLFS CLI Testing Utility & Interactive Client
 * Designed for testing "The Werewolf Matrix" server and APIs directly from the CLI.
 * Supports individual command triggers and a full-featured interactive play loop!
 */

const http = require('http');
const readline = require('readline');

const SERVER_URL = 'http://localhost:8080';
const DEFAULT_PORT = 8080;

// ANSI Colors for premium terminal styling
const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

// Helper for HTTP requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || DEFAULT_PORT,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': 'cli_session'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ statusCode: res.statusCode, error: parsed.error || data });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject({ statusCode: res.statusCode, error: data });
          } else {
            resolve(data);
          }
        }
      });
    });

    req.on('error', (err) => {
      reject({ error: `Connection refused. Is the server running? (${err.message})` });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Readline interface for CLI interactive mode
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// Print a gorgeous banner
function printBanner() {
  console.log(`\n${Colors.bright}${Colors.magenta}================================================================${Colors.reset}`);
  console.log(`${Colors.bright}${Colors.cyan}            W O L F S   M A T R I X   C L I   C L I E N T       ${Colors.reset}`);
  console.log(`${Colors.bright}${Colors.magenta}================================================================${Colors.reset}\n`);
}

// 1. GET GAME STATE Command
async function handleState() {
  try {
    const state = await request('GET', '/api/game/state');
    console.log(`\n${Colors.bright}${Colors.cyan}--- Current Game State ---${Colors.reset}`);
    console.log(`${Colors.bright}Status:${Colors.reset} ${statusColor(state.status)}`);
    console.log(`${Colors.bright}Topic:${Colors.reset} ${state.topic ? `"${state.topic}"` : 'None (Lobby)'}`);
    console.log(`${Colors.bright}Round:${Colors.reset} ${state.round}`);
    
    console.log(`\n${Colors.bright}${Colors.green}Players:${Colors.reset}`);
    state.players.forEach(p => {
      const activeMarker = state.activePlayerId === p.id ? `${Colors.bright}${Colors.yellow}◀ SPEAKING${Colors.reset}` : '';
      const eliminatedMarker = p.isEliminated ? `${Colors.red}[ELIMINATED]${Colors.reset}` : `${Colors.green}[ACTIVE]${Colors.reset}`;
      console.log(`  - ${Colors.bright}${p.id}:${Colors.reset} ${p.name.padEnd(10)} | Type: ${p.type.padEnd(5)} | Status: ${eliminatedMarker} ${activeMarker}`);
    });

    console.log(`\n${Colors.bright}${Colors.blue}Messages Logged: ${state.messages.length}${Colors.reset}`);
    state.messages.forEach(m => {
      console.log(`  [Round ${m.round}] ${Colors.bright}${m.senderName}${Colors.reset}: "${m.text}"`);
    });

    if (state.eliminatedId) {
      const p = state.players.find(pl => pl.id === state.eliminatedId);
      console.log(`\n${Colors.bright}${Colors.red}Last Eliminated Player:${Colors.reset} ${p ? p.name : state.eliminatedId}`);
    }

    if (state.winner) {
      console.log(`\n${Colors.bright}${Colors.bgGreen}${Colors.white}  GAME OVER - WINNER: ${state.winner}  ${Colors.reset}\n`);
    }
  } catch (err) {
    console.error(`${Colors.red}Error fetching state:${Colors.reset}`, err.error || err);
  }
}

function statusColor(status) {
  switch (status) {
    case 'LOBBY': return `${Colors.cyan}${status}${Colors.reset}`;
    case 'SETUP': return `${Colors.yellow}${status}${Colors.reset}`;
    case 'CHAT_ROUND_1': return `${Colors.green}CHAT ROUND 1${Colors.reset}`;
    case 'CHAT_ROUND_2': return `${Colors.green}CHAT ROUND 2${Colors.reset}`;
    case 'VOTING': return `${Colors.red}VOTING PHASE${Colors.reset}`;
    case 'REVEAL': return `${Colors.magenta}REVEAL PHASE${Colors.reset}`;
    case 'GAME_OVER': return `${Colors.bright}${Colors.red}GAME OVER${Colors.reset}`;
    default: return status;
  }
}

// 2. SETUP Game Command
async function handleSetup(playerName, topic) {
  try {
    const res = await request('POST', '/api/game/setup', {
      playerName: playerName || "Operator_CLI",
      topic: topic || ""
    });
    console.log(`${Colors.green}✔ ${res.message}${Colors.reset}`);
    await handleState();
  } catch (err) {
    console.error(`${Colors.red}Error setting up game:${Colors.reset}`, err.error || err);
  }
}

// 3. SEND MESSAGE Command
async function handleMessage(message) {
  try {
    const res = await request('POST', '/api/game/message', { message });
    console.log(`${Colors.green}✔ Message submitted successfully!${Colors.reset}`);
  } catch (err) {
    console.error(`${Colors.red}Error sending message:${Colors.reset}`, err.error || err);
  }
}

// 4. STEP LLM Command
async function handleStep() {
  try {
    console.log(`${Colors.yellow}Stepping LLM... (Making API call to Gemini-2.5-Flash)${Colors.reset}`);
    const res = await request('POST', '/api/game/step-llm');
    if (res.waitingForHuman) {
      console.log(`${Colors.yellow}ℹ Waiting for human turn. Please submit a message!${Colors.reset}`);
    } else {
      console.log(`${Colors.green}✔ ${res.message}${Colors.reset}`);
    }
  } catch (err) {
    console.error(`${Colors.red}Error stepping LLM:${Colors.reset}`, err.error || err);
  }
}

// 5. VOTE Command
async function handleVote(targetId, reasoning) {
  try {
    const res = await request('POST', '/api/game/submit-vote', { targetId, reasoning });
    console.log(`${Colors.green}✔ Vote submitted for player ${targetId}!${Colors.reset}`);
  } catch (err) {
    console.error(`${Colors.red}Error submitting vote:${Colors.reset}`, err.error || err);
  }
}

// 6. PROCESS VOTES Command
async function handleProcessVotes() {
  try {
    console.log(`${Colors.yellow}Generating votes for LLMs via Gemini...${Colors.reset}`);
    const res = await request('POST', '/api/game/step-llm-votes');
    console.log(`${Colors.green}✔ Votes processed!${Colors.reset}`);
    console.log(`${Colors.bright}Eliminated: ${Colors.red}${res.eliminatedId}${Colors.reset}`);
    console.log(`${Colors.bright}New Status: ${statusColor(res.status)}${Colors.reset}`);
    if (res.winner) {
      console.log(`\n${Colors.bright}${Colors.bgGreen}${Colors.white} WINNER: ${res.winner} ${Colors.reset}\n`);
    }
  } catch (err) {
    console.error(`${Colors.red}Error processing votes:${Colors.reset}`, err.error || err);
  }
}

// 7. CONTINUE Command
async function handleContinue() {
  try {
    const res = await request('POST', '/api/game/continue');
    console.log(`${Colors.green}✔ Game advanced to next round topic!${Colors.reset}`);
  } catch (err) {
    console.error(`${Colors.red}Error advancing game:${Colors.reset}`, err.error || err);
  }
}

// 8. RESET Command
async function handleReset() {
  try {
    const res = await request('POST', '/api/game/reset');
    console.log(`${Colors.green}✔ Game state reset back to LOBBY!${Colors.reset}`);
  } catch (err) {
    console.error(`${Colors.red}Error resetting game:${Colors.reset}`, err.error || err);
  }
}

// 9. FULL INTERACTIVE GAMEPLAY LOOP
async function handlePlay() {
  printBanner();
  console.log(`${Colors.cyan}Starting/Connecting to game stream...${Colors.reset}`);
  
  let state;
  try {
    state = await request('GET', '/api/game/state');
  } catch (err) {
    console.error(`${Colors.red}Could not connect to server at ${SERVER_URL}:${Colors.reset}`, err.error || err);
    console.log(`${Colors.yellow}Please ensure your server is running by executing: npm start${Colors.reset}\n`);
    process.exit(1);
  }

  // If in LOBBY, ask user to setup game
  if (state.status === 'LOBBY') {
    console.log(`${Colors.yellow}No active game session found. Let's create one!${Colors.reset}`);
    const name = await askQuestion(`${Colors.bright}Enter your alias (default: Operator_CLI): ${Colors.reset}`);
    const topic = await askQuestion(`${Colors.bright}Enter custom topic (press enter for random): ${Colors.reset}`);
    
    await handleSetup(name.trim(), topic.trim());
    state = await request('GET', '/api/game/state');
  }

  // Main gameplay execution loop
  while (true) {
    console.clear();
    printBanner();
    
    // Refresh state
    state = await request('GET', '/api/game/state');

    console.log(`${Colors.bright}Active Topic:${Colors.reset} ${Colors.cyan}"${state.topic}"${Colors.reset}`);
    console.log(`${Colors.bright}Phase:${Colors.reset} ${statusColor(state.status)} | ${Colors.bright}Round:${Colors.reset} ${state.round}`);
    
    // Display Players
    console.log(`\n${Colors.bright}${Colors.green}--- Active Players ---${Colors.reset}`);
    state.players.forEach(p => {
      const activeMarker = state.activePlayerId === p.id ? `${Colors.bright}${Colors.yellow} ◀ ACTIVE SPEAKING TURN${Colors.reset}` : '';
      const statusMarker = p.isEliminated ? `${Colors.red}[ELIMINATED]${Colors.reset}` : `${Colors.green}[ACTIVE]${Colors.reset}`;
      console.log(` - [${p.id}] ${Colors.bright}${p.name.padEnd(10)}${Colors.reset} | Type: ${p.type.padEnd(5)} | Status: ${statusMarker}${activeMarker}`);
    });

    // Display Message History
    console.log(`\n${Colors.bright}${Colors.blue}--- Discussion Feed (${state.messages.length} messages) ---${Colors.reset}`);
    if (state.messages.length === 0) {
      console.log(`${Colors.dim}  No messages in active logs yet.${Colors.reset}`);
    } else {
      state.messages.forEach(m => {
        const sender = state.players.find(p => p.name === m.senderName);
        const nameColor = sender?.type === 'HUMAN' ? Colors.magenta : Colors.cyan;
        console.log(`  ${nameColor}[${m.senderName}]${Colors.reset} (Round ${m.round}): ${m.text}`);
      });
    }

    // GAME OVER State
    if (state.status === 'GAME_OVER') {
      console.log(`\n${Colors.bright}${Colors.bgGreen}${Colors.white}================================================================${Colors.reset}`);
      console.log(`${Colors.bright}${Colors.bgGreen}${Colors.white}                 GAME OVER - WINNER: ${state.winner.toUpperCase()}               ${Colors.reset}`);
      console.log(`${Colors.bright}${Colors.bgGreen}${Colors.white}================================================================${Colors.reset}\n`);
      
      console.log(`${Colors.bright}Final Votes Summary:${Colors.reset}`);
      state.players.forEach(p => {
        const vote = state.votes[p.id];
        if (vote) {
          const target = state.players.find(pl => pl.id === vote.targetId);
          console.log(`  - ${Colors.bright}${p.name}${Colors.reset} voted for ${Colors.red}${target ? target.name : vote.targetId}${Colors.reset}`);
          console.log(`    ${Colors.dim}Reasoning: ${vote.reasoning}${Colors.reset}`);
        }
      });

      const choice = await askQuestion(`\nWould you like to reset and start a new game? (y/n): `);
      if (choice.trim().toLowerCase() === 'y') {
        await handleReset();
        continue;
      } else {
        break;
      }
    }

    // REVEAL Phase
    if (state.status === 'REVEAL') {
      const elimPlayer = state.players.find(p => p.id === state.eliminatedId);
      console.log(`\n${Colors.bright}${Colors.bgRed}${Colors.white}                  ELIMINATION OUTCOME                           ${Colors.reset}`);
      console.log(`  Player ${Colors.bright}${elimPlayer ? elimPlayer.name : state.eliminatedId}${Colors.reset} has been voted out by majority consensus!`);
      console.log(`  Their true identity is: ${Colors.bright}${elimPlayer?.type === 'HUMAN' ? 'HUMAN WEREWOLF' : 'AI VILLAGER'}${Colors.reset}\n`);

      console.log(`${Colors.bright}Round Votes:${Colors.reset}`);
      Object.entries(state.votes).forEach(([voterId, vote]) => {
        const voter = state.players.find(p => p.id === voterId);
        const target = state.players.find(p => p.id === vote.targetId);
        console.log(`  - ${Colors.bright}${voter ? voter.name : voterId}${Colors.reset} suspected ${Colors.yellow}${target ? target.name : vote.targetId}${Colors.reset}`);
        console.log(`    ${Colors.dim}Reasoning: ${vote.reasoning}${Colors.reset}`);
      });

      await askQuestion(`\nPress ${Colors.bright}[Enter]${Colors.reset} to continue to the next round with a new topic...`);
      await handleContinue();
      continue;
    }

    // CHAT ROUNDS Logic
    if (state.status === 'CHAT_ROUND_1' || state.status === 'CHAT_ROUND_2') {
      const activePlayer = state.players[state.activePlayerIndex];
      if (!activePlayer) {
        console.log(`${Colors.red}Critical: speak queue index is out of bounds.${Colors.reset}`);
        break;
      }

      console.log(`\n${Colors.bright}${Colors.yellow}--- Current Turn ---${Colors.reset}`);
      if (activePlayer.type === 'HUMAN') {
        console.log(`${Colors.bright}${Colors.magenta}Your Turn! Write your response (under 130 words) to blend in with the AI bots:${Colors.reset}`);
        const userMsg = await askQuestion(`> `);
        if (userMsg.trim().length > 0) {
          await handleMessage(userMsg.trim());
        }
      } else {
        console.log(`It's ${Colors.bright}${activePlayer.name}'s${Colors.reset} turn (AI Bot).`);
        await askQuestion(`Press ${Colors.bright}[Enter]${Colors.reset} to trigger Gemini to generate their statement...`);
        await handleStep();
      }
      continue;
    }

    // VOTING Phase Logic
    if (state.status === 'VOTING') {
      console.log(`\n${Colors.bright}${Colors.red}--- Voting Round ---${Colors.reset}`);
      console.log(`Analyze the statements of other players above and find the AI bots/Human Werewolf!`);
      
      const humanPlayer = state.players.find(p => p.type === 'HUMAN');
      const alreadyVoted = state.votes[humanPlayer?.id] !== undefined;

      if (!alreadyVoted) {
        console.log(`\nAvailable Candidates to Suspect:`);
        const candidates = state.players.filter(p => !p.isEliminated && p.type !== 'HUMAN');
        candidates.forEach((c, idx) => {
          console.log(`  ${idx + 1}. [${c.id}] ${Colors.bright}${c.name}${Colors.reset}`);
        });

        const choiceIndexStr = await askQuestion(`\nEnter the number of the player you suspect: `);
        const choiceIdx = parseInt(choiceIndexStr) - 1;
        
        if (choiceIdx >= 0 && choiceIdx < candidates.length) {
          const selected = candidates[choiceIdx];
          const reasoning = await askQuestion(`Provide a brief reasoning for your suspicion: `);
          await handleVote(selected.id, reasoning.trim() || "Suspicious phrasing");
        } else {
          console.log(`${Colors.red}Invalid index. Try again.${Colors.reset}`);
          await askQuestion(`\nPress [Enter] to retry voting...`);
        }
      } else {
        console.log(`\n${Colors.green}ℹ You have cast your vote successfully.${Colors.reset}`);
        console.log(`Press ${Colors.bright}[Enter]${Colors.reset} to let the AI players discuss and cast their votes via Gemini...`);
        await askQuestion('');
        await handleProcessVotes();
      }
      continue;
    }

    // Default safety escape
    const choice = await askQuestion(`\nUnknown state ${state.status}. Quit? (y/n): `);
    if (choice.trim().toLowerCase() === 'y') break;
  }

  rl.close();
}

// CLI Arg Router
async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command || command === 'help') {
    printBanner();
    console.log(`Usage:`);
    console.log(`  node cli-game.js play                          - Launch full interactive CLI gameplay!`);
    console.log(`  node cli-game.js state                         - Get current game state and discussion feed`);
    console.log(`  node cli-game.js setup [humanName] [topic]     - Initialize a new game`);
    console.log(`  node cli-game.js message "Your text"           - Post human message (when it is your turn)`);
    console.log(`  node cli-game.js step                          - Let the active AI bot take its turn (Gemini API call)`);
    console.log(`  node cli-game.js vote [targetId] "reason"      - Cast human vote on target ID`);
    console.log(`  node cli-game.js process-votes                 - Run LLM votes (Gemini API calls) and process outcome`);
    console.log(`  node cli-game.js continue                      - Advance game state from REVEAL back to next round`);
    console.log(`  node cli-game.js reset                         - Reset the game fully back to LOBBY`);
    console.log(``);
    process.exit(0);
  }

  switch (command) {
    case 'play':
      await handlePlay();
      break;
    case 'state':
      await handleState();
      rl.close();
      break;
    case 'setup':
      await handleSetup(args[1], args[2]);
      rl.close();
      break;
    case 'message':
      if (!args[1]) {
        console.error(`${Colors.red}Error: Please specify the message string as the second argument.${Colors.reset}`);
        process.exit(1);
      }
      await handleMessage(args[1]);
      rl.close();
      break;
    case 'step':
      await handleStep();
      rl.close();
      break;
    case 'vote':
      if (!args[1]) {
        console.error(`${Colors.red}Error: Specify target player ID (e.g. P1) as second argument.${Colors.reset}`);
        process.exit(1);
      }
      await handleVote(args[1], args[2] || "");
      rl.close();
      break;
    case 'process-votes':
      await handleProcessVotes();
      rl.close();
      break;
    case 'continue':
      await handleContinue();
      rl.close();
      break;
    case 'reset':
      await handleReset();
      rl.close();
      break;
    default:
      console.error(`${Colors.red}Unknown command: ${command}. Use "node cli-game.js help" for info.${Colors.reset}`);
      rl.close();
  }
}

main();
