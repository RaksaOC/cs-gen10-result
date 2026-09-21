# Gen10 Year 3 Results

Static site for Generation 10 Year 3 annual results — **Software Engineering** and **Data Science**.

## Features

- Centered title block (no classic nav/footer chrome)
- Track tabs: **Software Engineering** · **Data Science** · **SE & DS** (default SE)
- Students / Subjects full-width sliding pill switch
- Collapsible filter drawer (horizontal scroll) toggled from the sticky search bar
- [Choices.js](https://choices-js.github.io/Choices/) styled selects
- Curtain splash (side split desktop / top–bottom mobile; title shifts to black as curtains open)
- Skeletons on load & filter changes (results stay hidden while loading)
- SVG icons + hover tooltips

## Folder layout

```
gen10-results/
├── index.html
├── css/styles.css
├── js/app.js
├── data/results.json
├── scripts/export-data.js
├── README.md
└── .gitignore
```

## Run locally

```bash
npm start
# or: npx serve . -p 4173
```

## GitHub Pages

Deploy from `main` / root. `index.html` is the entry.

## Regenerate PDF data

```bash
cd "C:\Users\pheng\Downloads\Telegram Desktop"
set NODE_PATH=%CD%\node_modules
node "D:\Development\Projects\gen10-results\scripts\export-data.js"
```
