"use strict";
// Syntax + load test — no TTY needed
process.env.__WORDLE_TEST = "1";

// Patch stdin so the TTY guard doesn't fire
Object.defineProperty(process.stdin, "isTTY", { get: () => true, configurable: true });
// Patch setRawMode so it's a no-op
process.stdin.setRawMode = () => {};
// Patch stdin.on so startGame() attaches but never fires
const _origOn = process.stdin.on.bind(process.stdin);
process.stdin.on = (ev, cb) => ev === "data" ? process.stdin : _origOn(ev, cb);
// Patch stdout.write to suppress screen output during test
const _origWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = () => true;

try {
  require("./wordle");
  process.stdout.write = _origWrite;
  console.log("PASS: wordle.js loaded without errors");
} catch(e) {
  process.stdout.write = _origWrite;
  console.error("FAIL: wordle.js threw:", e.message);
  process.exit(1);
}
process.exit(0);
