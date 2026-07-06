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

## Local Notifications

The iOS prototype includes `@capacitor/local-notifications`.

The dashboard has a local notification test control. On a real iPhone, tap "测试通知" to request notification permission and schedule a short test reminder.

## Install On A Real iPhone

1. Connect the iPhone to this Mac with USB, unlock it, and tap "Trust This Computer" if prompted.
2. Open the project:

```bash
npm run ios:open
```

3. In Xcode, select the `App` project, then the `App` target.
4. Open "Signing & Capabilities" and choose your Apple ID or Apple Developer Team under "Team".
5. If Xcode says the bundle identifier is unavailable, change `com.sheng.workbench` to a unique identifier such as `com.yanglinne18.shengworkbench`.
6. Select the connected iPhone in the Xcode toolbar and click Run.
7. If iOS blocks the app as an untrusted developer, open iPhone Settings > General > VPN & Device Management and trust the developer profile.
8. Open "盛老师工作台" on the iPhone and tap "测试通知" to verify local notification permission and delivery.

With a free Apple ID, the installed development app may need to be re-signed after several days. TestFlight or an Apple Developer Program team is the cleaner path for sharing it with Sheng Laoshi later.

## Notes

- The first prototype intentionally uses a remote URL so the app can follow web-side updates.
- For formal internal use, replace the GitHub Pages URL in `capacitor.config.ts` with a company-controlled HTTPS or intranet URL.
- The native notification plugin is installed for local, on-device reminders. Server-side push notifications can be added later when the internal API and deployment path are ready.
- This machine has been verified with Xcode 26.5 and the iOS 26.5 simulator runtime. If a new Mac cannot see simulator destinations, install the matching iOS platform runtime from Xcode Settings > Components.
- Command-line verification used an iPhone 17 / iOS 26.5 simulator and produced a working `com.sheng.workbench` app launch.
