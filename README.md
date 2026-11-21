# HomeSync - Smart Home Management Platform

HomeSync is a full-stack Smart Home Management Web Application for managing connected devices, rooms, user account settings, live outdoor weather, and contact messages.

## Team

- Arjan Khandelwal (https://github.com/arjan-74/)
- Chahat Yadav (https://github.com/chahatyadav25cse-ship-it)
- Trisha Alankar (https://github.com/trishaalankar19)

## Evaluation Requirements

This project fulfills all four university evaluation parameters:

1. **External API Calls**: Connects to the Open-Meteo external geocoding and forecast service through the Express backend (`GET /api/weather?city=...`) to display live temperature and conditions.
2. **Node.js & Express.js Setup**: Modular backend architecture in `backend/` with clean controllers, routes, middleware, validation, and error handling.
3. **Local JSON File Persistence**: Contact messages API (`/api/messages`) performs safe CRUD operations on local JSON storage (`data/messages.json`) and mirrors records to MongoDB.
4. **Complete MongoDB Atlas CRUD**: Full CRUD operations for Devices (`/api/devices`), Rooms (`/api/rooms`), and Users (`/api/users` & `/api/auth`) managed in MongoDB Atlas with Mongoose.

## Architecture & Directory Structure

```
backend/
  server.js
  package.json
  .env
  .gitignore
  data/
    messages.json
  src/
    index.js
    app.js
    configuration/
      database.js
      constants.js
      seed.js
    controllers/
      auth.controller.js
      user.controller.js
      device.controller.js
      room.controller.js
      message.controller.js
      weather.controller.js
    routes/
      auth.routes.js
      user.routes.js
      device.routes.js
      room.routes.js
      message.routes.js
      weather.routes.js
    models/
      user.model.js
      device.model.js
      room.model.js
      message.model.js
    middleware/
      auth.middleware.js
      error.middleware.js
    utils/
      password.js
      validation.js
      token.js
```

## Running the Application

### 1. Configure Environment Variables

Create or edit `.env` (in root or `backend/.env`):

```env
PORT=3000
MONGODB_URI=mongodb+srv://<db_user>:<db_password>@cluster0.ed0icoo.mongodb.net/homesync?compressors=zlib&retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_2026
CLIENT_ORIGIN=http://localhost:3000
```

### 2. Install & Start Server

From the project root:

```bash
npm install
npm start
```

Or from the `backend/` folder:

```bash
cd backend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 3. Verify Live MongoDB Atlas Connection

To test and verify the live connection, ping the cluster, and inspect collection document counts:

```bash
npm run verify:atlas
```

### 4. Run Automated Tests

To run the complete automated test suite (QA audit suite and integration test suite):

```bash
npm test
```

## API Endpoints

All request and response bodies use JSON.

| Method | Endpoint | Storage | Description |
| --- | --- | --- | --- |
| **GET** | `/api/health` | Memory / DB | Health check & MongoDB Atlas connection status |
| **GET** | `/api/weather?city=...` | External API | Live weather & forecast from Open-Meteo |
| **POST** | `/api/auth/signup` | MongoDB | Register new user, hash password, generate JWT |
| **POST** | `/api/auth/login` | MongoDB | Authenticate user, return JWT session token |
| **GET** | `/api/auth/me` | MongoDB | Get current authenticated user profile |
| **GET** | `/api/users/:id` | MongoDB | Fetch user profile and preferences |
| **PATCH / PUT**| `/api/users/:id` | MongoDB | Update user name and email |
| **PATCH** | `/api/users/:id/password` | MongoDB | Secure password change |
| **PATCH** | `/api/users/:id/preferences` | MongoDB | Save theme, language, and unit preferences |
| **DELETE** | `/api/users/:id` | MongoDB | Delete account and cascade-delete user devices/rooms |
| **POST** | `/api/devices` | MongoDB | Add device associated with user |
| **GET** | `/api/devices` | MongoDB | Get all devices for authenticated user |
| **GET** | `/api/devices/:id` | MongoDB | Get single device by ID |
| **PUT** | `/api/devices/:id` | MongoDB | Full update of device details |
| **PATCH** | `/api/devices/:id` | MongoDB | Partial update / toggle device ON/OFF status |
| **DELETE** | `/api/devices/:id` | MongoDB | Remove device from MongoDB |
| **POST** | `/api/rooms` | MongoDB | Add new room for authenticated user |
| **GET** | `/api/rooms` | MongoDB | Get user rooms with dynamic `deviceCount` |
| **GET** | `/api/rooms/:id` | MongoDB | Get single room by ID with `deviceCount` |
| **PUT** | `/api/rooms/:id` | MongoDB | Full update / rename room |
| **PATCH** | `/api/rooms/:id` | MongoDB | Partial update / rename room (cascades device room) |
| **DELETE** | `/api/rooms/:id` | MongoDB | Remove room from MongoDB |
| **POST** | `/api/messages` | Local JSON & MongoDB | Submit contact message to `messages.json` and MongoDB |
| **GET** | `/api/messages` | Local JSON | Retrieve saved contact messages |
| **GET** | `/api/messages/:id` | Local JSON | Retrieve single contact message by ID |
| **PUT** | `/api/messages/:id` | Local JSON & MongoDB | Update contact message |
| **DELETE** | `/api/messages/:id` | Local JSON & MongoDB | Delete contact message |

## Security Features

- Passwords hashed with bcrypt (salt rounds 10) + constant-time comparison.
- Password hashes are never exposed in any API response or JSON output.
- JWT tokens used for stateful, secure user sessions.
- Two-user authorization checks: users can only manage their own devices and rooms.
- Centralized error handler protects against malformed JSON, entity-too-large, and CastError attacks.
- Environment variables (`.env`) protected and omitted from version control.
