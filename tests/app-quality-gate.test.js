#!/usr/bin/env node
/* Dependency-vrije statische poort voor de volledige app. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const expectedViews = ["reis", "vandaag", "hotels", "omgeving", "kosten", "meenemen", "momenten", "reizen", "technisch"];
const expectedLabels = ["Onze reis", "Vandaag", "Hotels", "Omgeving", "Kosten", "Meenemen", "Momenten", "Reis beheren", "Technisch"];

assert.match(html, /<meta name="viewport" content="[^"]*width=device-width[^"]*viewport-fit=cover/);
assert.match(html, /@media\s*\(max-width:760px\)/);
assert.match(html, /@media\s*\(max-width:620px\)/);

for (const view of expectedViews) {
  assert.match(html, new RegExp(`<section\\s+id=["']${view}["']`), `ontbrekend view: ${view}`);
  assert.match(html, new RegExp(`data-view=["']${view}["']`), `ontbrekende navigatie: ${view}`);
}
for (const label of expectedLabels) assert.match(html, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

for (const id of ["mobileAppNav", "packingVoiceStart", "packingVoiceResult", "packingManualFallback", "packingSearch", "clearPackingSearch", "environmentMap"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `ontbrekend kernonderdeel: ${id}`);
}
assert.match(html, /aria-live="polite"/);
assert.match(html, /role="status"/);
assert.match(html, /touch-action:manipulation/);

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(match => match[1]).join("\n");
new Function(scripts);

console.log(`app-quality-gate: ${expectedViews.length} views + mobiele markup + toegankelijkheidscontract + syntax OK`);
