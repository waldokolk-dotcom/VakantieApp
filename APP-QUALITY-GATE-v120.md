# App Quality Gate — v120

Datum: 20 augustus 2026  
Live URL: `https://waldokolk-dotcom.github.io/VakantieApp/?v=120`

## Resultaat

**CONDITIONAL PASS** — geen BLOCKER of HIGH gevonden. De laatste hardwarecontrole op een echte iPhone blijft ATTENTION.

## Bewijs

| Controle | Resultaat | Bewijs |
|---|---|---|
| UX & gebruikersreis | PASS | Alle 9 hoofdtabbladen geopend en actief gecontroleerd. |
| Human Experience | PASS | Hoofdroutes zijn taakgericht; pakmodus en fout-herstel zijn zichtbaar. |
| Mobiel/responsive | PASS* | Middelbreed scherm (1348 px) had na de headerfix geen horizontale overflow. |
| Visueel ontwerp/huisstijl | PASS* | Header, navigatie, kaarten en actiehiërarchie gecontroleerd op consistente componenten. |
| WCAG/inclusie | PASS | Benoemde knoppen, focusbare acties, statusmeldingen, `aria-live` en `role=status`. |
| Begrijpelijke taal | PASS | Navigatielabels en spraakinstructies zijn kort en Nederlandstalig. |
| Test/regressie | PASS | `node tests/voice-smoke.test.js` en `node tests/app-quality-gate.test.js` groen. |
| Performance | PASS | Geen applicatiefouten; externe kaartzoeker mag niet de navigatie blokkeren. |
| Privacy/security | PASS | Geen audio-endpoint of audio-opslag in de app; geen nieuwe sleutel of backend. |

## Live routecontrole

De volgende routes zijn in v120 geopend en actief teruggevonden:

`Onze reis` · `Vandaag` · `Hotels` · `Omgeving` · `Kosten` · `Meenemen` · `Momenten` · `Reis beheren` · `Technisch`

Aanvullend gecontroleerd:

- Paklijst zoeken op **autosleutels** en met **Wissen** herstellen: PASS.
- Omgeving: categorie wisselen van **Imbissen** naar **Supermarkten**, kaart zichtbaar: PASS.
- Technisch: versie **v120**, Supabase-status **Verbonden**: PASS.
- Browserconsole tijdens de volledige routecheck: geen applicatiefouten.
- Middelbreed scherm: `scrollWidth = clientWidth`, dus geen horizontale overflow na de headerfix.

## Openstaande ATTENTION

Een cloudbrowser in deze omgeving kan geen echte iPhone-viewport, Apple-toetsenbordmicrofoon, GPS of aanraakgedrag simuleren. Daarom moet nog op jouw telefoon worden bevestigd:

1. onderaan blijft de mobiele navigatie goed zichtbaar;
2. de pakmodus opent zonder verspringen;
3. tik op **Spreek**, tik op 🎤, spreek `twee autosleutels klaar` en controleer dat het item wordt doorgestreept;
4. kaart, GPS-route en foto-upload werken op het toestel.

Pas wanneer die vier punten op de telefoon zijn gecontroleerd, wordt dit een volledige PASS in plaats van CONDITIONAL PASS.
