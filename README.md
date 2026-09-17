# Let'emCook 🍪🛡️

**Let'emCook** is an intelligent, privacy-focused browser extension that acts as your personal web privacy assistant. It automatically detects cookie-consent interfaces, analyzes tracking technologies, and automatically accepts or rejects cookies based on your personalized privacy preferences. 

Browse the web seamlessly without the endless interruption of irritating cookie popups, while maintaining total control over your digital footprint!

## 🎯 Purpose

The primary objective of Let'emCook is to eliminate the friction of cookie-consent banners while strictly enforcing your privacy choices. It is not just a simple "cookie blocker." It's a **Cookie Consent Decision Engine**, designed to understand what cookies are being used, what they do, and apply your preferences automatically.

## ✨ Features

- **Automated Cookie Consent:** Detects cookie banners and consent interfaces across the web and automatically interacts with them.
- **Smart Classification Engine:** Identifies and categorizes cookies (Necessary, Functional, Analytics, Advertising, Social Media).
- **Custom Privacy Profiles:** Allows you to set a preferred privacy level (e.g., Strict Privacy) and automatically enforces it (e.g., accepting Necessary cookies while rejecting Advertising and Analytics).
- **Declarative Net Request Rules:** Utilizes advanced Chrome APIs (`declarativeNetRequest`) for efficient network level blocking and rule enforcement.
- **Decision Transparency:** Records decisions locally and provides explanations on why certain cookies were accepted or rejected.
- **Interactive Dashboard:** A comprehensive dashboard to view statistics, manage your privacy profile, and monitor recent automated consent actions.

## 🛠️ Technologies & Tools Used

- **HTML5 & CSS3:** For structuring and styling the extension's popup and dashboard interfaces.
- **Vanilla JavaScript (ES6+):** Powers the core logic, content scripts, and background service workers without heavy framework dependencies.
- **Chrome Extension API (Manifest V3):** Built using the latest extension standard for better performance, privacy, and security.
  - `Service Workers` (`bg.js`) for background processing.
  - `Content Scripts` (`content.js`) for DOM manipulation and interacting with cookie banners on websites.
  - `Storage API` for saving user preferences and consent history.
  - `declarativeNetRequest` for network request interception and ad/tracker blocking.

## 📂 Project Structure

```text
├── VISION.md          # Comprehensive product vision and roadmap
├── bg.js              # Background service worker for extension lifecycle and core tasks
├── content.js         # Content script injected into pages to interact with consent UIs
├── dashboard.html     # Main dashboard interface
├── dashboard.js       # Logic for the dashboard UI
├── manifest.json      # Extension configuration and permissions (Manifest V3)
├── popup.html         # Extension popup HTML structure
├── popup.js           # Extension popup logic
└── rules.json         # Declarative Net Request rules for blocking trackers
```

## 🚀 Getting Started

### Installation (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/harshitxix/Let-emCook.git
   ```
2. Open Google Chrome (or any Chromium-based browser) and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click on the **Load unpacked** button.
5. Select the directory where you cloned the repository.
6. The Let'emCook extension is now installed and ready to cook! 🍳

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/harshitxix/Let-emCook/issues).

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
