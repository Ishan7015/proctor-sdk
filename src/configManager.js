import { DEFAULT_TFJS_PATH, DEFAULT_BLAZEFACE_PATH, DEFAULT_THROTTLE_DURATIONS } from './constants.js';

export class ConfigManager {
    constructor(userConfig) {
        if (!userConfig || !userConfig.containerElement) {
            throw new Error('ProctorSDK Config: Valid containerElement (ID string or HTMLElement) is required.');
        }
        this.effectiveConfig = this._mergeConfig(userConfig);
    }

    _mergeConfig(userConfig) {
        const defaultConfig = {
            enabledChecks: {
                faceDetection: true,
                fullscreen: true,
                tabSwitch: true,
                copyPaste: true,
                multipleScreens: true
            },
            tfjsModelPaths: {
                tfjs: DEFAULT_TFJS_PATH,
                blazeface: DEFAULT_BLAZEFACE_PATH,
            },
            callbacks: {
                onViolation: () => {},
                onStatusChange: () => {},
                onWebcamStreamReady: () => {},
                onFacePredictions: () => {}
            },
            violationThrottleDurations: {}
        };

        const config = { ...defaultConfig, ...userConfig };
        config.callbacks = { ...defaultConfig.callbacks, ...(userConfig.callbacks || {}) };
        config.enabledChecks = { ...defaultConfig.enabledChecks, ...(userConfig.enabledChecks || {}) };
        config.tfjsModelPaths = { ...defaultConfig.tfjsModelPaths, ...(userConfig.tfjsModelPaths || {}) };
        
        config.effectiveThrottleDurations = { ...DEFAULT_THROTTLE_DURATIONS };
        if (userConfig.violationThrottleDurations) {
            for (const key in userConfig.violationThrottleDurations) {
                if (DEFAULT_THROTTLE_DURATIONS.hasOwnProperty(key)) {
                    config.effectiveThrottleDurations[key] = userConfig.violationThrottleDurations[key];
                }
            }
        }
        return config;
    }

    getConfig() {
        return this.effectiveConfig;
    }
}