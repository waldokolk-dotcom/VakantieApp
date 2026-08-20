#!/usr/bin/env node
/*
 * Kleine, dependency-vrije smoke-test voor de gratis spraakroute.
 * Dit test geen echte microfoon (die is toestel- en browserafhankelijk),
 * maar wel de parser, de mobiele fallback-markup en de script-syntax.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert.match(html, /<meta name="app-version" content="119">/);
for (const id of ["packingVoiceStart", "packingVoiceResult", "packingQuickInput", "packingQuickFind", "packingManualFallback"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `ontbrekend spraak-element: ${id}`);
}
assert.match(html, /packingDictationArmed/);
assert.match(html, /setTimeout\(\(\)=>\{[\s\S]*?packingDictationArmed[\s\S]*?\},3500\)/);

const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(match => match[1]).join("\n");
new Function(script); // syntaxcontrole van de volledige inline-app

const normalizePackingSearch = value => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\p{L}\p{N}\s]/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const start = script.indexOf("function packingSpokenNumber");
const end = script.indexOf("function setPackingSpokenTotal");
assert.ok(start >= 0 && end > start, "spraakparser niet gevonden");
const parserContext = { normalizePackingSearch };
vm.runInNewContext(script.slice(start, end), parserContext);

const cases = [
  ["twee autosleutels klaar", 2, "autosleutels klaar"],
  ["correctie autosleutels aantal drie", 3, "correctie autosleutels"],
  ["6 stuks zonnebrand", 6, "zonnebrand"],
];
for (const [spoken, quantity, cleanedPart] of cases) {
  const result = parserContext.packingQuantityCommand(spoken);
  assert.equal(result.quantity, quantity, spoken);
  assert.match(result.cleaned, new RegExp(cleanedPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}

assert.equal(parserContext.packingCommandQuery("zet autosleutels terug"), "autosleutels");
console.log(`voice-smoke: ${cases.length + 1} parsergevallen + markup + syntax OK`);
