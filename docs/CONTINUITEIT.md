# VakantieApp continuïteit

De app is blijvend; `Vakantie 2026`, `Vakantie 2027` en volgende reizen zijn gegevens binnen dezelfde app. De Supabase-projectnaam bepaalt dus niet de levensduur van het product.

## Wat automatisch gebeurt

- GitHub bewaart de volledige applicatie en iedere wijziging.
- `supabase/migrations/20260917_vakantie_app_continuity.sql` kan de database, beveiligingsregels en private fotobucket opnieuw opbouwen.
- De GitHub Actions-job `Houd VakantieApp actief` doet dagelijks een kleine echte databasequery. Een mislukking wordt zichtbaar als een rode workflow-run.
- Er worden geen service-role keys, databasewachtwoorden of persoonsgegevens in GitHub opgeslagen.

## Eenmalig in het bestaande Supabase-project

Voer de continuïteitsmigratie uit met de Supabase CLI of in de SQL Editor. Hiermee wordt onder meer `app_health` aangemaakt. Start daarna de workflow één keer handmatig en controleer dat deze groen eindigt.

## Herstellen in een nieuw Supabase-project

1. Maak een nieuw Supabase-project.
2. Voer alle bestanden uit `supabase/migrations/` in datumvolgorde uit.
3. Herstel de databasegegevens en bestanden uit de laatste archiefkopie.
4. Zet Anonymous Sign-Ins aan; de app gebruikt dit om Waldo en Brigitte zonder apart wachtwoord toegang te geven.
5. Vervang in `index.html` de Supabase-URL en publishable key.
6. Vervang dezelfde twee openbare waarden in `.github/workflows/supabase-keepalive.yml`.
7. Test een nieuwe reis, paklijstwijziging, kostenpost, moment en foto-upload.

## Back-upgrens

De migration bewaart de structuur, niet de privé-inhoud. Voor reizen, foto's en bonnetjes is daarnaast een periodieke database- en Storage-export nodig. Een volledige automatische export vereist een beveiligde databaseverbinding als GitHub Secret; die wordt bewust niet in de openbare repository gezet.
