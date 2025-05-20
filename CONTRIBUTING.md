# Contributing

Thank you for your interest in contributing to this project! Please follow these guidelines to get set up and submit changes smoothly.

---

## Prerequisites

Ensure you have the following installed and configured:

* **Node.js 22.15.0 LTS**
  Download from [https://nodejs.org/en/download/](https://nodejs.org/en/download/) and install with default settings.
  Verify with:

  ```bash
  node --version   # should output v22.15.0
  npm --version
  ```

* **Visual Studio Code**
  Download from [https://code.visualstudio.com/](https://code.visualstudio.com/) and install.

* **Git**
  Download from [https://git-scm.com/downloads](https://git-scm.com/downloads) and install.
  Configure your Git identity:

  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "you@example.com"
  ```

* **GitHub Account**
  Sign up at [https://github.com/join](https://github.com/join) and fork or clone the repositories.

* **Expo CLI via NPX**
  The Expo CLI is included in the project dependencies—no global install needed.
  You can run:

  ```bash
  npx expo start --help
  ```

  Docs: [https://docs.expo.dev/get-started/installation/](https://docs.expo.dev/get-started/installation/)

* **ngrok (optional)**
  For LAN testing with devices, download from [https://ngrok.com/download](https://ngrok.com/download), unzip, and add to your PATH.

---

## Local Setup

1. **Clone the repository**

   ```bash
   git clone git@github.com:jaketmemerYT/<repo-name>.git
   cd <repo-name>
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure the App** *(only for the mobile app repo)*

   * Open `App.js` and set your API base URL:

     ```js
     const API_BASE = 'http://<YOUR_WIFI_IP>:3000';
     ```

4. **Run the API** *(only for the API repo)*

   ```bash
   npm install         # if not done already
   node server.js
   ```

   Confirm you see:

   ```
   API listening on http://localhost:3000
   ```

5. **Run the App** *(only for the mobile app repo)*

   ```bash
   npx expo start --lan --clear
   ```

   * Scan the displayed QR code in Expo Go on a device connected to the same Wi‑Fi network.

---

## Development Workflow

* **Branching**

  ```bash
  git checkout -b feature/your-feature-name
  ```
* **Committing**
  Use clear, descriptive commit messages, for example:

  * `feat: add new Tracker screen`
  * `fix: correct leaderboard sorting`
  * `chore: update dependencies`
* **Pull Requests**

  1. Push your branch: `git push origin feature/your-feature-name`
  2. Open a pull request on GitHub and request reviews.

---

## Code Quality

* **IDE**
  Use the ESLint and Prettier extensions in VS Code to catch and fix issues as you code.
* **Manual checks**

  ```bash
  npx eslint .
  npx prettier --check .
  ```

---
## DEPLOYMENT

```bash
copy .\run_all.bat C:\Users\jaket\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
```

Thank you for contributing! Let’s build something amazing together.
