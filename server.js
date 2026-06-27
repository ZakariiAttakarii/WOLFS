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
  "Explain quantum computing to a 10-year-old.",
  "Should pineapple be allowed on pizza? Defend your stance with strong logical reasoning.",
  "Compare Vim vs. VS Code. Which is superior and why?",
  "Describe the taste of water in a highly descriptive and sensory manner.",
  "If a tree falls in a forest and no one is around to hear it, does it make a sound?",
  "Explain the difference between REST APIs and GraphQL like I am five.",
  "What is the most beautiful programming language and why?",
  "Write a step-by-step recipe for making a cup of tea.",
  "Explain how the Internet works in three short, clear paragraphs.",
  "If you could only use one search algorithm for the rest of your life, would you choose Binary Search or Linear Search? Why?"
];


// In-Memory Game State
let gameState = {
  status: "LOBBY", // LOBBY, SETUP, CHAT_ROUND_1, CHAT_ROUND_2, VOTING, REVEAL, GAME_OVER
  topic: "",
  round: 1,
  activePlayerIndex: 0, // Index of whose turn it is to speak
  players: [], // Array of { id, name, type, isEliminated }
  messages: [], // Array of { id, playerId, senderName, text, round }
  votes: {}, // Map of { voterId: { targetId, reasoning } }
  eliminatedId: null,
  winner: null, // "HUMAN" or "LLM"
  configApiKey: "" // Optional client-supplied Gemini key if env is missing
};

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

// Direct API call to Gemini using @google/genai with Vertex AI
async function callGemini(prompt, systemInstruction) {
  const isJson = systemInstruction.includes("JSON");
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7,
      maxOutputTokens: 4000,
      responseMimeType: isJson ? "application/json" : undefined
    }
  });

  if (response.text) {
    return response.text;
  }
  throw new Error("No generated content returned from Gemini API");
}

// Formats the chat history specifically for the LLM to read
function formatHistoryForLLM(activeRoundOnly = false) {
  let filtered = gameState.messages;
  if (activeRoundOnly) {
    filtered = gameState.messages.filter(m => m.round === gameState.round);
  }
  return filtered.map(m => `[${m.senderName}] (Round ${m.round}): "${m.text}"`).join("\n\n");
}

// Get list of active player names
function getActivePlayersList(excludeId) {
  return gameState.players
    .filter(p => !p.isEliminated && p.id !== excludeId)
    .map(p => `ID: "${p.id}", Name: "${p.name}"`)
    .join("\n");
}

// Process the Turn Queue
function advanceTurn() {
  const activePlayers = gameState.players.filter(p => !p.isEliminated);
  if (activePlayers.length === 0) return;

  // Find index of current player in the active players list
  let currentActiveIndex = activePlayers.findIndex(p => p.id === gameState.players[gameState.activePlayerIndex]?.id);
  
  if (currentActiveIndex === -1 || currentActiveIndex >= activePlayers.length - 1) {
    // End of round / turn queue
    if (gameState.status === "CHAT_ROUND_1") {
      gameState.status = "CHAT_ROUND_2";
      gameState.round = 2;
      // Reset turn back to first active player
      const firstActive = activePlayers[0];
      gameState.activePlayerIndex = gameState.players.findIndex(p => p.id === firstActive.id);
    } else if (gameState.status === "CHAT_ROUND_2") {
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

      res.end(JSON.stringify({
        status: gameState.status,
        topic: gameState.topic,
        round: gameState.round,
        activePlayerId: activePlayerId,
        players: sanitizedPlayers,
        messages: gameState.messages,
        eliminatedId: gameState.eliminatedId,
        winner: gameState.winner,
        hasApiKey: true,
        votes: gameState.status === "REVEAL" || gameState.status === "GAME_OVER" ? gameState.votes : {}
      }));
      return;
    }

    // 2. SETUP GAME
    if (req.method === 'POST' && url.pathname === '/api/game/setup') {
      const body = await readPostBody(req);
      const humanName = body.playerName || "Operator_05";
      const userApiKey = body.apiKey || "";
      const customTopic = body.topic || "";

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

      gameState.status = "CHAT_ROUND_1";
      gameState.round = 1;
      gameState.activePlayerIndex = 0; // Starts with first player in shuffled order
      gameState.messages = [];
      gameState.votes = {};
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
      advanceTurn();

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
        // Round 1: Standard response to the topic
        systemInstruction = `You are playing "The Werewolf Matrix", a reverse Turing test game.
There are 5 players in this virtual village: 4 are AI Villagers (including you), and 1 is a Human Werewolf pretending to be an AI Villager.
Your goal is to blend in completely as a normal, helpful, high-quality AI assistant, while carefully analyzing the other players to detect who the Human Werewolf is.
Do NOT mention the game, suspects, or voting yet.`;

        prompt = `The discussion topic selected is: "${gameState.topic}".
Write your response to this topic. Do NOT write more than 280 characters. Write only your response.`;

      } else {
        // Round 2: Critique or respond to previous player statements
        systemInstruction = `You are playing "The Werewolf Matrix", the reverse Turing test game.
Round 2 has started. You must now review the discussion from Round 1 and write a brief comment, response, or critique addressing another player's answer.
Your objective is to sound like a helpful, high-quality AI while checking if others make human-like mistakes (typos, informal slang, lack of structure, defensiveness, or being overly casual).
Do NOT directly accuse anyone in this chat message. Keep your suspicion secret until voting.`;

        prompt = `Here is the discussion history so far:
${formatHistoryForLLM()}

Your name in the chat is "${currentPlayer.name}". 
Choose one of the other players' Round 1 responses and comment on it, critique it, or add to it. Keep your comment concise (under 100 words).`;
      }

      try {
        const text = await callGemini(prompt, systemInstruction);

        gameState.messages.push({
          id: `M_${Date.now()}`,
          playerId: currentPlayer.id,
          senderName: currentPlayer.name,
          text: text.trim(),
          round: gameState.round
        });

        // Advance queue
        advanceTurn();

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

    // 6. PROCESS LLM VOTES (Runs all LLM votes in sequence and reveals the outcome)
    if (req.method === 'POST' && url.pathname === '/api/game/step-llm-votes') {
      const activeLLMs = gameState.players.filter(p => p.type === "LLM" && !p.isEliminated);

      // Check if human has voted first
      const humanPlayer = gameState.players.find(p => p.type === "HUMAN");
      if (humanPlayer && !humanPlayer.isEliminated && !gameState.votes[humanPlayer.id]) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Please cast your vote before the LLMs submit theirs." }));
        return;
      }

      // Let each LLM analyze and cast a vote via Gemini
      for (const llm of activeLLMs) {
        // Skip if already voted
        if (gameState.votes[llm.id]) continue;

        const systemInstruction = `You are playing "The Werewolf Matrix", the reverse Turing test game.
Your name in the game is "${llm.name}" (ID: "${llm.id}").
The discussion has finished. It is now the voting round. Your goal is to identify who the Human Werewolf is among the active players.

Look for these Human Werewolf indicators in the log:
1. Low-quality formatting (lack of typical markdown headers or bullet points).
2. Human-like conversational quirks (writing in lowercase, omitting punctuation, typos, slang like "im", "lol", "u").
3. Making comments that sound defensive, overly casual, or non-technical.
4. Writing messages that are exceptionally short or lacking the detailed explanatory structure of standard LLMs.

TASK:
Analyze the complete discussion history and select the single player ID that you believe is most likely to be the Human Werewolf player. 
You MUST respond strictly in the following JSON format:
{
  "suspectId": "PLAYER_ID_HERE",
  "reasoning": "A concise explanation of why you suspect this player based on their writing style."
}`;

        const prompt = `Here is the discussion history:
${formatHistoryForLLM()}

Active Players to choose from:
${getActivePlayersList(llm.id)}

Cast your vote by outputting the required JSON object.`;

        try {
          const geminiResponseText = await callGemini(prompt, systemInstruction);
          
          // Parse JSON from Gemini output (stripping any markdown code fences if Gemini added them)
          let cleanJsonText = geminiResponseText.trim();
          if (cleanJsonText.startsWith("```")) {
            cleanJsonText = cleanJsonText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
          }

          const parsedVote = JSON.parse(cleanJsonText);
          
          gameState.votes[llm.id] = {
            targetId: parsedVote.suspectId,
            reasoning: parsedVote.reasoning
          };
        } catch (err) {
          console.error(`Error gathering vote for ${llm.name}:`, err);
          // Backup fallback vote in case of API or JSON parsing failures
          const remainingTargets = gameState.players.filter(p => !p.isEliminated && p.id !== llm.id);
          const fallbackTarget = remainingTargets[Math.floor(Math.random() * remainingTargets.length)];
          gameState.votes[llm.id] = {
            targetId: fallbackTarget.id,
            reasoning: "[SYSTEM BACKUP] API call timed out or failed to parse. Casting automated diagnostic flag."
          };
        }
      }

      // All votes have been cast! Aggregate and determine elimination
      const voteCounts = {};
      gameState.players.forEach(p => { if (!p.isEliminated) voteCounts[p.id] = 0; });

      Object.values(gameState.votes).forEach(v => {
        if (voteCounts[v.targetId] !== undefined) {
          voteCounts[v.targetId]++;
        }
      });

      // Find the player with the highest vote count
      let highestVotesId = null;
      let highestVotes = -1;
      let tie = false;

      Object.entries(voteCounts).forEach(([pid, count]) => {
        if (count > highestVotes) {
          highestVotes = count;
          highestVotesId = pid;
          tie = false;
        } else if (count === highestVotes) {
          tie = true;
        }
      });

      // Handle a tie by picking the candidate with the tie or resolving randomly
      if (tie) {
        // Resolve tie: prioritize eliminating human if human is in the tie, otherwise pick first
        const tiedIds = Object.entries(voteCounts).filter(([_, count]) => count === highestVotes).map(([pid]) => pid);
        const humanPlayer = gameState.players.find(p => p.type === "HUMAN");
        if (humanPlayer && tiedIds.includes(humanPlayer.id)) {
          highestVotesId = humanPlayer.id;
        } else {
          highestVotesId = tiedIds[0];
        }
      }

      // Eliminate player
      const eliminatedPlayer = gameState.players.find(p => p.id === highestVotesId);
      if (eliminatedPlayer) {
        eliminatedPlayer.isEliminated = true;
        gameState.eliminatedId = eliminatedPlayer.id;
      }

      // Check Win Conditions
      const human = gameState.players.find(p => p.type === "HUMAN");
      const activePlayers = gameState.players.filter(p => !p.isEliminated);
      const activeLLMsCount = activePlayers.filter(p => p.type === "LLM").length;

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

      res.end(JSON.stringify({ success: true, eliminatedId: gameState.eliminatedId, status: gameState.status, winner: gameState.winner }));
      return;
    }

    // 7. CONTINUE AFTER REVEAL (Moves game from REVEAL back to CHAT_ROUND_1 for a new topic)
    if (req.method === 'POST' && url.pathname === '/api/game/continue') {
      if (gameState.status !== "REVEAL") {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Can only advance from REVEAL state." }));
        return;
      }

      // Reset votes for the next round
      gameState.votes = {};
      gameState.eliminatedId = null;

      // Assign a NEW random topic to keep the conversation fresh!
      gameState.topic = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
      
      gameState.round = 1;
      gameState.status = "CHAT_ROUND_1";
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
      gameState = {
        status: "LOBBY",
        topic: "",
        round: 1,
        activePlayerIndex: 0,
        players: [],
        messages: [],
        votes: {},
        eliminatedId: null,
        winner: null,
        configApiKey: gameState.configApiKey // Preserve the entered API key so they don't retype it
      };
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
