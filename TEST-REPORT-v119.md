# VakantieApp v119 — UX- en regressiecontrole

## Uitgevoerde controles

- Lokale JavaScript-syntaxcontrole van de volledige inline-app: OK.
- `node tests/voice-smoke.test.js`: 4 parsergevallen, voice-markup en syntax: OK.
- Live browsercontrole op `https://waldokolk-dotcom.github.io/VakantieApp/?v=119`: pakmodus opent, grote spraakknop is zichtbaar, reserve-invoer is standaard ingeklapt en microfoonweigering opent automatisch toetsenborddicteren.
- Live browserconsole: geen applicatiefouten; alleen meldingen van een browserextensie.
- Geen audio wordt naar een server gestuurd of opgeslagen.

## Bibliotheek-checklist

| Agent-perspectief | Bevinding | Status |
|---|---|---|
| UX & Gebruikersreis | Eén duidelijke knop; daarna automatische verwerking van dicteertekst. | PASS |
| Mobiel & Responsive | Focus en scroll naar het iPhone-invoerveld; extra ruime tikdoelen. | PASS |
| WCAG | Benoemde knoppen, zichtbare focus, `aria-live`/`role=status`, voldoende contrast in de hoofdactie. | PASS |
| Inclusie & Begrijpelijke taal | Korte Nederlandse instructies, geen vaktaal, reservepad blijft beschikbaar. | PASS |
| Security & Privacy | Browser-native herkenning of toetsenborddicteren; geen audio-endpoint, sleutel of nieuwe datastroom. | PASS |
| Architectuur & Beheer | Geen nieuwe dependency of backend; wijziging blijft in de bestaande statische app. | PASS |
| Test & Regression | Parser-, markup-, syntax- en live smoke-controle uitgevoerd. | PASS |
| Performance | Geen extra netwerkverzoek voor spraak; debounce voorkomt dubbele verwerking. | PASS |
| Kosten | Geen OpenAI-tegoed of betaalde spraakserver nodig. | PASS |

## Platformgrens

iOS Safari geeft een webpagina geen vrije toegang om de microfoonknop van het Apple-toetsenbord programmatisch te bedienen. Daarom is de gratis telefoonroute: tik op **Spreek**, tik één keer op **🎤** in het toetsenbord, spreek; daarna verwerkt de app automatisch. Op browsers met `SpeechRecognition` is het echt één tik op **Spreek**.

## Nog handmatig op een echte telefoon te controleren

De laatste hardware-afhankelijkheid is de microfoonmachtiging en Apple-dicteerknop op het eigen toestel. De app toont daarbij geen extra knop om de tekst nogmaals te verwerken.
