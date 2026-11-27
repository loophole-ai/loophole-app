import { copyFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { Arch, type Configuration } from "electron-builder"
import { NativeArch } from "../../script/native-arch"
import { DESKTOP_NATIVE_ENGLISH } from "@opencode/app/i18n/desktop-native"
import { CLI_BINARIES, getCurrentCli, nodePtyPackage } from "./script/utils"
import { previewBinding, verifyPreviewBinding } from "./script/preview-binding"

const packageDir = path.dirname(fileURLToPath(import.meta.url))

const rootDir = path.resolve(packageDir, "../..")

const signScript = path.join(rootDir, "script", "sign-windows.ps1")

// rpmbuild adds /usr/lib/.build-id links for every ELF file. The bundled Electron
// binaries are byte-identical across apps on the same Electron version, so those
// links collide with other Electron RPMs (Slack, Unity Hub, ...) and rpm/zypper
// refuse to install or update. They only serve debuginfo lookup, so skip them.
// fpm only accepts flags before the first src=dest mapping, so keep this first.
const rpmNoBuildIdLinksFpm = "--rpm-rpmbuild-define=_build_id_links none"


const metainfoFpm = (appId: string) =>
  `${path.join(packageDir, "resources", `${appId}.metainfo.xml`)}=/usr/share/metainfo/${appId}.metainfo.xml`

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return

  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir, windowsHide: true },
  )
}

function macSignOptions(options: CustomMacSignOptions): CustomMacSignOptions {
  return {
    ...options,
    optionsForFile: (file) => {
      const defaults = options.optionsForFile?.(file)

      if (file !== path.join(options.app, "Contents/Resources/loophole-cli")) return defaults ?? {}

      // The Bun CLI loads bun-pty's native library; Electron and its helpers do not need this exception.
      return { ...defaults, entitlements: path.join(packageDir, "resources/entitlements.cli.plist") }
    },
  }
}

function resolveChannel() {
  const raw = process.env.OPENCODE_CHANNEL

  if (raw === "dev" || raw === "beta" || raw === "prod") return raw

  if (raw === "latest") return "prod"

  return "dev"
}

const APP_IDS = {
  dev: "ai.loophole.desktop.dev",
  beta: "ai.loophole.desktop.beta",
  prod: "ai.loophole.desktop",
} as const

// libappimage (used by AppImageLauncher) resolves the .desktop entry inside an
// AppImage by globbing `*.desktop` at the squashfs root. If the main
// executable itself ends in `.desktop` (prod appId `ai.opencode.desktop`), the
// ELF binary matches the glob and is parsed as a desktop entry, so
// integration fails with `Malformed desktop entry: Unexpected char '\x7f' at 0`
// (0x7F is the first byte of the ELF magic).
// https://github.com/anomalyco/opencode/issues/51867
// Strip a trailing `.desktop` so the executable can never collide with the
// desktop-entry glob. Beta/dev appIds end in `.beta`/`.dev` and are unaffected.
function linuxExecutableName(appId: string): string {
  return appId.replace(/\.desktop$/, "")
}

const getBase = (appId: string): Configuration => {
  const target = getCurrentCli()
  const binding = previewBinding(target.os, target.cpu)
  const desktopName = `${appId}.desktop`

  return {
    artifactName: "loophole-desktop-${os}-${arch}.${ext}",
    directories: {
      output: "dist",
      buildResources: "resources",
    },
    // Linux launchers are .desktop files, so this is the desktop file name,
    // not just the app id. For prod, app id "ai.opencode.desktop" becomes
    // "ai.opencode.desktop.desktop".
    // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
    // https://www.electron.build/docs/linux/
    // Release builds take their version from OPENCODE_VERSION instead of rewriting package.json.
    extraMetadata: process.env.OPENCODE_VERSION
      ? { desktopName, version: process.env.OPENCODE_VERSION }
      : { desktopName },
    files: [
      "out/**/*",
      "resources/**/*",
      "!resources/loophole-cli*",
      `!**/node_modules/@yuuang/ffi-rs-!(${binding}){,/**/*}`,
      // Keep only the target platform's node-pty prebuild when cross-packaging with --cpu=*.
      ...CLI_BINARIES.filter((item) => item.os !== target.os || item.cpu !== target.cpu).map(
        (item) => `!**/node_modules/@lydell/node-pty-${item.os}-${item.cpu}{,/**/*}`,
      ),
      // Log export imports Zip.js as ESM. Keep index.js and lib, including its inline worker.
      "!**/node_modules/@zip.js/zip.js/dist{,/**/*}",
      "!**/node_modules/@zip.js/zip.js/{index.cjs,index.min.js,index-fflate.js,deno.json,eslint.config.mjs}",
      // Nothing executes type declarations or source maps, and every entry costs startup time: the
      // main process parses the whole asar header before it runs any JavaScript.
      "!**/node_modules/**/*.d.{ts,cts,mts}",
      "!**/node_modules/**/*.d.{ts,cts,mts}.map",
      "!**/node_modules/**/*.{js,cjs,mjs}.map",
      // These packages execute compiled JavaScript, not their sources.
      "!**/node_modules/ajv/lib{,/**/*}",
      "!**/node_modules/ajv-formats/src{,/**/*}",
      // Keep js-yaml's CommonJS sources and dist/js-yaml.mjs ESM entry, not browser bundles or its CLI.
      "!**/node_modules/js-yaml/dist/{js-yaml.js,js-yaml.min.js,*.map}",
      "!**/node_modules/js-yaml/bin{,/**/*}",
    ],
    asarUnpack: ["**/node_modules/ffi-rs/**/*", `**/node_modules/@yuuang/ffi-rs-${binding}/**/*`],
    extraResources: [
      {
        from: "resources/",
        to: "",
        filter: ["loophole-cli", "loophole-cli.exe", "loophole-cli.version"],
      },
    ],
    // Electron stores cookies in plain text by default. The browser pane keeps sign-ins, so encrypt them with the OS
    // key store (Keychain, DPAPI, libsecret or kwallet). This is one-way: turning it off again loses every cookie.
    // https://www.electronjs.org/docs/latest/tutorial/fuses#cookieencryption
    // Flipping a fuse breaks the macOS signature. A build without a signing identity is not signed again, so re-sign it
    // ad hoc or Apple Silicon refuses to launch it. A signed build is signed again after the fuses anyway.
    electronFuses: {
      enableCookieEncryption: true,
      // Started as plain Node (ELECTRON_RUN_AS_NODE) or with an inspector, the signed binary would run any code under
      // the app's identity, which macOS lets read the app's Keychain key and so every cookie. Nothing runs the app as
      // Node: the CLI is its own executable. Beta keeps --inspect, as it keeps its on-request debugging port, for the
      // startup benchmark's Node timings (perf/startup.bench.ts).
      runAsNode: false,
      enableNodeCliInspectArguments: resolveChannel() === "beta",
      // NODE_OPTIONS stays: a packaged app already ignores every option but --http-parser and --max-http-header-size,
      // and turning the fuse off would also strip NODE_EXTRA_CA_CERTS from the environment the CLI and its terminals get.
      resetAdHocDarwinSignature: true,
    },
    afterPack: async (context) => {
      const arch = Arch[context.arch]

      // The --arm64 flag picks Electron while OPENCODE_TARGET picks the CLI and node-pty, so they can disagree.
      if (arch !== "x64" && arch !== "arm64") throw new Error(`Unsupported desktop architecture: ${arch}`)

      if (arch !== target.cpu) throw new Error(`Packaging ${arch} Electron with the ${target.target} CLI`)
      const resources = context.packager.getResourcesDir(context.appOutDir)
      await verifyPreviewBinding(resources, context.electronPlatformName, arch)
      const cli = path.join(resources, context.electronPlatformName === "win32" ? "loophole-cli.exe" : "loophole-cli")

      const file = await stat(cli)

      if (!file.isFile() || file.size === 0) throw new Error(`Bundled CLI must be a non-empty file: ${cli}`)
      await NativeArch.verify(cli, arch)
      const version = path.join(path.dirname(cli), "loophole-cli.version")

      if ((await stat(version)).size === 0) throw new Error(`Bundled CLI version must be a non-empty file: ${version}`)

      // With an Icon Composer mac.icon, electron-builder bundles the ICNS that actool generates as the pre-macOS 26
      // fallback. That one tops out at 256px and draws a light ring around the squircle, so ship ours instead.
      if (context.electronPlatformName === "darwin")
        await copyFile(path.join(packageDir, "resources/icons/icon.icns"), path.join(resources, "icon.icns"))

      if (context.electronPlatformName !== "win32") return

      const prebuilds = path.join(
        resources,
        "app.asar.unpacked/node_modules",
        nodePtyPackage(target.target),
        "prebuilds",
        `${target.os}-${target.cpu}`,
      )

      const addon = path.join(prebuilds, "conpty.node")

      if ((await stat(addon)).size === 0) throw new Error(`Bundled node-pty must be a non-empty file: ${addon}`)
      const entries = await readdir(prebuilds, { recursive: true, withFileTypes: true })

      await Promise.all(
        entries
          .filter((entry) => entry.isFile())
          .map(async (entry) => {
            const file = path.join(entry.parentPath, entry.name)

            if (await NativeArch.isNative(file)) await NativeArch.verify(file, arch)
          }),
      )
    },
    mac: {
      category: "public.app-category.developer-tools",
      icon: `resources/icons/icon.icns`,
      extendInfo: {
        NSMicrophoneUsageDescription: DESKTOP_NATIVE_ENGLISH["desktop.microphoneUsage"],
        // Sites in the browser pane may ask for the camera; without this key macOS ends the app when it asks.
        NSCameraUsageDescription: DESKTOP_NATIVE_ENGLISH["desktop.cameraUsage"],
        // The CLI server and its terminals run as children of the app, so macOS asks for their access to
        // these protected locations in the app's name. The prompt shows the description (#56479).
        NSDocumentsFolderUsageDescription: DESKTOP_NATIVE_ENGLISH["desktop.documentsFolderUsage"],
        NSDesktopFolderUsageDescription: DESKTOP_NATIVE_ENGLISH["desktop.desktopFolderUsage"],
        NSDownloadsFolderUsageDescription: DESKTOP_NATIVE_ENGLISH["desktop.downloadsFolderUsage"],
        NSNetworkVolumesUsageDescription: DESKTOP_NATIVE_ENGLISH["desktop.networkVolumesUsage"],
        NSRemovableVolumesUsageDescription: DESKTOP_NATIVE_ENGLISH["desktop.removableVolumesUsage"],
        NSAutoFillRequiresTextContentTypeForOneTimeCodeOnMac: true,
      },
      target: ["dmg", "zip"],
    },
    protocols: {
      name: "Loophole",
      schemes: ["loophole"],
    },
    win: {
      icon: `resources/icons/icon.ico`,
      target: ["nsis"],
      verifyUpdateCodeSignature: false,
    },
    nsis: {
      include: path.join(packageDir, "resources", "windows", "installer.nsh"),
      oneClick: true,
      perMachine: false,
      installerIcon: `resources/icons/icon.ico`,
      installerHeaderIcon: `resources/icons/icon.ico`,
    },
    linux: {
      icon: `resources/icons`,
      category: "Development",
      executableName: linuxExecutableName(appId),
      // Derive the installed `.desktop` filename from `desktopName`
      // (`ai.opencode.desktop.desktop` for prod) instead of `executableName`,
      // so window association is unaffected by the executable rename above.
      syncDesktopName: true,
      desktop: {
        entry: {
          // Match the installed .desktop file and hicolor icon basename so
          // Linux shells can associate the running Electron window with its launcher.
          StartupWMClass: appId,
        },
      },
      target: ["AppImage", "deb", "rpm"],
    },
  }
}

export function getConfig() {
  const channel = resolveChannel()
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: "Loophole Desktop Dev",
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "loophole-dev", fpm: [rpmNoBuildIdLinksFpm, metainfoFpm(appId)] },
      }
    }

    case "beta": {
      return {
        ...base,
        appId,
        productName: "Loophole Desktop Beta",
        protocols: { name: "Loophole Beta", schemes: ["loophole"] },
        publish: {
          provider: "generic",
          url: "https://github.com/loophole-ai/desktop/releases/latest/download",
          channel: "latest",
        },
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "loophole-beta", fpm: [rpmNoBuildIdLinksFpm, metainfoFpm(appId)] },
      }
    }

    case "prod": {
      return {
        ...base,
        appId,
        productName: "Loophole Desktop",
        protocols: { name: "Loophole", schemes: ["loophole"] },
        // An Icon Composer package compiles to Assets.car, which macOS 26 and later draw the app icon from
        // (Dock, Finder, system dialogs and the system icon styles). Older macOS keeps using the ICNS.
        mac: { ...base.mac, icon: "resources/icons/icon.icon" },
        // The DMG volume icon would otherwise use the same actool-generated ICNS.
        dmg: { icon: "resources/icons/icon.icns" },
        publish: {
          provider: "generic",
          url: "https://github.com/loophole-ai/desktop/releases/latest/download",
          channel: "latest",
        },
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "loophole", fpm: [rpmNoBuildIdLinksFpm, metainfoFpm(appId)] },
      }
    }
  }
}

export default getConfig()
