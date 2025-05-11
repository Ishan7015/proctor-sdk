# ProctorSDK: Web-Based Proctoring & Monitoring SDK

ProctorSDK is a client-side JavaScript library designed to provide essential proctoring and user monitoring functionalities for web applications. It helps ensure exam integrity or user presence by leveraging browser APIs and TensorFlow.js for face detection.

## Features

- **Face Detection:**
  - Detects if zero, one, or multiple faces are present in the webcam feed.
  - Draws bounding boxes around detected faces.
- **Environment Monitoring:**
  - **Fullscreen Exit Detection:** Warns if the user exits fullscreen mode.
  - **Tab Switch / Window Minimize Detection:** Warns if the page visibility changes (user switches tabs or minimizes the window).
  - **Copy/Paste/Cut Attempt Detection:** Warns if the user attempts clipboard actions on the page.
  - **Multiple Screen Detection:** Warns if the user has an extended display setup (using `window.screen.isExtended` where available).
- **Configurable:**
  - Enable or disable specific checks.
  - Customize CDN paths for TensorFlow.js and BlazeFace models.
  - Set custom throttle durations for violation event reporting.
- **Event-Driven:**
  - Provides callbacks for status changes (e.g., "initializing", "started", "error") and proctoring violations.
- **Easy Integration:**
  - Designed to be integrated into existing web applications, including those built with frameworks like React, Vue, or Angular.
  - Requires a designated DOM container element where it will inject the webcam feed and canvas overlay.
- **Modular Design:**
  - Internally structured for better maintainability and separation of concerns.
- **TypeScript Support:**
  - Includes type definitions for a better development experience in TypeScript projects.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Core Options](#core-options)
  - [Callbacks](#callbacks)
  - [Enabled Checks](#enabled-checks)
  - [Model Paths](#model-paths)
  - [Throttle Durations](#throttle-durations)
- [API Reference](#api-reference)
  - [ProctorSDK Class](#proctorsdk-class)
  - [Public Methods](#public-methods)
  - [Static Properties](#static-properties)
- [Data Structures](#data-structures)
  - [StatusData Object](#statusdata-object)
  - [ViolationData Object](#violationdata-object)
- [Usage with React (Example)](#usage-with-react-example)
- [How it Works (Brief Overview)](#how-it-works-brief-overview)
- [Browser Compatibility](#browser-compatibility)
- [Contributing](#contributing)
- [License](#license)

## Installation

Install ProctorSDK using npm (or yarn):

```bash
npm install proctor-sdk
# or
yarn add proctor-sdk
```

_(Replace `proctor-sdk` with the actual name of your published package on npm.)_

Then, import it into your project:

```javascript
// Using ES6 modules
import ProctorSDK, { STATUS_TYPES, WARNING_TYPES } from "proctor-sdk";

// For CommonJS environments (if your UMD build is configured correctly)
// const ProctorSDK = require('proctor-sdk').default; // Or just require('proctor-sdk') if default isn't needed
// const { STATUS_TYPES, WARNING_TYPES } = require('proctor-sdk');
```

## Quick Start

Here's a minimal example of how to use ProctorSDK in plain JavaScript after installing it via npm:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>ProctorSDK Quick Start</title>
    <style>
      #proctorView {
        width: 320px;
        height: 240px;
        border: 1px solid black;
        position: relative;
        background-color: #eee;
      }
    </style>
  </head>
  <body>
    <h1>ProctorSDK Demo</h1>
    <div id="proctorView">
      <!-- SDK will inject video feed here -->
    </div>
    <button id="startBtn">Start Proctoring</button>
    <button id="stopBtn">Stop Proctoring</button>
    <div id="statusLog">Status: Idle</div>
    <div id="violationsLog"></div>

    <!-- 
        If using in a browser directly with <script type="module">, 
        you'd typically use a bundler (like Webpack, Rollup, Parcel) to resolve 'proctor-sdk'.
        For a simple browser demo without a bundler, you might need to use the UMD build.
        Assuming a build process that makes 'ProctorSDK' available globally for UMD:
        <script src="node_modules/proctor-sdk/dist/index.js"></script> 
    -->
    <script type="module">
      // This import assumes your project is set up to resolve node_modules (e.g., using a bundler)
      // or you are using an import map.
      import ProctorSDK from "proctor-sdk"; // Replace with actual package name

      const proctorContainer = document.getElementById("proctorView");
      const startBtn = document.getElementById("startBtn");
      const stopBtn = document.getElementById("stopBtn");
      const statusLog = document.getElementById("statusLog");
      const violationsLog = document.getElementById("violationsLog");

      const sdkConfig = {
        containerElement: proctorContainer, // Can also be the ID string 'proctorView'
        callbacks: {
          onStatusChange: (statusData) => {
            console.log("SDK Status:", statusData);
            statusLog.textContent = `Status: ${statusData.status} - ${
              statusData.message || ""
            }`;
            if (statusData.error) {
              statusLog.innerHTML += `<br><span style="color: red;">Error: ${statusData.error.message}</span>`;
            }
          },
          onViolation: (violation) => {
            console.warn("SDK Violation:", violation);
            let vMsg = `${violation.active ? "ALERT 🔴" : "CLEARED ✅"} - ${
              violation.type
            }: ${violation.message}`;

            let p = document.getElementById(`v-${violation.type}`);
            if (!p) {
              p = document.createElement("p");
              p.id = `v-${violation.type}`;
              violationsLog.appendChild(p);
            }
            p.textContent = vMsg;
            p.style.color = violation.active ? "red" : "green";
          },
        },
      };

      let proctorInstance;
      try {
        // Access static properties if needed from the imported module
        // console.log(ProctorSDK.STATUS_TYPES.INITIALIZING);
        proctorInstance = new ProctorSDK(sdkConfig);
      } catch (e) {
        console.error("Fatal SDK Init Error:", e);
        statusLog.textContent =
          "SDK Init Error: " + (e instanceof Error ? e.message : String(e));
      }

      startBtn.addEventListener("click", () => {
        if (proctorInstance) proctorInstance.start();
      });

      stopBtn.addEventListener("click", () => {
        if (proctorInstance) proctorInstance.stop();
      });

      window.addEventListener("beforeunload", () => {
        if (proctorInstance) proctorInstance.destroy();
      });
    </script>
  </body>
</html>
```

## Configuration

The `ProctorSDK` is initialized with a configuration object.

### Core Options

- `containerElement` (Required): `HTMLElement | string`
  - The DOM element (or its ID string) where the SDK will inject the webcam video feed and canvas overlay. The SDK will clear the contents of this element.
  - **Important:** For proper canvas overlay, this container element should have its CSS `position` set to `relative`, `absolute`, or `fixed`. If it's `static` (the default for most elements), the canvas overlay might not align correctly. The SDK will log a warning if it detects a `static` position.

### Callbacks

- `callbacks` (Optional): `object`
  - An object containing callback functions for SDK events.
  - `onStatusChange: (statusData: StatusData) => void`
    - Called when the SDK's operational status changes (e.g., loading models, starting, error).
    - See [StatusData Object](#statusdata-object).
  - `onViolation: (violationData: ViolationData) => void`
    - Called when a proctoring rule is triggered (violation becomes active) or cleared (violation becomes inactive).
    - See [ViolationData Object](#violationdata-object).
  - `onWebcamStreamReady: (stream: MediaStream) => void`
    - Called when webcam access is granted and the `MediaStream` is available.
  - `onFacePredictions: (predictions: Array<object>) => void`
    - (Advanced) Called on each frame with the raw face detection prediction results from BlazeFace. This can be verbose. (The `object` type should ideally be a more specific BlazeFace prediction type if available).

### Enabled Checks

- `enabledChecks` (Optional): `object`
  - An object with boolean flags to enable or disable specific proctoring checks. Defaults to all `true`.
  - `faceDetection: boolean` (Checks for no face, one face, multiple faces)
  - `fullscreen: boolean` (Checks for fullscreen exit)
  - `tabSwitch: boolean` (Checks for page visibility changes)
  - `copyPaste: boolean` (Checks for copy, paste, cut events)
  - `multipleScreens: boolean` (Checks for extended display usage)

### Model Paths

- `tfjsModelPaths` (Optional): `object`
  - Allows overriding the default CDN URLs for TensorFlow.js and the BlazeFace model.
  - `tfjs: string` (URL for TensorFlow.js core library)
  - `blazeface: string` (URL for the BlazeFace model script)

### Throttle Durations

- `violationThrottleDurations` (Optional): `object`
  - An object to customize the minimum time (in milliseconds) between consecutive `onViolation` callbacks for _active_ violations of the same type. This prevents flooding the host application with events for continuous issues. Clearing a violation is not throttled.
  - Keys should be values from `ProctorSDK.WARNING_TYPES` (e.g., `[ProctorSDK.WARNING_TYPES.NO_FACE]: 5000`).
  - Defaults:
    - `NO_FACE`: 3000ms
    - `MULTIPLE_FACES`: 3000ms
    - `FULLSCREEN_EXIT`: 1000ms
    - `TAB_SWITCH`: 1000ms
    - `COPY_PASTE_ATTEMPT`: 1000ms
    - `MULTIPLE_SCREENS`: 10000ms

## API Reference

### ProctorSDK Class

The main class you interact with.

```javascript
import ProctorSDK from "proctor-sdk"; // Replace with your package name
const instance = new ProctorSDK(config);
```

### Public Methods

- `async start(): Promise<void>`
  - Initiates the proctoring session.
- `stop(): void`
  - Stops the currently active proctoring session.
- `isProctoringActive(): boolean`
  - Returns `true` if proctoring is currently running.
- `requestFullscreen(): Promise<void>`
  - Attempts to make the SDK's container element (or the document) enter fullscreen mode.
- `destroy(): void`
  - Completely cleans up the SDK instance.

### Static Properties

Accessible directly on the imported `ProctorSDK` class (e.g., `ProctorSDK.STATUS_TYPES`).

- `ProctorSDK.STATUS_TYPES: object`
  - An enum-like object for status strings (see `StatusData.status`).
- `ProctorSDK.WARNING_TYPES: object`
  - An enum-like object for violation type strings (see `ViolationData.type`).

## Data Structures

Type definitions are provided for TypeScript users.

### StatusData Object

Passed to the `onStatusChange` callback.

```typescript
interface StatusData {
  status: string; // A value from ProctorSDK.STATUS_TYPES
  message: string;
  error?: Error; // Present if status is ERROR
}
```

### ViolationData Object

Passed to the `onViolation` callback.

```typescript
interface ViolationData {
  type: string; // A value from ProctorSDK.WARNING_TYPES
  active: boolean; // true if the violation is active, false if cleared
  message: string; // Human-readable message
  timestamp: Date; // When the event occurred
  details?: {
    // Optional, type-specific details
    count?: number; // For MULTIPLE_FACES
    eventType?: "copy" | "paste" | "cut"; // For COPY_PASTE_ATTEMPT
  };
}
```

## Usage with React (Example)

```jsx
// SimpleProctor.jsx / SimpleProctor.tsx
import React, { useEffect, useRef, useCallback } from "react";
import ProctorSDK, { STATUS_TYPES, WARNING_TYPES } from "proctor-sdk"; // Replace with your package name

const SimpleProctor = () => {
  const proctorContainerRef = useRef(null);
  const proctorSDKInstanceRef = useRef(null);

  const handleStatusChange = useCallback((statusData) => {
    // Type statusData with StatusData interface if using TS
    console.log(
      "[ProctorSDK Status]",
      statusData.status,
      "-",
      statusData.message
    );
    if (statusData.error) console.error("[ProctorSDK Error]", statusData.error);
  }, []);

  const handleViolation = useCallback((violation) => {
    // Type violation with ViolationData interface if using TS
    if (violation.active) {
      console.warn(
        `[ProctorSDK Violation ACTIVE] ${violation.type}: ${violation.message}`,
        violation.details || ""
      );
    } else {
      console.info(
        `[ProctorSDK Violation CLEARED] ${violation.type}: ${violation.message}`
      );
    }
  }, []);

  useEffect(() => {
    if (proctorContainerRef.current && !proctorSDKInstanceRef.current) {
      const sdkConfig = {
        // Type sdkConfig with ProctorSDKConfig interface if using TS
        containerElement: proctorContainerRef.current,
        callbacks: {
          onStatusChange: handleStatusChange,
          onViolation: handleViolation,
        },
        // Add other configurations like enabledChecks if needed
      };
      try {
        proctorSDKInstanceRef.current = new ProctorSDK(sdkConfig);
      } catch (e) {
        console.error("[ProctorSDK] Initialization failed:", e);
        // Update UI or state to reflect initialization error
      }
    }
    return () => {
      // Cleanup on unmount
      if (proctorSDKInstanceRef.current) {
        proctorSDKInstanceRef.current.destroy();
        proctorSDKInstanceRef.current = null;
      }
    };
  }, [handleStatusChange, handleViolation]);

  const start = () => proctorSDKInstanceRef.current?.start();
  const stop = () => proctorSDKInstanceRef.current?.stop();

  return (
    <div>
      <h3>Simple Proctoring View (React)</h3>
      <div
        ref={proctorContainerRef}
        style={{
          width: "320px",
          height: "240px",
          border: "1px solid black",
          position: "relative",
          backgroundColor: "#f0f0f0",
        }}
      >
        {/* SDK injects video here. Add placeholder if desired. */}
      </div>
      <button onClick={start}>Start Proctoring</button>
      <button onClick={stop}>Stop Proctoring</button>
      <p>Check console for logs.</p>
    </div>
  );
};
export default SimpleProctor;
```

## How it Works (Brief Overview)

1.  **Initialization:** The SDK sets up a designated container element, creating internal `<video>` and `<canvas>` elements.
2.  **Start:**
    - **Models:** TensorFlow.js and BlazeFace are loaded dynamically from CDNs (or custom paths).
    - **Webcam:** `navigator.mediaDevices.getUserMedia` requests camera access. The stream is piped into the `<video>` element.
    - **Detection:**
      - **Face Detection:** A `requestAnimationFrame` loop feeds video frames to BlazeFace. Violations are triggered, and boxes are drawn on the `<canvas>`.
      - **Environment Monitoring:** Event listeners detect fullscreen changes, tab switches, clipboard actions, and multi-screen setups.
3.  **Communication:** Callbacks inform the host application of violations and status updates.
4.  **Stop/Destroy:** Resources are released, and listeners are removed.

## Browser Compatibility

- **Modern Browsers:** Requires support for WebRTC (`getUserMedia`), ES6+ (Promises, async/await), Canvas API, Fullscreen API, Page Visibility API, Clipboard Events API.
- **Multiple Screen Detection:** Relies on `window.screen.isExtended` (Window Management API), which is newer and support may vary.
- **TensorFlow.js/WebGL:** Performance depends on WebGL and device capabilities.
- **Permissions:** Camera permission is essential.

Test thoroughly on target browsers.

## Contributing

Contributions are welcome! Please open an issue or pull request on the project repository.

_(Link to your GitHub repository here)_

## License

This project is licensed under the MIT License - see the LICENSE.md file for details.
_(Or your chosen license)_

```
--- END OF FILE README.md ---

**Key Changes Made:**

1.  **Installation Section:**
    *   Changed from "copy `src`" to `npm install proctor-sdk`.
    *   Updated import examples to reflect importing from the package name.
    *   Added a note about using a bundler for the plain HTML/JS Quick Start if importing directly from `node_modules` in a browser context or using the UMD build.
2.  **Quick Start Import Path:**
    *   Changed `import ProctorSDK from './path/to/your/sdk/src/index.js';` to `import ProctorSDK from 'proctor-sdk';` (assuming `proctor-sdk` is the package name).
3.  **API Reference Import Path:**
    *   Updated the import example to `import ProctorSDK from 'proctor-sdk';`.
4.  **React Example Import Path:**
    *   Updated the import to `import ProctorSDK, { STATUS_TYPES, WARNING_TYPES } from 'proctor-sdk';`.
5.  **TypeScript Support Note:** Added a small note under "Features" about TypeScript definitions.
6.  **Consistency:** Ensured that "proctor-sdk" is used consistently as the placeholder package name. You'll need to replace this with your actual package name.
7.  **Error Handling in Quick Start:** Added `instanceof Error` check for the caught error message.

This version of the README is more aligned with how users would consume your SDK after it has been published as an npm package. Remember to replace all instances of `proctor-sdk` with the actual name you choose for your package on npm.
```
