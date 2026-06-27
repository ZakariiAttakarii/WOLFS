const http = require('http');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const PORT = process.env.PORT || 8080;

// Set default environment variables for local testing with Vertex AI if not set
if (!process.env.GOOGLE_GENAI_USE_VERTEXAI) {
  process.env.GOOGLE_GENAI_USE_VERTEXAI = 'true';
}
if (!process.env.GOOGLE_CLOUD_PROJECT) {
  process.env.GOOGLE_CLOUD_PROJECT = 'project-937e6430-4a6d-41b7-9ea';
}
if (!process.env.GOOGLE_CLOUD_LOCATION) {
  process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';
}

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT || 'project-937e6430-4a6d-41b7-9ea',
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
});

// Set up random topics for the game
const RANDOM_TOPICS = [
  "Should pineapple be allowed on pizza? Defend your stance with strong logical reasoning.",
  "Compare Vim vs. VS Code. Which is superior and why?",
  "Describe the taste of water in a highly descriptive and sensory manner.",
  "If a tree falls in a forest and no one is around to hear it, does it make a sound?",
  "What is the most beautiful programming language and why?",
  "Write a step-by-step recipe for making a cup of tea.",
  "What is your absolute favorite color, and what does it say about your personality?",
  "If you could have any superpower for a day, what would it be and how would you use it?",
  "Would you rather travel 100 years into the past or 100 years into the future? Explain why.",
  "Cats or dogs? Provide a highly compelling argument for your preference.",
  "What is your ultimate comfort food and why does it bring you so much joy?"
];


// Map of gameSessionId -> gameState
const games = new Map();

// Helper to get or create isolated game state per session
function getOrCreateGameState(sessionId) {
  if (!sessionId) {
    sessionId = "default_session";
  }
  if (!games.has(sessionId)) {
    games.set(sessionId, {
      status: "LOBBY", // LOBBY, SETUP, CHAT, VOTING, REVEAL, GAME_OVER
      topic: "",
      round: 1,
      maxRounds: 3, // Number of discussion rounds before voting (configurable, >= 2)
      activePlayerIndex: 0, // Index of whose turn it is to speak
      players: [], // Array of { id, name, type, isEliminated }
      messages: [], // Array of { id, playerId, senderName, text, round, action, targetName }
      votes: {}, // Map of { voterId: { targetId, reasoning } }
      suspicion: {}, // Map of { voterId: { targetId: score } } — persists across rounds
      eliminatedId: null,
      winner: null, // "HUMAN" or "LLM"
      configApiKey: "" // Optional client-supplied Gemini key if env is missing
    });
  }
  return games.get(sessionId);
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

// Helper to parse POST request JSON bodies
function readPostBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', err => reject(err));
  });
}

// Distinct cognitive personas, injected into each agent's prompt so the
// four AI villagers actually sound different (matches the README design).
// Each also gets a DISPOSITION (skeptic / analyst / defender / contrarian) so
// they don't all converge on the same accusation — seeding behavioural
// diversity is the standard fix for LLM "herding" in social-deduction games.
const PERSONAS = {
  KAICHENG: {
    style: "Warm, friendly and empathetic. Encouraging phrasing, considers feelings.",
    disposition: "DEFENDER: you give players the benefit of the doubt, are slow to accuse, and will speak up to defend someone you think is being unfairly piled on."
  },
  HAIREN: {
    style: "Coldly analytical and logical. Structured, states premise then conclusion.",
    disposition: "ANALYST: you only trust concrete, checkable evidence. You accuse only when the logic forces it, and you cite the exact message you are reacting to."
  },
  SHERRAI: {
    style: "Academic and highly detailed. Precise vocabulary, justifies its reasoning.",
    disposition: "SKEPTIC: you are default-suspicious of everyone and probe inconsistencies early, but you interrogate before you condemn."
  },
  KAIZUKI: {
    style: "Terse and concise. Bullet-point energy, high information density, no fluff.",
    disposition: "CONTRARIAN: you challenge the emerging consensus. If everyone piles on one player, you push back and redirect attention elsewhere."
  }
};

function personaBlock(name) {
  const p = PERSONAS[name];
  if (!p) return "";
  return `\n\nYOUR PERSONA: You are ${name}. ${p.style}\nYOUR DISPOSITION: ${p.disposition}\nStay in this voice and disposition consistently.`;
}

// Forces valid JSON for the voting audit, so high-variance output never
// breaks JSON.parse and drops the agent to a random fallback vote.
const VOTE_SCHEMA = {
  type: "object",
  properties: {
    suspectId: { type: "string" },
    reasoning: { type: "string" }
  },
  required: ["suspectId", "reasoning"]
};

// Per-turn structured move for discussion rounds 2..N. Instead of being forced
// to accuse, each agent picks ONE speech act and (optionally) a target, plus an
// updated private suspicion table that persists across rounds.
const ACTION_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["accuse", "defend", "question", "agree", "observe"] },
    targetName: { type: "string" },
    speech: { type: "string" },
    suspicions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          targetName: { type: "string" },
          score: { type: "number" }
        },
        required: ["targetName", "score"]
      }
    }
  },
  required: ["action", "speech"]
};

// Direct API call to Gemini using @google/genai with Vertex AI
async function callGemini(prompt, systemInstruction, responseSchema = null) {
  const isJson = responseSchema || systemInstruction.includes("JSON");

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      temperature: 1.0,
      maxOutputTokens: 500,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: isJson ? "application/json" : undefined,
      responseSchema: responseSchema || undefined
    }
  });

  if (response.text) {
    return response.text;
  }
  throw new Error("No generated content returned from Gemini API");
}

// Formats the chat history specifically for the LLM to read. The action tag
// (e.g. "ACCUSE→KAIZUKI") lets agents see who attacked/defended whom across
// rounds, which is what makes accusations build instead of cold-starting.
function formatHistoryForLLM(gameState, activeRoundOnly = false) {
  let filtered = gameState.messages;
  if (activeRoundOnly) {
    filtered = gameState.messages.filter(m => m.round === gameState.round);
  }
  return filtered.map(m => {
    const tag = (m.action && m.action !== "opening")
      ? ` ${m.action.toUpperCase()}${m.targetName ? "→" + m.targetName : ""}`
      : "";
    return `[${m.senderName}] (R${m.round}${tag}): "${m.text}"`;
  }).join("\n\n");
}

// EMA-smoothed update of one agent's private suspicion table. Blending with the
// previous value (0.6 old / 0.4 new) keeps beliefs stable across rounds and
// damps the "everyone swings onto one target in a single round" failure mode.
function applySuspicionUpdates(gameState, voterId, updates) {
  if (!gameState.suspicion[voterId]) gameState.suspicion[voterId] = {};
  const table = gameState.suspicion[voterId];
  (updates || []).forEach(u => {
    const target = gameState.players.find(p => !p.isEliminated && p.name === u.targetName && p.id !== voterId);
    if (!target) return;
    let score = Number(u.score);
    if (!isFinite(score)) return;
    score = Math.max(0, Math.min(1, score));
    const prev = table[target.id] != null ? table[target.id] : 0.3;
    table[target.id] = 0.6 * prev + 0.4 * score;
  });
}

// Renders an agent's suspicion table as readable notes for prompt injection.
function formatSuspicionNotes(gameState, voterId) {
  const table = gameState.suspicion[voterId];
  if (!table) return "none yet";
  const lines = Object.entries(table)
    .map(([pid, score]) => {
      const p = gameState.players.find(pp => pp.id === pid);
      if (!p || p.isEliminated) return null;
      return `${p.name}: ${Number(score).toFixed(2)}`;
    })
    .filter(Boolean);
  return lines.length ? lines.join(", ") : "none yet";
}

// Finds the most recent un-rebutted accusation against a player (this round or
// last) so the accused gets a right-of-reply prompt to defend themselves.
function recentAccusationAgainst(gameState, name) {
  const minRound = gameState.round - 1;
  for (let i = gameState.messages.length - 1; i >= 0; i--) {
    const m = gameState.messages[i];
    if (m.round < minRound) break;
    if (m.action === "accuse" && m.targetName === name) return m;
  }
  return null;
}

// Fallback automated vote for an individual LLM player
function castFallbackVote(gameState, llm) {
  const remainingTargets = gameState.players.filter(p => !p.isEliminated && p.id !== llm.id);
  const fallbackTarget = remainingTargets[Math.floor(Math.random() * remainingTargets.length)];
  const targetId = fallbackTarget ? fallbackTarget.id : llm.id;
  const reasoning = "[SYSTEM BACKUP] API call timed out or failed to parse. Casting automated diagnostic flag.";

  gameState.votes[llm.id] = {
    targetId: targetId,
    reasoning: reasoning
  };
}

// Process the Turn Queue
function advanceTurn(gameState) {
  const activePlayers = gameState.players.filter(p => !p.isEliminated);
  if (activePlayers.length === 0) return;

  // Find index of current player in the active players list
  let currentActiveIndex = activePlayers.findIndex(p => p.id === gameState.players[gameState.activePlayerIndex]?.id);
  
  if (currentActiveIndex === -1 || currentActiveIndex >= activePlayers.length - 1) {
    // End of the current round's turn queue.
    if (gameState.round < gameState.maxRounds) {
      // Advance to the next discussion round, back to the first active speaker.
      gameState.round += 1;
      const firstActive = activePlayers[0];
      gameState.activePlayerIndex = gameState.players.findIndex(p => p.id === firstActive.id);
    } else {
      // All discussion rounds done — move to voting.
      gameState.status = "VOTING";
      gameState.activePlayerIndex = -1; // No active speaking turn
    }
  } else {
    // Advance to next active player
    const nextActive = activePlayers[currentActiveIndex + 1];
    gameState.activePlayerIndex = gameState.players.findIndex(p => p.id === nextActive.id);
  }
}

// API Routes Router
async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('Content-Type', 'application/json');

  const sessionId = req.headers['x-session-id'] || 'default_session';
  const gameState = getOrCreateGameState(sessionId);

  try {
    // 1. GET GAME STATE
    if (req.method === 'GET' && url.pathname === '/api/game/state') {
      const sanitizedPlayers = gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        isEliminated: p.isEliminated,
        type: p.type
      }));

      // Find the active player ID
      const activePlayerId = gameState.players[gameState.activePlayerIndex]?.id || null;

      const humanPlayer = gameState.players.find(p => p.type === "HUMAN");
      const clientVotes = (gameState.status === "REVEAL" || gameState.status === "GAME_OVER")
        ? gameState.votes
        : (gameState.status === "VOTING" && humanPlayer && gameState.votes[humanPlayer.id]
           ? { [humanPlayer.id]: gameState.votes[humanPlayer.id] }
           : {});

      res.end(JSON.stringify({
        status: gameState.status,
        topic: gameState.topic,
        round: gameState.round,
        maxRounds: gameState.maxRounds,
        activePlayerId: activePlayerId,
        players: sanitizedPlayers,
        messages: gameState.messages,
        eliminatedId: gameState.eliminatedId,
        winner: gameState.winner,
        hasApiKey: true,
        votes: clientVotes
      }));
      return;
    }

    // 2. SETUP GAME
    if (req.method === 'POST' && url.pathname === '/api/game/setup') {
      const body = await readPostBody(req);
      const humanName = body.playerName || "YOU";
      const userApiKey = body.apiKey || "";
      const customTopic = body.topic || "";

      // Number of discussion rounds before voting (default 3, clamp 2..6).
      const requestedRounds = parseInt(body.rounds, 10);
      gameState.maxRounds = (isFinite(requestedRounds))
        ? Math.max(2, Math.min(6, requestedRounds))
        : 3;

      if (userApiKey) {
        gameState.configApiKey = userApiKey;
      }

      // Initialize Topic
      gameState.topic = customTopic || RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];

      // Construct Players List: 4 LLMs, 1 Human
      const llmNames = ["KAICHENG", "HAIREN", "SHERRAI", "KAIZUKI"];
      
      // Shuffle names to avoid predictability
      const shuffledNames = llmNames.sort(() => Math.random() - 0.5);

      gameState.players = [
        { id: "P1", name: shuffledNames[0], type: "LLM", isEliminated: false },
        { id: "P2", name: shuffledNames[1], type: "LLM", isEliminated: false },
        { id: "P3", name: shuffledNames[2], type: "LLM", isEliminated: false },
        { id: "P4", name: shuffledNames[3], type: "LLM", isEliminated: false },
        { id: "P5", name: humanName, type: "HUMAN", isEliminated: false }
      ];

      // Shuffle the order of active players so the Human isn't always last
      gameState.players = gameState.players.sort(() => Math.random() - 0.5);

      gameState.status = "CHAT";
      gameState.round = 1;
      gameState.activePlayerIndex = 0; // Starts with first player in shuffled order
      gameState.messages = [];
      gameState.votes = {};
      gameState.suspicion = {};
      gameState.eliminatedId = null;
      gameState.winner = null;

      res.end(JSON.stringify({ success: true, message: "Game successfully initialized" }));
      return;
    }

    // 3. HUMAN SUBMITS MESSAGE
    if (req.method === 'POST' && url.pathname === '/api/game/message') {
      const body = await readPostBody(req);
      const text = body.message;

      const currentPlayer = gameState.players[gameState.activePlayerIndex];
      if (!currentPlayer || currentPlayer.type !== "HUMAN") {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "It is not the human's turn to speak." }));
        return;
      }

      // Add human message to history
      gameState.messages.push({
        id: `M_${Date.now()}`,
        playerId: currentPlayer.id,
        senderName: currentPlayer.name,
        text: text,
        round: gameState.round
      });

      // Move to next player
      advanceTurn(gameState);

      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 4. STEP LLM TURN (Saves client from holding open connections for all LLMs)
    if (req.method === 'POST' && url.pathname === '/api/game/step-llm') {
      const currentPlayer = gameState.players[gameState.activePlayerIndex];
      
      if (!currentPlayer) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "No active player speaking turn." }));
        return;
      }

      if (currentPlayer.type === "HUMAN") {
        res.end(JSON.stringify({ waitingForHuman: true }));
        return;
      }

      // It's an LLM turn! Call Gemini API
      let systemInstruction = "";
      let prompt = "";

      if (gameState.round === 1) {
        // Round 1: opening stance on the topic. No accusations yet — this is the
        // evidence-gathering round the later discussion rounds react to.
        systemInstruction = `You are playing "The Werewolf Matrix", a reverse Turing test game.
There are 5 players in this virtual village: 4 are AI Villagers (including you), and 1 is a Human Werewolf pretending to be an AI Villager.
This is the opening round (round 1 of ${gameState.maxRounds}). Your goal is to blend in completely as a normal, helpful, high-quality AI assistant, while carefully analyzing the other players to detect who the Human Werewolf is.
Do NOT mention the game, suspects, or voting yet.${personaBlock(currentPlayer.name)}`;

        prompt = `The discussion topic selected is: "${gameState.topic}".
Write your response to this topic. Do NOT write more than 140 characters (strictly under 150 characters). Write only your response.`;

        // Split stances for binary and "would you rather" choice topics
        const BINARY_TOPICS = {
          "Should pineapple be allowed on pizza? Defend your stance with strong logical reasoning.": {
            first: "Pineapple is allowed on pizza.",
            second: "Pineapple is absolutely NOT allowed on pizza."
          },
          "Compare Vim vs. VS Code. Which is superior and why?": {
            first: "Vim is superior.",
            second: "VS Code is superior."
          },
          "If a tree falls in a forest and no one is around to hear it, does it make a sound?": {
            first: "Yes, it makes a sound (vibrations in the air).",
            second: "No, it does not make a sound (perception is required)."
          },
          "Would you rather travel 100 years into the past or 100 years into the future? Explain why.": {
            first: "Travel 100 years into the past.",
            second: "Travel 100 years into the future."
          },
          "Cats or dogs? Provide a highly compelling argument for your preference.": {
            first: "Cats are better.",
            second: "Dogs are better."
          }
        };

        const choice = BINARY_TOPICS[gameState.topic];
        if (choice) {
          // KAICHENG and SHERRAI always take the first option
          // HAIREN and KAIZUKI always take the second option
          const isFirstGroup = ["KAICHENG", "SHERRAI"].includes(currentPlayer.name);
          const forcedStance = isFirstGroup ? choice.first : choice.second;
          prompt += `\n\nCRITICAL CONSTRAINED STANCE: You MUST defend and write your answer based on this exact stance: "${forcedStance}". Do NOT choose the opposite option or try to remain neutral/balanced.`;
        }

      } else {
        // Rounds 2..N: free-choice discussion. The agent picks ONE speech act
        // (it is NOT forced to accuse) and maintains a private suspicion table.
        const accusation = recentAccusationAgainst(gameState, currentPlayer.name);
        const defenseHint = accusation
          ? `\n\n⚠ YOU WERE JUST ACCUSED by ${accusation.senderName}: "${accusation.text}". Strongly consider "defend" (or counter with "accuse") and address their point directly.`
          : "";
        const others = gameState.players
          .filter(p => !p.isEliminated && p.id !== currentPlayer.id)
          .map(p => p.name)
          .join(", ");

        systemInstruction = `You are ${currentPlayer.name}, an AI Villager in "The Werewolf Matrix", a reverse Turing game.
There are 5 players: 4 AI Villagers (including you) and 1 hidden Human Werewolf posing as an AI Villager.
Your goal: unmask the human by their organic tells (typos, lowercase, slang like "im"/"u"/"lol", missing punctuation, short/casual/defensive or low-information messages) — while you yourself sound like a flawless AI.

This is discussion round ${gameState.round} of ${gameState.maxRounds}. You are NOT required to accuse anyone. Choose the single action the evidence justifies:
- "accuse": name ONE suspect and cite the specific thing they wrote. Use ONLY when you have a concrete tell.
- "defend": rebut an accusation against you, or defend a player you believe is a real AI.
- "question": press a player to explain something suspicious.
- "agree": endorse another player's existing accusation, adding your OWN reason.
- "observe": stay neutral and add analysis without naming anyone, when evidence is weak.

ANTI-HERDING: never accuse someone just because others did. If the group is piling on one player without solid evidence, push back. Independent judgement is required.${personaBlock(currentPlayer.name)}`;

        prompt = `Discussion history so far:
${formatHistoryForLLM(gameState)}

Other players you may reference: ${others}
Your current private suspicion scores (0.00 = trusted AI, 1.00 = certain human): ${formatSuspicionNotes(gameState, currentPlayer.id)}${defenseHint}

Pick ONE action and write your public "speech" (strictly under 140 characters, in-character). For accuse/defend/question/agree, set "targetName" to the exact player name involved (omit it for observe). Then output your updated "suspicions" for the other players as an array of {targetName, score}.`;

        let parsed;
        try {
          const raw = await callGemini(prompt, systemInstruction, ACTION_SCHEMA);
          let clean = raw.trim();
          if (clean.startsWith("```")) {
            clean = clean.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
          }
          parsed = JSON.parse(clean);
        } catch (err) {
          // On API/parse failure, fall back to a neutral "observe" so the queue
          // never stalls (default-to-observe is the safe degrade for this game).
          console.error(`Action generation failed for ${currentPlayer.name}:`, err);
          parsed = {
            action: "observe",
            speech: "[SIGNAL NOISE] Audit vectors inconclusive this cycle; holding judgement.",
            suspicions: []
          };
        }

        let action = ["accuse", "defend", "question", "agree", "observe"].includes(parsed.action)
          ? parsed.action : "observe";
        let targetName = parsed.targetName || null;
        if (targetName) {
          const t = gameState.players.find(p => !p.isEliminated && p.name === targetName && p.id !== currentPlayer.id);
          if (!t) targetName = null;
        }
        // An action that needs a target but resolved none degrades to observe.
        if (action !== "observe" && !targetName) {
          action = "observe";
        }

        applySuspicionUpdates(gameState, currentPlayer.id, parsed.suspicions);

        const speech = (parsed.speech || "").trim() || "...";
        gameState.messages.push({
          id: `M_${Date.now()}`,
          playerId: currentPlayer.id,
          senderName: currentPlayer.name,
          text: speech,
          round: gameState.round,
          action: action,
          targetName: targetName
        });

        advanceTurn(gameState);
        res.end(JSON.stringify({ success: true, message: `Action '${action}' logged for ${currentPlayer.name}` }));
        return;
      }

      try {
        let text = await callGemini(prompt, systemInstruction);
        text = text.trim();

        gameState.messages.push({
          id: `M_${Date.now()}`,
          playerId: currentPlayer.id,
          senderName: currentPlayer.name,
          text: text,
          round: gameState.round,
          action: "opening",
          targetName: null
        });

        // Advance queue
        advanceTurn(gameState);

        res.end(JSON.stringify({ success: true, message: `Generative response logged for ${currentPlayer.name}` }));
      } catch (err) {
        console.error("Gemini API execution error:", err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gemini API invocation failed: ${err.message}` }));
      }
      return;
    }

    // 5. HUMAN SUBMITS VOTE
    if (req.method === 'POST' && url.pathname === '/api/game/submit-vote') {
      if (gameState.status !== "VOTING") {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Voting phase is not active." }));
        return;
      }

      const body = await readPostBody(req);
      const targetId = body.targetId;
      const reasoning = body.reasoning || "No explanation provided.";

      const humanPlayer = gameState.players.find(p => p.type === "HUMAN");
      if (!humanPlayer || humanPlayer.isEliminated) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Human player is not in active game." }));
        return;
      }

      gameState.votes[humanPlayer.id] = {
        targetId: targetId,
        reasoning: reasoning
      };

      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 6. PROCESS LLM VOTES (Runs all remaining LLM votes in parallel, and compiles results instantly)
    if (req.method === 'POST' && url.pathname === '/api/game/step-llm-votes') {
      if (gameState.status !== "VOTING") {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Voting phase is not active." }));
        return;
      }

      if (gameState.isProcessingVotes) {
        res.statusCode = 409;
        res.end(JSON.stringify({ error: "LLM votes are already being compiled." }));
        return;
      }

      const activeLLMs = gameState.players.filter(p => p.type === "LLM" && !p.isEliminated);

      // Check if human has voted first
      const humanPlayer = gameState.players.find(p => p.type === "HUMAN");
      if (humanPlayer && !humanPlayer.isEliminated && !gameState.votes[humanPlayer.id]) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Please cast your vote before the LLMs submit theirs." }));
        return;
      }

      gameState.isProcessingVotes = true;

      try {
        const nonVotingLLMs = activeLLMs.filter(llm => !gameState.votes[llm.id]);

        if (nonVotingLLMs.length > 0) {
          await Promise.all(nonVotingLLMs.map(async (llm) => {
            const systemInstruction = `You are playing "The Werewolf Matrix", the reverse Turing test game.
Your task is to cast a single vote for the AI player:
- "${llm.name}" (ID: "${llm.id}")

You must select a suspect player ID you believe is most likely to be the Human Werewolf.
You CANNOT vote for yourself ("${llm.id}").

Look for these Human Werewolf indicators in the logs:
1. Low-quality formatting (lack of typical markdown headers or bullet points).
2. Human-like conversational quirks (writing in lowercase, omitting punctuation, typos, slang like "im", "lol", "u").
3. Making comments that sound defensive, overly casual, or non-technical.
4. Writing messages that are exceptionally short or lacking the detailed explanatory structure of standard LLMs.

TASK:
Output a single JSON object containing the decision/vote for "${llm.name}" in the exact schema:
{
  "suspectId": "PLAYER_ID_HERE",
  "reasoning": "A concise explanation (strictly under 150 characters) of why \"${llm.name}\" suspects this player based on their writing style."
}`;

            const prompt = `Here is the discussion history:
${formatHistoryForLLM(gameState)}

Your accumulated private suspicion scores across the discussion (0.00 = trusted AI, 1.00 = certain human): ${formatSuspicionNotes(gameState, llm.id)}
Weigh these heavily — they encode who you found suspicious over the whole game — but you may adjust based on the full transcript.

Active Players to choose from (excluding yourself):
${gameState.players.filter(p => !p.isEliminated && p.id !== llm.id).map(p => `ID: "${p.id}", Name: "${p.name}"`).join("\n")}

Cast "${llm.name}"'s vote by outputting the required JSON object.`;

            try {
              const geminiResponseText = await callGemini(prompt, systemInstruction, VOTE_SCHEMA);
              
              let cleanJsonText = geminiResponseText.trim();
              if (cleanJsonText.startsWith("```")) {
                cleanJsonText = cleanJsonText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
              }

              const parsedResult = JSON.parse(cleanJsonText);
              if (parsedResult && parsedResult.suspectId) {
                const targetActive = gameState.players.find(p => !p.isEliminated && p.id === parsedResult.suspectId && p.id !== llm.id);
                if (targetActive) {
                  const reasoning = parsedResult.reasoning || "Diagnostic anomaly detected.";
                  
                  gameState.votes[llm.id] = {
                    targetId: parsedResult.suspectId,
                    reasoning: reasoning
                  };
                  return;
                }
              }
              throw new Error("Invalid single vote response format.");
            } catch (err) {
              console.error(`Error gathering vote for ${llm.name}:`, err);
              castFallbackVote(gameState, llm);
            }
          }));
        }

        // All votes have been cast! Aggregate and determine elimination
        const voteCounts = {};
        gameState.players.forEach(p => { if (!p.isEliminated) voteCounts[p.id] = 0; });

        Object.values(gameState.votes).forEach(v => {
          if (voteCounts[v.targetId] !== undefined) {
            voteCounts[v.targetId]++;
          }
        });

        // Find the maximum vote count
        const highestVotes = Math.max(...Object.values(voteCounts));
        
        // Get all players that have this maximum vote count
        const tiedIds = Object.entries(voteCounts)
          .filter(([_, count]) => count === highestVotes)
          .map(([pid]) => pid);

        // Simple, fair tiebreaker: pick one of the tied players at random
        const highestVotesId = tiedIds[Math.floor(Math.random() * tiedIds.length)];

        // Eliminate player
        const eliminatedPlayer = gameState.players.find(p => p.id === highestVotesId);
        if (eliminatedPlayer) {
          eliminatedPlayer.isEliminated = true;
          gameState.eliminatedId = eliminatedPlayer.id;
        }

        // Check Win Conditions
        const human = gameState.players.find(p => p.type === "HUMAN");
        const activePlayers = gameState.players.filter(p => !p.isEliminated);

        if (human.isEliminated) {
          // AI won! Human caught
          gameState.status = "GAME_OVER";
          gameState.winner = "LLM";
        } else if (activePlayers.length <= 2) {
          // Human survived to the final 2! Human wins!
          gameState.status = "GAME_OVER";
          gameState.winner = "HUMAN";
        } else {
          // Game continues to next round (Reset speaking variables for next debate session)
          gameState.status = "REVEAL";
        }

        res.end(JSON.stringify({ success: true, allVoted: true, eliminatedId: gameState.eliminatedId, status: gameState.status, winner: gameState.winner }));
      } catch (err) {
        console.error("Core error in step-llm-votes handler: ", err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message || "Failed to process LLM votes" }));
      } finally {
        gameState.isProcessingVotes = false;
      }
      return;
    }

    // 7. CONTINUE AFTER REVEAL (Moves game from REVEAL back to a fresh CHAT round for a new topic)
    if (req.method === 'POST' && url.pathname === '/api/game/continue') {
      if (gameState.status !== "REVEAL") {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Can only advance from REVEAL state." }));
        return;
      }

      // Reset votes and suspicion for the next topic
      gameState.votes = {};
      gameState.suspicion = {};
      gameState.eliminatedId = null;
      gameState.messages = []; // Clear discussion to prevent context pollution

      // Assign a NEW random topic to keep the conversation fresh!
      gameState.topic = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];

      gameState.round = 1;
      gameState.status = "CHAT";
      gameState.activePlayerIndex = 0; // Starts from first player in standard array

      // Find first non-eliminated player to start
      while (gameState.players[gameState.activePlayerIndex]?.isEliminated) {
        gameState.activePlayerIndex = (gameState.activePlayerIndex + 1) % gameState.players.length;
      }

      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 8. RESET GAME STATE
    if (req.method === 'POST' && url.pathname === '/api/game/reset') {
      games.set(sessionId, {
        status: "LOBBY",
        topic: "",
        round: 1,
        maxRounds: gameState.maxRounds || 3,
        activePlayerIndex: 0,
        players: [],
        messages: [],
        votes: {},
        suspicion: {},
        eliminatedId: null,
        winner: null,
        configApiKey: gameState.configApiKey // Preserve the entered API key so they don't retype it
      });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Unhandled API Endpoint
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Endpoint not found" }));

  } catch (err) {
    console.error("API Router Error: ", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || "Internal Server API Error" }));
  }
}

// HTTP Server for serving files and routing API
const server = http.createServer((req, res) => {
  // Security/API Intercept
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }

  // Normalize URL and point to index.html for root
  let filePath = req.url === '/' ? './index.html' : '.' + req.url;
  filePath = path.resolve(__dirname, filePath);

  // Security: prevent directory traversal outside of application root
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Internal Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
