# ♟️ Blind Chess (Szachy we Mgle)

![Blind Chess Banner](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20Socket.io-blue?style=for-the-badge)

Wkrocz na pole bitwy okryte gęstą mgłą wojny. **Blind Chess** to nowatorskie spojrzenie na klasyczną grę w szachy, wprowadzające unikalne mechaniki znane z gier wideo. W tej grze informacja to potęga, a każdy ruch może kryć za sobą nieprzewidywalne konsekwencje.

🎮 **Zagraj teraz:** [https://blindeschess.netlify.app/](https://blindeschess.netlify.app/)

---

## 🌟 Główne Funkcje i Unikalne Mechaniki

Klasyczne zasady szachów zostały zmodyfikowane, aby stworzyć dynamiczną, pełną napięcia rozgrywkę w warunkach ograniczonej widoczności:

- 🌫️ **Mgła Wojny (Fog of War):** Widzisz tylko swoje bierki. Reszta planszy jest spowita ciemnością. Zbieranie informacji jest kluczem do zwycięstwa.
- ❤️ **Król ma 5 żyć:** Król posiada pulę 5 punktów życia. Wejście na atakowane pole lub niemożność ucieczki przed szachem kosztuje 1 życie.
- 🧛 **Wampiryzm:** Bicie figur przeciwnika przywraca Twojemu królowi punkty życia (maksymalnie do 5).
- 🎯 **Ślepy Ostrzał (Blind Shot):** Figury dalekosiężne (Hetman, Wieża, Goniec) mogą "strzelać" w mgłę na oślep. Jeśli na ich drodze stoi wróg - zostaje zbity. Uwaga: sojusznicze jednostki blokują linię strzału!
- 📡 **Pionki Radarowe:** Pionki wykrywają wrogów znajdujących się bezpośrednio przed nimi. Ostrzegają o niebezpieczeństwie, a bicie pionkiem jest dozwolone tylko wtedy, gdy cel jest widoczny dla gracza.
- 👁️ **Awans na Obserwatora:** Pionek, który dotrze na koniec planszy, staje się "Obserwatorem". Obserwator rzuca potężne światło (odkrywa mgłę) w 8 kierunkach. Obserwator jest "pacyfistą" - może szachować wrogiego króla, ale nie może zbić innej figury.
- 🎭 **Tryb Widza (Spectator Mode):** Możliwość dołączenia do pokoju jako trzecia osoba. Widzowie obserwują starcie z pełną widocznością planszy ("God Mode").

## 🛠️ Technologie

Projekt został zbudowany z wykorzystaniem nowoczesnego stosu technologicznego:

- **Frontend:** React, Vite
- **Backend:** Node.js, Socket.io
- **Logika Szachowa:** Własny silnik rozszerzający możliwości biblioteki `chess.js`
- **Design:** Czysty, nowoczesny CSS

## 🚀 Jak zacząć? (Uruchomienie lokalnie)

Jeśli chcesz uruchomić projekt na własnym komputerze:

### 1. Klonowanie repozytorium
```bash
git clone <URL_REPOZYTORIUM>
cd blindChess
```

### 2. Uruchomienie Serwera (Backend)
```bash
cd server
npm install
npm run dev
```

### 3. Uruchomienie Klienta (Frontend)
W nowym oknie terminala:
```bash
cd client
npm install
npm run dev
```

Aplikacja będzie domyślnie dostępna pod adresem: `http://localhost:5173`

## 🕹️ Jak Grać z kimś w sieci?

1. Wejdź na stronę główną gry.
2. Kliknij **"Utwórz pokój"** (wygeneruje się unikalny kod np. `X7K9`).
3. Udostępnij wygenerowany kod swojemu przeciwnikowi.
4. Przeciwnik wybiera **"Dołącz do gry"** i wpisuje Twój kod.
5. Rozpoczyna się bitwa we mgle! 

