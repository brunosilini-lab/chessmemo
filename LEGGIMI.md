# ChessMemo — prima versione per iPad

App web statica: `index.html`, `app.js`, `manifest.webmanifest`, `icon.svg`.

## Pubblicazione gratuita con GitHub Pages
1. Crea un repository GitHub, per esempio `chessmemo` (l'app può essere in un repository pubblico, **non** contiene token o dati personali nei file pubblicati).
2. Carica i quattro file nella radice del repository.
3. Vai su **Settings → Pages → Build and deployment → Deploy from a branch**, scegli `main` e `/ (root)`, poi salva.
4. Apri in Safari su iPad l'indirizzo fornito da GitHub Pages (normalmente `https://TUO-USERNAME.github.io/chessmemo/`).
5. Tocca **Collega Lichess** e autorizza la lettura della cronologia dei problemi (`puzzle:read`). Non serve comunicare la password o un token.
6. Su Safari scegli **Condividi → Aggiungi alla schermata Home**.

Richiede una connessione Internet e l'accessibilità alla libreria `chess.js` da jsDelivr. I dati dell'archivio risiedono soltanto nel browser dell'iPad (`localStorage`): usa **Esporta archivio** per creare copie di sicurezza. Il token d'accesso viene mantenuto nella sessione browser, non incluso negli export.

## Comportamento
- Sincronizza la cronologia puzzle all'apertura, quando l'accesso è attivo, e su richiesta.
- Importa soltanto le attività con `win:false`; niente link da copiare.
- Il sabato presenta fino a 30 esercizi scaduti, selezionati in base alla data di ripasso e all'indice personale. Il pulsante **Prova il ripasso oggi** permette una sessione anche durante la settimana.
- Il primo errore resta registrato anche se si riprova; **Mostra soluzione** conta come errore.
- Difficoltà 1-5; gli intervalli sono una semplice euristica iniziale, da migliorare dopo aver raccolto dati reali.

## Limiti noti
- L'importazione iniziale esamina al massimo 7500 attività per evitare richieste illimitate. Successive sincronizzazioni leggono le attività più recenti.
- Non si sincronizza quando l'app è chiusa: su iPad la sincronizzazione avviene quando apri ChessMemo o premi **Sincronizza**.
- Nessun server o account ChessMemo: i dati si possono perdere cancellando quelli di Safari. Usare esportazione periodica.
- Il sabato sono disponibili fino a 30 esercizi *scaduti*; non vengono riempiti con esercizi nuovi.
- La scacchiera usa un primo prototipo touch con selezione di origine e destinazione. Non sono inclusi drag-and-drop, suoni o animazioni.
- OAuth e le chiamate API devono essere provati su un indirizzo HTTPS pubblicato e autorizzato dal browser; questo pacchetto non può confermare il funzionamento con il tuo account reale senza l'autorizzazione.


## Inizio archivio e quantità giornaliera

- La raccolta degli errori inizia il **13 ottobre 2026 alle 00:00 (ora italiana)**. La prima sincronizzazione non importa gli errori precedenti, anche se presenti nel profilo Lichess.
- Non esiste una quota giornaliera: puoi fare liberamente 3, 10, 20 o più problemi al giorno.
- Il ripasso del sabato propone al massimo 30 problemi in scadenza; se ce ne sono meno, propone soltanto quelli disponibili.
- La data di partenza viene applicata anche a successive sincronizzazioni: un tentativo precedente non viene importato.
- La sezione di inserimento manuale rimane facoltativa e consente di aggiungere esplicitamente altri problemi.
