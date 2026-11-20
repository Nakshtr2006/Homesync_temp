# HomeSync

HomeSync is a smart home web app for managing rooms, devices, account settings, and contact messages.

## Team

- Arjan Khandelwal (https://github.com/arjan-74/)
- Chahat Yadav (https://github.com/chahatyadav25cse-ship-it)
- Trisha Alankar (https://github.com/trishaalankar19)

## Running it

```
npm install
npm start
```

Open http://localhost:3000.

Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string. The database name `homesync` belongs in the path, before the `?`.

- `PORT`: port to listen on (default 3000)
- `CLIENT_ORIGIN`: website allowed to call the API (default: any address)
- `DATA_DIR`: folder for the JSON files (default: `data`)

## Pages

| Page | What it does |
| --- | --- |
| Dashboard, Rooms, Devices | `index.html`. Rooms and devices are loaded from the API. The weather panel calls the Open-Meteo API. |
| Login | `login.html`. Create an account or log in. |
| Settings | `settings.html`. Update the profile, password, and preferences. |
| Contact | `contact.html`. Send a message and see the messages saved on this computer. |

## Where data is stored

Accounts and contact messages are saved as JSON files through Express:

- `data/users.json`
- `data/messages.json`

Rooms and devices are saved in MongoDB through Express.

## External API

HomeSync integrates external weather services from Open-Meteo. The Express backend exposes `/api/weather?city=...`, which connects to Open-Meteo's geocoding and forecast APIs, processes the weather metrics, and delivers the live temperature and weather condition to the frontend dashboard. The temperature dynamically adheres to the °C/°F preference configured in Settings.

## API

All request and response bodies are JSON.

| Method | Route | Storage | What it does |
| --- | --- | --- | --- |
| GET | /api/health | — | Server status, including whether MongoDB is connected |
| GET | /api/weather | External API (Open-Meteo) | Fetch live weather & temperature for a given `?city=...` |
| GET | /api/devices | MongoDB | List all devices |
| GET | /api/devices/:id | MongoDB | Get a single device by ID |
| POST | /api/devices | MongoDB | Add a device (`name`, `room`, `type`) |
| PATCH | /api/devices/:id | MongoDB | Update a device, including `isOn` |
| DELETE | /api/devices/:id | MongoDB | Remove a device |
| GET | /api/rooms | MongoDB | List rooms with device counts |
| GET | /api/rooms/:id | MongoDB | Get a single room by ID with device count |
| POST | /api/rooms | MongoDB | Add a room (`name`) |
| PATCH | /api/rooms/:id | MongoDB | Rename a room |
| DELETE | /api/rooms/:id | MongoDB | Remove a room |
| POST | /api/users/signup | JSON | Create an account (`name`, `email`, `password`) |
| POST | /api/users/login | JSON | Log in (`email`, `password`) |
| PATCH | /api/users/:id | JSON | Change name or email (`name`, `email`, `currentPassword`) |
| PATCH | /api/users/:id/password | JSON | Change the password |
| DELETE | /api/users/:id | JSON | Delete the account (`currentPassword`) |
| GET | /api/messages | JSON | List contact messages |
| POST | /api/messages | JSON | Save a contact message (`name`, `email`, `subject`, `message`) |

Errors come back as `{ "error": "message" }` with a matching status code.

## Notes

- Passwords are hashed with scrypt and are never returned by the API.
- Changing a profile, a password, or deleting an account requires the current password.
- The first time MongoDB connects to an empty database, the server adds three sample rooms and four sample devices.
