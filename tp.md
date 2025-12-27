# Centralized Event Platform

A full-stack, hackathon-ready event platform built with Expo (React Native + Web) and Firebase.

![Architecture](./docs/Architecture.md)

## Features
-   **Web & Mobile**: Fully responsive PWA (Expo).
-   **Role-Based Access**: Admins, Clubs, Students.
-   **Targeted Feeds**: Filter events by Department.
-   **Notifications**: In-app alerts and Reminders.
-   **Gamification**: Club reputation system.

## Setup Instructions

1.  **Clone the repository**.
2.  **Install dependencies**:
    ```bash
    cd app
    npm install
    cd ../cloud-functions
    npm install
    ```
3.  **Environment Setup**:
    - Copy `.env.template` to `app/.env`.
    - Fill in your Firebase credentials.
4.  **Run Locally** (You need two separate terminals):
    -   **Backend (Cloud Functions & Emulators)**:
        ```bash
        cd cloud-functions
        npm run serve
        ```
    -   **Frontend (App)**:
        ```bash
        cd app
        npx expo start --clear
        npx expo start --web --clear
        ```
        npx expo start --web --port 19006 --clear
        - Press `w` to run in Web Browser.
        - Scan QR code to run on Android Device (Expo Go).

## Deployment

-   **Web (PWA)**:
    ```bash
    cd app
    npx expo export:web
    firebase deploy --only hosting
    ```
-   **Functions**:
    ```bash
    firebase deploy --only functions
    ```

## Documentation
-   [Project Summary](./docs/Centralized_Event_Platform_Summary.md)
-   [Pitch Deck](./docs/Pitch_Deck.md)
-   [Architecture](./docs/Architecture.md)
