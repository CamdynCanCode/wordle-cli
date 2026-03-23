# wordle-cli-game

A real terminal Wordle game. No browser, no internet, zero npm dependencies.

## Install globally from npm

```
npm install -g wordle-cli-game
wordle
```

## Or run directly from source

```
git clone https://github.com/YOUR_USERNAME/wordle-cli.git
cd wordle-cli
node wordle.js
```

## Requirements

- Node.js 14 or higher
- A real interactive terminal (not piped output)
- A `words.json` file in the project folder (see below)

## Word list

The game loads its word list from `words.json` in the same directory as `wordle.js`.

Format — a plain JSON array of 5-letter strings (case-insensitive):

```json
["aback","abase","abate","abbey", ...]
```

Every word in the file is both a valid guess **and** a potential answer.
Words that aren't exactly 5 alphabetic characters are automatically skipped.

## Controls

| Key        | Action              |
|------------|---------------------|
| A–Z        | Type a letter       |
| ENTER      | Submit guess        |
| BACKSPACE  | Delete last letter  |
| CTRL+C     | Quit at any time    |
| Y / N      | Play again / quit   |

## Tile colours

| Colour    | Meaning                              |
|-----------|--------------------------------------|
| 🟩 Green  | Correct letter, correct position     |
| 🟨 Yellow | Correct letter, wrong position       |
| ⬛ Gray   | Letter not in the word               |

## Publishing to npm

1. Replace `YOUR_USERNAME` in `package.json` with your GitHub username
2. Make sure your package name is unique on npm
3. `npm login`
4. `npm publish`
