# VakantieApp v122

De complete mobiele vakantie-app van Waldo en Brigitte.

## Publiceren met GitHub Pages

Upload `index.html` en `apple-touch-icon.png` samen naar de hoofdmap van de `main`-branch. GitHub Pages opent daarna automatisch `index.html`.

De app blijft dezelfde bestaande Supabase-gegevens gebruiken. Vervang of verwijder daarom geen configuratie uit `index.html`.

## Spraak gebruiken bij het inpakken

- Open **Meenemen**, tik op **Start pakmodus** en daarna op de grote knop **Spreek**.
- Zeg bijvoorbeeld `twee autosleutels klaar`.
- Op laptop luistert de browser rechtstreeks. Op iPhone opent de knop het Apple-toetsenbord: tik daar één keer op het microfoontje. Zodra de tekst verschijnt, verwerkt de app die automatisch.
- Het aantal wordt bij het artikel opgeslagen en het artikel wordt afgevinkt.
- Je kunt ook zeggen `check`, `gedaan` of `klaar`.

Correcties werken eveneens met één gesproken opdracht:

- `correctie, aantal moet drie zijn`
- `correctie autosleutels aantal twee`
- `zet autosleutels terug`

Alleen wanneer opnemen op een toestel echt niet beschikbaar is, staat onder **Typen als reserve** nog een handmatige invoer.

Deze variant gebruikt geen betaalde spraakserver en bewaart geen audio-opnamen.

## Foto's bewaren op de telefoon

Foto's bij **Hotels** en **Momenten** worden gedeeld opgeslagen in de app. Na het kiezen van één of meer foto's staat daarnaast **Bewaar in Foto's**. Op iPhone opent dit de deelkaart; kies daar **Bewaar afbeelding**. Safari mag foto's niet zonder deze gebruikersactie rechtstreeks in Foto's plaatsen. Op desktop start de knop een normale download.

## Kostenoverzicht

Het totaal bestaat uit hotelkosten en alle overige kosten. Een reeds betaalde hotel-aanbetaling wordt alleen als losse informatie getoond en telt niet mee in het totaal, de deeltotalen of de kostenlijst.
