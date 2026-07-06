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
- On this machine, `xcodebuild -list` can read the project, but command-line builds report an out-of-date CoreSimulator framework. Update Xcode/macOS simulator components or run from Xcode with an available device before testing on a simulator.
