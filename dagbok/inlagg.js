/*
  LIMNAS DAGBOK — här skriver du in allt som syns på limna.se/dagbok/

  Nytt inlägg: kopiera ett block i `inlagg` nedan och klistra in det ÖVERST
  i listan (nyast först). Det är det enda du behöver göra.

    datum   "ÅÅÅÅ-MM-DD"
    rubrik  kort och gärna lite rolig
    text    en lista med stycken, ett stycke per rad med citattecken
    bilder  0–3 bilder. Lägg bildfilen i dagbok/bilder/ och skriv
            src: "bilder/filnamn.webp". alt beskriver bilden för den som
            inte ser den. text (valfri) blir en liten bildtext.
    siffra  valfri: [ "siffran", "vad den betyder" ]

  "justNu" och "agenda" är rutan högst upp på sidan. Ändra dem när läget ändras.
*/
window.DAGBOK = {

  justNu: "Vi ritar på hur bojen ska se ut, och letar efter gårdar som vill låna ut en damm till våren.",

  agenda: [
    { nar: "December", vad: "Välja form på bojen. Flyta ska den, det är vi överens om." },
    { nar: "Vintern",  vad: "Testa sensorer på labbänken innan de får blöta fötter." },
    { nar: "Våren",    vad: "Hitta pilotgårdar inför säsongen 2027." }
  ],

  inlagg: [

    {
      datum: "2026-11-25",
      rubrik: "Vi behöver din hjälp. På riktigt.",
      text: [
        "Ett studentprojekt kommer bara så långt på kaffe och goda föresatser. Så nu finns det ett formulär på startsidan där du kan gå med i teamet, låna ut en damm för pilot, vara bollplank eller bara följa med.",
        "Vi har också skaffat en LinkedIn-sida, vilket betyder att vi officiellt är vuxna nu. Typ."
      ],
      bilder: [
        { src: "../img/gard.webp", alt: "En gård med en damm bakom ett fält", text: "Tillfällig bild tills vi har egna." }
      ],
      siffra: ["4", "sätt att vara med"]
    },

    {
      datum: "2026-11-23",
      rubrik: "Hemsidan bytte kläder",
      text: [
        "Vi hade en hemsida där man åkte ut över en filmad åker när man skrollade. Den var häftig. Den var också lite som att läsa en broschyr på en karusell.",
        "Nu är den ljus, lugn och lätt att läsa. Det är den sjätte versionen, och vi lovar att den får stanna ett tag."
      ],
      bilder: [
        { src: "../img/majs.webp", alt: "Majsfält i motljus", text: "Tillfällig bild." },
        { src: "../img/droppar.webp", alt: "Vattendroppar på ett blad" }
      ],
      siffra: ["6", "versioner av hemsidan"]
    },

    {
      datum: "2026-11-18",
      rubrik: "Appen hann före bojen",
      text: [
        "Bojen finns inte än, men appen gör det. Vi byggde en demo med en påhittad damm, så att man kan klicka runt och se nivå, syre och temperatur redan nu.",
        "Det kan låta bakvänt. Men det är mycket lättare att fråga en lantbrukare vad den vill se i mobilen när man har en mobil att visa."
      ],
      bilder: [
        { src: "../img/sjo.webp", alt: "En stilla damm omgiven av vass", text: "Tillfällig bild." }
      ],
      siffra: ["0", "bojar i vattnet hittills"]
    }

  ]
};
