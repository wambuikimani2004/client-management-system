# Abijay Client Management App

Simple insurance client management system with:
- Client CRUD and claims/records
- Insurance expiry dashboard (days remaining)
- Admin login (USERNAME: ABIJAY, PASSWORD: ABIJAY2026#)
- Business type (New Business / Renewal / Extension)

## Quick start (local)

1. Install dependencies (root and client):

```bash
npm install
cd client
npm install
```

2. Run the server and client (development):

```bash
# from project root
npm run dev
```

3. Open the frontend at `http://localhost:3000`.

## Environment

- `REACT_APP_API_URL` — set this in Vercel to your backend URL (e.g. `https://your-backend.onrender.com`).

## Deployment

Recommended: Frontend on Vercel, Backend on Render (or Railway).

Frontend (Vercel):
- Root directory: `client`
- Build command: `npm run build`
- Output directory: `build`
- Set `REACT_APP_API_URL` to the backend URL

Backend (Render):
- Connect repo, build command: `npm install`, start command: `npm start`

## Admin credentials

- Username: `ABIJAY`
- Password: `ABIJAY2026#`

## Notes
- The app uses an SQLite file `clients.db`. For production consider using a managed DB or ensure your host persists files.# Insurance Client Management System

A full-stack web application for managing insurance client records and claims tracking.

## Features

- **Client Management**: Add, edit, and manage insurance client information including policy numbers and insurance types
- **Claims Tracking**: Record and track insurance claims with claim numbers, amounts, dates, and status
- **Quick Access**: Click on any client to view all their information and claims history
- **Status Tracking**: Monitor claim status (Pending, Approved, Rejected, In Review)

## Technology Stack

- **Backend**: Node.js with Express.js
- **Frontend**: React
- **Database**: SQLite3
- **HTTP Client**: Axios

## Installation

### Prerequisites
- Node.js (v14+)
- npm

### Setup

1. Navigate to the project directory:
```bash
cd client-management-app
```

2. Install all dependencies:
```bash
npm run install-all
```

This will install dependencies for both the main app and the React client.

## Development

Start both the backend server and frontend development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000` and the API at `http://localhost:5000`

### Individual Services

- **Backend only**: `npm run server`
- **Frontend only**: `npm run client`

## API Endpoints

### Clients
- `GET /api/clients` - Get all clients
- `GET /api/clients/:id` - Get client with all claims
- `POST /api/clients` - Add new client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Claims
- `POST /api/clients/:clientId/records` - Add claim for client
- `DELETE /api/records/:id` - Delete claim

## Database Schema

### Clients Table
- `id` - Unique identifier
- `name` - Client name
- `email` - Email address
- `phone` - Phone number
- `address` - Physical address
- `policyNumber` - Insurance policy number
- `insuranceCategory` - Category of insurance (Motor, Commercial, PSV, etc.)
- `insuranceType` - Specific type within the category
- `createdAt` - Creation timestamp

### Records Table (Claims)
- `id` - Unique identifier
- `clientId` - Reference to client
- `claimNumber` - Claim number
- `claimAmount` - Claim amount in dollars
- `claimDate` - Date of claim
- `status` - Claim status (Pending, Approved, Rejected, In Review)
- `description` - Additional notes
- `createdAt` - Creation timestamp

## Insurance Categories & Types

The system supports the following insurance categories and types:

### 1. Motor - Vehicle
- Comprehensive
- TPO (Third Party Only)

### 2. Commercial Vehicle
- Commercial Van
- Commercial Truck
- Commercial Vehicle

### 3. Private Cars
- Private Sedan
- Private SUV
- Private Hatchback

### 4. PSV/Uber/Taxi
- Uber
- Taxi
- Matatu
- PSV
- PSV Bus

### 5. Motorcycle
- Private Motorcycle
- Commercial Motorcycle

### 6. TukTuk
- TukTuk

### 7. Non-Motor - Property
- Fire
- Theft
- Burglary
- Property Coverage

### 8. Personal Accident
- Domestic PA
- Student PA
- Personal Accident

## Usage

1. **Add a Client**: Use the "Add New Client" form on the left panel to enter client information
2. **Select Insurance Category**: Choose from the predefined categories (Motor, Commercial Vehicle, etc.)
3. **Select Insurance Type**: The available types update based on your category selection
4. **View Client Details**: Click on any client name to see their full profile
5. **Edit Client**: Click the "Edit" button to modify client information
6. **Add Claims**: Use the "Add New Claim" form to record insurance claims
7. **View Claims**: All claims for a client are displayed in the Claims History section
8. **Delete Records**: Use delete buttons to remove clients or claims

## File Structure

```
client-management-app/
├── server.js                 # Express backend server
├── clients.db               # SQLite database (auto-created)
├── package.json             # Main app dependencies
├── client/
│   ├── package.json         # React app dependencies
│   ├── public/
│   │   └── index.html       # HTML template
│   └── src/
│       ├── App.js           # Main React component
│       └── index.css        # Styling
└── README.md                # This file
```

## License

ISC
