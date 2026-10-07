# Dagens tal

**Ett räknepussel om dagen.** Kombinera sex tal med + − × ÷ och försök nå
måltalet. Varje dag finns fem tal som blir lite svårare för varje steg, och
varje tal ger upp till tre stjärnor. Alla spelar samma tal samma dag.

## Så funkar det

- Tryck på ett tal, ett räknesätt och ett till tal. De två talen blir ett nytt tal.
- Det blir alltid heltal. Minus och delat tar automatiskt det större talet först.
- Exakt rätt ger ★★★, nära ger ★★, lite längre bort ger ★. Hur nära som räknas
  står vid varje tal.
- Kommer man inte ända fram kan man lämna in det tal som är närmast.
- En ledtråd visar första steget i en lösning men kostar en stjärna.

Spelet har också en delningsruta (🟩🟩🟨🟧⬜), statistik, antal dagar i rad,
tidigare dagar och obegränsade träningsrundor. Det har ljust och mörkt tema och
fungerar bra på mobilen.

## Garanterat lösbart

Varje måltal skapas genom att räkna med de sex talen, så det går alltid att nå
exakt. Sedan kontrollerar generatorn att talet inte går att nå med färre steg än
det är tänkt, så de svårare talen kräver verkligen fler steg:

| Tal | Stora tal (25–100) | Steg som krävs | Måltal |
| --- | --- | --- | --- |
| 1 | 0 | 2 | 12–60 |
| 2 | 1 | 2 | 30–150 |
| 3 | 1 | 3 | 100–400 |
| 4 | 2 | 3 | 150–600 |
| 5 | 2 | 4 | 250–999 |

Allt räknas fram i webbläsaren utifrån datumet. Det behövs ingen server och
inget byggsteg.

## Köra lokalt

```sh
npm start   # startar sidan på http://localhost:8080
npm test    # testar generatorn och poängreglerna (Node 20+)
```

Sidan kan läggas på vilken statisk webbhost som helst, till exempel GitHub Pages.

| Fil | Innehåll |
| --- | --- |
| `js/numbers.js` | Räknesätt, generator och lösare |
| `js/round.js` | Stjärnor, statistik och delningstext |
| `js/date.js` | Dagar och numrering (`EPOCH` = dag #1) |
| `js/app.js` | Gränssnittet |
