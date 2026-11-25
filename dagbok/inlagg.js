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
    }

  ]
};
