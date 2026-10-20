# TornadT

Track the Storm. Understand the Science.

TornadT is a tornado tracking, radar, weather, and historical tornado explorer for macOS and Windows. The historical catalogue is bundled locally, so search, filters, maps, statistics, and exports work without an account. Live feeds need an internet connection.

## Download and install

Download the latest installers from [TornadT GitHub Releases](https://github.com/krgkonekpro04-cpu/TornadT/releases/latest). Read the platform steps below if macOS or Windows blocks the app on first launch.

<h1>🍎 MAC — OPEN TORNADT (IMPORTANT)</h1>

<h2>STEP 1 — DOWNLOAD THE MAC DMG</h2>

Open [the latest TornadT release](https://github.com/krgkonekpro04-cpu/TornadT/releases/latest) and download the **arm64 `.dmg`** file for Apple silicon Macs. Open the downloaded `.dmg` file.

<h2>STEP 2 — INSTALL TORNADT</h2>

In the window that opens, drag **TornadT** onto **Applications**. Wait for the copy to finish, then eject the mounted TornadT disk image.

<h2>STEP 3 — CLEAR THE MAC DOWNLOAD BLOCK</h2>

This community build is not signed or notarized by Apple, so macOS may say that TornadT is damaged or cannot be opened. If that happens, open **Terminal** and paste this command exactly:

```sh
sudo xattr -cr /Applications/TornadT.app
```

Press **Return**, enter your Mac login password when asked, and press **Return** again. Terminal does not show password characters while you type. This removes extended attributes from the TornadT app bundle; use it only for TornadT downloaded from this repository’s official Releases page.

<h2>STEP 4 — OPEN THE APP</h2>

Open **Finder → Applications → TornadT**. If macOS asks you to confirm opening it, choose **Open**.

<h1>🪟 WINDOWS — SMARTSCREEN STEPS (IMPORTANT)</h1>

<h2>STEP 1 — DOWNLOAD AND INSTALL</h2>

Open [the latest TornadT release](https://github.com/krgkonekpro04-cpu/TornadT/releases/latest) and download the **Windows x64 `.exe` installer**. Run it and follow the installer.

<h2>STEP 2 — CHECK THE SOURCE</h2>

If Microsoft Defender SmartScreen shows **“Windows protected your PC,”** first verify that you downloaded the installer from the official TornadT Releases page linked above.

<h2>STEP 3 — CONTINUE PAST SMARTSCREEN</h2>

Select **More info**, check that the app is **TornadT**, then select **Run anyway**. Windows may ask for one more confirmation; choose **Yes** to continue.

<h2>STEP 4 — OPEN TORNADT</h2>

After installation, open **TornadT** from the Start menu or desktop shortcut. This community build is not code-signed, which can cause SmartScreen to show the warning. If Microsoft Defender reports a malware or virus detection, do not bypass that warning; delete the installer and report it in [GitHub Issues](https://github.com/krgkonekpro04-cpu/TornadT/issues).

## Update checks

The macOS and Windows desktop apps check GitHub Releases for a newer stable version each time they start. If one is available, TornadT offers to open the official download page. Updates are installed by downloading and running the new installer; the app does not silently replace itself.

## Run from source

Install Node.js 22 or newer, then run:

```sh
npm ci
npm run dev       # browser version
npm run desktop   # desktop app
```

Package installers with `npm run package:mac` on macOS or `npm run package:win` on Windows. To publish a release, push a version tag such as `v2.0.1`; GitHub Actions builds the installers and attaches them to a GitHub Release.

Live products use RainViewer radar, Open-Meteo weather and geocoding, and U.S. National Weather Service alerts. Historical tornado data remains available offline.
