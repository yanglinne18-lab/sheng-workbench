# iOS App Prototype

This project uses Capacitor to wrap the Sheng Workbench web app as an iOS app prototype.

## Current Mode

The iOS app shell loads the hosted workbench:

https://yanglinne18-lab.github.io/sheng-workbench/

That means ordinary web UI fixes can be published to the web app and picked up by the iOS shell the next time it loads the page.

The generated iOS project is under:

```bash
ios/App/App.xcodeproj
```

## Useful Commands

Install dependencies:

```bash
npm install
```

Build and sync web resources into the iOS project:

```bash
npm run cap:sync
```

Open the iOS project in Xcode:

```bash
npm run ios:open
```

## Notes

- The first prototype intentionally uses a remote URL so the app can follow web-side updates.
- For formal internal use, replace the GitHub Pages URL in `capacitor.config.ts` with a company-controlled HTTPS or intranet URL.
- The native notification plugin is not installed yet; that belongs to the next step.
- This machine has been verified with Xcode 26.5 and the iOS 26.5 simulator runtime. If a new Mac cannot see simulator destinations, install the matching iOS platform runtime from Xcode Settings > Components.
- Command-line verification used an iPhone 17 / iOS 26.5 simulator and produced a working `com.sheng.workbench` app launch.
