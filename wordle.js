#!/usr/bin/env node
"use strict";

const path = require("path");
const fs   = require("fs");

// ─── Load word list ───────────────────────────────────────────────────────────
// Expects words.txt — one word per line, any case. Example:
//   aback
//   abase
//   abate
const WORDS_FILE = path.join(__dirname, "words.txt");
let WORDS, WORD_POOL;
try {
  const raw = fs.readFileSync(WORDS_FILE, "utf8");
  WORD_POOL = raw
    .split(/\r?\n/)                    // handles Windows \r\n and Unix \n
    .map(w => w.toUpperCase().trim())
    .filter(w => w.length === 5 && /^[A-Z]+$/.test(w));
  if (WORD_POOL.length === 0) throw new Error("No valid 5-letter words found in words.txt");
  WORDS = new Set(WORD_POOL);
} catch (err) {
  process.stderr.write(
    `\nError loading words.txt: ${err.message}\n` +
    `Expected location: ${WORDS_FILE}\n` +
    `Format: one word per line\n\n`
  );
  process.exit(1);
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_GUESSES = 6;
const WORD_LEN    = 5;

// ─── ANSI ─────────────────────────────────────────────────────────────────────
// \x1b[3J  = clear scrollback buffer
// \x1b[2J  = clear visible screen
// \x1b[H   = move cursor to top-left
// Together these wipe everything so output never scrolls or accumulates.
const WIPE = "\x1b[3J\x1b[2J\x1b[H";
const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";
const fg = {
  red:   s => `\x1b[31m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  cyan:  s => `\x1b[36m${s}\x1b[0m`,
  white: s => `\x1b[97m${s}\x1b[0m`,
  bold:  s => `\x1b[1m${s}\x1b[0m`,
  dim:   s => `\x1b[2m${s}\x1b[0m`,
};
const tile = {
  correct: s => `\x1b[42m\x1b[30m${s}\x1b[0m`,
  present: s => `\x1b[43m\x1b[30m${s}\x1b[0m`,
  absent:  s => `\x1b[100m\x1b[37m${s}\x1b[0m`,
  empty:   s => `\x1b[40m\x1b[90m${s}\x1b[0m`,
};

// ─── Word selection ───────────────────────────────────────────────────────────
function getTodayWord() {
  const day = Math.floor((Date.now() - new Date("2024-01-01T00:00:00Z").getTime()) / 86400000);
  return WORD_POOL[day % WORD_POOL.length];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
function scoreGuess(guess, target) {
  const result = Array(WORD_LEN).fill("absent");
  const tArr   = target.split("");
  const used   = Array(WORD_LEN).fill(false);
  for (let i = 0; i < WORD_LEN; i++)
    if (guess[i] === tArr[i]) { result[i] = "correct"; used[i] = true; }
  for (let i = 0; i < WORD_LEN; i++) {
    if (result[i] === "correct") continue;
    for (let j = 0; j < WORD_LEN; j++)
      if (!used[j] && guess[i] === tArr[j]) { result[i] = "present"; used[j] = true; break; }
  }
  return result;
}

// ─── Letter map ───────────────────────────────────────────────────────────────
function buildLetterMap(guesses, scores) {
  const map = {};
  guesses.forEach((g, gi) => g.split("").forEach((ch, ci) => {
    const s = scores[gi][ci];
    if (map[ch] === "correct") return;
    if (map[ch] === "present" && s !== "correct") return;
    map[ch] = s;
  }));
  return map;
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function renderRow(letters, states) {
  const cells = [];
  for (let i = 0; i < WORD_LEN; i++) {
    const ch = ` ${letters[i] || " "} `;
    if (!letters[i])              cells.push(tile.empty("   "));
    else if (!states)             cells.push(tile.empty(ch));
    else if (states[i] === "correct") cells.push(tile.correct(ch));
    else if (states[i] === "present") cells.push(tile.present(ch));
    else                              cells.push(tile.absent(ch));
  }
  return "  " + cells.join(" ");
}

function renderBoard(guesses, scores, input) {
  const rows = [];
  for (let r = 0; r < MAX_GUESSES; r++) {
    if      (r < guesses.length)   rows.push(renderRow(guesses[r].split(""), scores[r]));
    else if (r === guesses.length) rows.push(renderRow(input.split(""), null));
    else                           rows.push(renderRow([], null));
  }
  return rows.join("\n");
}

const KB = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["Z","X","C","V","B","N","M"],
];
function renderKeyboard(lmap) {
  return KB.map(row =>
    "  " + row.map(k => {
      const s = lmap[k];
      if (s === "correct") return tile.correct(` ${k} `);
      if (s === "present") return tile.present(` ${k} `);
      if (s === "absent")  return tile.absent(` ${k} `);
      return tile.empty(` ${k} `);
    }).join(" ")
  ).join("\n");
}

// ─── Draw — wipes terminal completely then repaints from scratch ──────────────
function draw(state) {
  const { guesses, scores, answer, currentInput, message, gameOver, won } = state;
  const lmap = buildLetterMap(guesses, scores);

  let out = WIPE + HIDE;

  out += "\n";
  out += fg.bold(fg.cyan("  ╔══════════════════════════╗")) + "\n";
  out += fg.bold(fg.cyan("  ║")) + fg.bold("       W O R D L E        ") + fg.bold(fg.cyan("║")) + "\n";
  out += fg.bold(fg.cyan("  ╚══════════════════════════╝")) + "\n";
  out += fg.dim(`  ${WORD_POOL.length} words  ·  Guess ${Math.min(guesses.length + (gameOver ? 0 : 1), MAX_GUESSES)}/${MAX_GUESSES}`) + "\n\n";

  out += renderBoard(guesses, scores, currentInput) + "\n\n";
  out += renderKeyboard(lmap) + "\n\n";

  // Message row — always occupies space so layout never jumps
  out += message ? `  ${fg.red("▶")} ${fg.white(message)}\n\n` : "\n\n";

  if (gameOver) {
    const praise = ["Genius!","Magnificent!","Impressive!","Splendid!","Great!","Phew!"];
    if (won) {
      out += `  ${fg.green("✓")} ${fg.bold(fg.green(praise[guesses.length - 1] || "Nice!"))}`;
      out += `  ${fg.dim("The word was")} ${fg.bold(fg.green(answer))}\n`;
    } else {
      out += `  ${fg.red("✗")} ${fg.dim("The word was")} ${fg.bold(fg.red(answer))}\n`;
    }
    out += `\n  ${fg.dim("Play again? [y / n]")}\n`;
  } else {
    const typed  = currentInput.split("").map(c => fg.bold(fg.white(c))).join(" ");
    const blanks = Array(WORD_LEN - currentInput.length).fill(fg.dim("_")).join(" ");
    out += `  > ${[typed, blanks].filter(Boolean).join(" ")}\n`;
    out += `\n  ${fg.dim("[type letters]  [ENTER = submit]  [BACKSPACE = delete]  [CTRL+C = quit]")}\n`;
  }

  process.stdout.write(out);
}

// ─── Game state ───────────────────────────────────────────────────────────────
function newState() {
  return { answer: getTodayWord(), guesses: [], scores: [],
           currentInput: "", message: "", gameOver: false, won: false };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  if (!process.stdin.isTTY) {
    process.stderr.write("wordle: requires an interactive terminal.\n");
    process.exit(1);
  }

  let state    = newState();
  let msgTimer = null;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  const exit = (code = 0) => {
    process.stdout.write(WIPE + SHOW + "\n  Thanks for playing!\n\n");
    process.exit(code);
  };
  process.on("exit",    () => process.stdout.write(SHOW));
  process.on("SIGTERM", () => exit(0));

  function flash(msg) {
    state.message = msg;
    draw(state);
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { state.message = ""; draw(state); }, 2000);
  }

  draw(state);

  process.stdin.on("data", key => {
    if (key === "\u0003") exit(0);                      // Ctrl+C

    if (state.gameOver) {
      if      (key.toLowerCase() === "y") { state = newState(); draw(state); }
      else if (key.toLowerCase() === "n") exit(0);
      return;
    }

    if (key === "\r" || key === "\n") {                 // Enter — submit
      const guess = state.currentInput.toUpperCase();
      if (guess.length < WORD_LEN)  { flash("Not enough letters!");           return; }
      if (!WORDS.has(guess))         { flash(`'${guess}' not in word list.`); return; }
      if (msgTimer) { clearTimeout(msgTimer); msgTimer = null; }
      const score = scoreGuess(guess, state.answer);
      state.guesses.push(guess);
      state.scores.push(score);
      state.currentInput = "";
      state.message      = "";
      state.won          = guess === state.answer;
      state.gameOver     = state.won || state.guesses.length >= MAX_GUESSES;
      draw(state);
      return;
    }

    if (key === "\x7f" || key === "\b") {               // Backspace
      state.currentInput = state.currentInput.slice(0, -1);
      draw(state);
      return;
    }

    const letter = key.toUpperCase();
    if (/^[A-Z]$/.test(letter) && state.currentInput.length < WORD_LEN) {
      state.currentInput += letter;
      draw(state);
    }
  });
}

main();
