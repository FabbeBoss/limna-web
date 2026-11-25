/*
  LIMNAS DAGBOK — här skriver du in allt som syns på limna.se/dagbok/

  Nytt inlägg: kopiera ett block i `inlagg` nedan och klistra in det ÖVERST
  i listan (nyast först). Det är det enda du behöver göra.

    datum   "ÅÅÅÅ-MM-DD", eller "ÅÅÅÅ-MM" om bara månaden är känd
    etikett valfri: ett litet ord ovanför rubriken, t.ex. "Pitch"
    rubrik  kort och gärna lite rolig
    text    en lista med stycken, ett stycke per rad med citattecken
    bilder  0–3 bilder. Lägg bildfilen i dagbok/bilder/ och skriv
            src: "bilder/filnamn.webp". alt beskriver bilden för den som
            inte ser den. text (valfri) blir en liten bildtext.
    siffra  valfri: [ "siffran", "vad den betyder" ]

  "justNu" och "agenda" är rutan högst upp på sidan. Ändra dem när läget ändras.
*/
window.DAGBOK = {

  justNu: "Vi väntar på sensorer, och kopplar under tiden ihop allt vi kan med det som redan har kommit.",

  agenda: [
    { nar: "Snart",              vad: "Sean och Vilmer håller lunchföreläsning på SLU. Kom och ät smörgås med oss." },
    { nar: "När paketen kommer", vad: "Koppla in sensorerna och se om de mäter något vettigt. Eller något alls." },
    { nar: "Våren",              vad: "Hitta gårdar som vill testa bojen säsongen 2027." }
  ],

  inlagg: [

    {
      datum: "2026-11-25",
      rubrik: "Delarna har börjat trilla in",
      text: [
        "Vi har beställt sensorer och elektronik, och de första delarna har kommit. Det betyder att vi har en ESP32 som blinkar blått på bordet och ser väldigt nöjd ut med sig själv.",
        "Sensorerna är fortfarande på väg. Under tiden har vi ritat upp hur allt ska kopplas ihop på whiteboarden. Dödskallen på kretskortet är inte en varning. Tror vi."
      ],
      bilder: [
        { src: "bilder/esp32-pa-bordet.webp", alt: "Ett litet kretskort, en ESP32, kopplat med sladd till en bärbar dator på ett vitt bord", text: "Första delen på plats. Den blinkar." },
        { src: "bilder/whiteboard-kopplingsschema.webp", alt: "En whiteboard med ett kopplingsschema i rött och grönt runt en ESP32 med en dödskalle ritad på", text: "Kopplingsschemat, version whiteboard." }
      ],
      siffra: ["1", "kretskort som blinkar. Resten är på posten."]
    },

    {
      datum: "2026-11-23",
      rubrik: "En hemsida och en app, innan bojen",
      text: [
        "Bojen finns inte än, men hemsidan gör det. Och en demo-app med en påhittad damm, så att man kan klicka runt och se nivå, syre och temperatur redan nu.",
        "Det kan låta bakvänt. Men det är mycket lättare att fråga en lantbrukare vad den vill se i mobilen när man har en mobil att visa. Hemsidan har för övrigt hunnit byta stil några gånger. Den här får stanna, lovar vi."
      ],
      bilder: [
        { src: "bilder/teammote-hemsidan.webp", alt: "Två i teamet vid ett mötesbord, med limna.se öppen på en bärbar dator i förgrunden", text: "Veckomöte. Hemsidan i förgrunden, och en sprakande brasa på tv:n för att maximera stämningen." }
      ],
      siffra: ["1", "app för en boj som inte finns än"]
    },

    {
      datum: "2026-11-10",
      rubrik: "Två nya i båten",
      text: [
        "Fabian och Egon har gått med i teamet, och nu är vi fyra. De håller fortfarande på att lära sig var kaffet står, men har redan byggt både hemsida och app.",
        "Vi har också börjat jobba regelbundet, med fasta tider varje vecka. Det låter kanske inte så spännande, men det är där saker faktiskt blir gjorda."
      ],
      bilder: [
        { src: "bilder/jobb-vid-bordet.webp", alt: "En i teamet jobbar vid en bärbar dator, med en multimeter och lösa elektronikdelar på bordet", text: "Fasta tider, multimeter och total koncentration." }
      ],
      siffra: ["4", "i teamet"]
    },

    {
      datum: "2026-08",
      etikett: "Mässa",
      rubrik: "Grillat på TechBBQ",
      text: [
        "I slutet av augusti var vi på TechBBQ, en nordisk mässa för tech och startups. Det betyder mycket folk, mycket kaffe och mycket ord som slutar på -tech.",
        "Vi fick sitta på scenen också. Grillen såg vi inte till, men namnet lovade ingenting."
      ],
      bilder: [
        { src: "bilder/techbbq.webp", alt: "Fyra personer sitter på en scen under en stor skylt med texten TechBBQ", text: "TechBBQ, slutet av augusti." }
      ],
      siffra: ["1", "nordisk startupmässa"]
    },

    {
      datum: "2026-05",
      etikett: "Finansiering",
      rubrik: "Leapfrogs sa ja. Och sen blev det sommar.",
      text: [
        "Vi har fått ett Leapfrogs-bidrag (då hette vi HydroVault). Pengarna ska hjälpa oss att verifiera både tekniken och affären under 2026. I praktiken betyder det fler och längre samtal med kunder, rådgivning kring regler och förberedelser inför en pilot.",
        "Sen blev det sommar, och sommaren gick till en whiteboard som till slut inte hade en enda vit fläck kvar. Red Bull sponsrade oss, vilket kanske förklarar en del av whiteboarden.",
        "Det lönade sig. Vi vann Best Summer Progress i Leapfrogs 2026, och priset var ett års medlemskap i Connect Syd."
      ],
      bilder: [
        { src: "bilder/sommarplanering-whiteboard.webp", alt: "Två i teamet framför en whiteboard full med anteckningar, i ett ljust rum med fönster mot grönska", text: "Sommarplanering. Whiteboarden gav upp före oss." },
        { src: "bilder/red-bull-selfie.webp", alt: "Selfie med två i teamet framför en hög med burkar Red Bull", text: "Sponsringen har landat." },
        { src: "bilder/red-bull-burkar.webp", alt: "Två i teamet håller fram var sin burk Red Bull, fotat uppifrån" }
      ],
      siffra: ["1", "år i Connect Syd, för Best Summer Progress"]
    },

    {
      datum: "2026-06-20",
      etikett: "Tävling",
      rubrik: "Vilmer kom hem med två diplom",
      text: [
        "Vilmer tävlade i Emax Challenge 2026 by LF Kalmar, och kom hem med två diplom: Bästa pitch och Logo challenge.",
        "Pitcha kan han, uppenbarligen. Rita logga också."
      ],
      bilder: [
        { src: "bilder/emax-vilmer.webp", alt: "Vilmer i kavaj håller upp två inramade diplom från Emax Challenge 2026", text: "Ett diplom i varje hand." }
      ],
      siffra: ["2", "diplom, en Vilmer"]
    },

    {
      datum: "2026-02",
      etikett: "Partnerskap",
      rubrik: "LU Innovation är med hela 2026",
      text: [
        "Samarbetet med LU Innovation är nu formaliserat för hela 2026.",
        "Det ger oss stöd i affärsutvecklingen, ett nätverk och tillgång till Lunds universitets innovationsinfrastruktur. Plötsligt har vi folk att fråga när vi inte vet. Vilket händer oftare än man kan tro."
      ],
      bilder: [],
      siffra: ["12", "månader med LU Innovation"]
    },

    {
      datum: "2025-05",
      etikett: "Pitch",
      rubrik: "Draknästet, lokalt",
      text: [
        "Vi spolar tillbaka lite. Sean ställde sig framför en jury av investerare och entreprenörer i en lokal Draknäste-tävling och pitchade idén. Då hette vi HydroVault.",
        "Namnet har bytts sedan dess. Idén har vi kvar."
      ],
      bilder: [],
      siffra: ["1", "jury av investerare och entreprenörer"]
    }

  ]
};
