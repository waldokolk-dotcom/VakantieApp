# App Quality Gate

Deze poort is verplicht vóór iedere nieuwe VakantieApp-release. Een release is alleen **PASS** wanneer geen BLOCKER of HIGH openstaat.

## Vaste controles

1. **UX & gebruikersreis** — kan iemand zonder uitleg de hoofdtaak uitvoeren?
2. **Human Experience** — zijn de routes begrijpelijk voor een nieuwe, minder technische en mobiele gebruiker?
3. **Mobiel & responsive** — werkt de layout op smalle schermen, met duimvriendelijke acties en zonder horizontale overflow?
4. **Visueel ontwerp & huisstijl** — zijn hiërarchie, contrast, iconen, spacing en componenten consistent?
5. **WCAG & inclusie** — zijn focus, namen, statusmeldingen, contrast en foutmeldingen bruikbaar?
6. **Begrijpelijke taal** — zijn labels en instructies kort, concreet en in het Nederlands?
7. **Test & regressie** — werken navigatie, formulieren, kaarten, zoeken, paklijst, foto’s en kosten na wijzigingen?
8. **Performance** — blijft de eerste weergave en elke route bruikbaar bij trage externe diensten?
9. **Privacy & security** — geen onnodige datastromen, sleutels of audio-opslag.

## Minimale gebruikersroutes

- Reis openen en een hotel/route kiezen.
- Vandaag openen en de weers-/daginformatie lezen.
- Hotels openen en een hotelpas bekijken.
- Omgeving openen, categorie wisselen, kaart en route openen.
- Kosten openen, een kostenregel toevoegen en totalen controleren.
- Meenemen openen, zoeken/wissen, pakmodus en spraakflow gebruiken.
- Momenten openen en een tekst/foto toevoegen.
- Reis beheren openen en een reisinstelling bekijken.
- Technisch openen en versienummer controleren.

## Bewijs en status

Elke run legt vast: datum, versie, route, toestel/viewport, bewijs, status en herstelactie. De statussen zijn:

- **PASS** — gecontroleerd en geen relevante bevinding.
- **ATTENTION** — bruikbaar, maar nog niet volledig op echte hardware bewezen.
- **HIGH** — belangrijke gebruikers- of productfout; release niet vrijgeven.
- **BLOCKER** — route werkt niet of veroorzaakt dataverlies/veiligheidsrisico; release niet vrijgeven.

Een cloudbrowser kan interactie en desktop/responsive markup controleren. Microfoonmachtigingen, toetsenborddicteren, GPS en echte iOS-schaling moeten aanvullend op een echte telefoon worden gecontroleerd.
