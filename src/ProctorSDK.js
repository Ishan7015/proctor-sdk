import { WARNING_TYPES, STATUS_TYPES } from './constants.js';
import { ConfigManager } from './configManager.js';
import { StreamManager } from './streamManager.js';
import { ModelManager } from './modelManager.js';
import { FaceDetector } from './detection/faceDetector.js';
import { EnvironmentMonitor } from './detection/environmentMonitor.js';

class ProctorSDK {
    constructor(userConfig) {
        try {
            this.configManager = new ConfigManager(userConfig);
        } catch (e) {
            console.error("ProctorSDK Fatal Error: Initial configuration failed.", e);
            throw e; 
        }
        
        this.config = this.configManager.getConfig();

        this.internalState = {
            isRunning: false,
            activeWarningFlags: this._getInitialWarningFlags(),
            multipleFaceCount: 0,
            lastViolationCallTimestamps: this._getInitialViolationTimestamps(),
            eventListeners: [],
        };
        
        try {
            this.streamManager = new StreamManager(this.config.containerElement);
            this.modelManager = new ModelManager(this.config.tfjsModelPaths.tfjs, this.config.tfjsModelPaths.blazeface);
        } catch (e) {
            this._setStatus(STATUS_TYPES.ERROR, "SDK Initialization failed (Stream/Model Manager).", e);
            throw e;
        }

        this.faceDetector = null;
        this.environmentMonitor = null;

        this._setStatus(STATUS_TYPES.INITIALIZING, 'SDK initialized.');
    }

    _getInitialWarningFlags() {
        const flags = {};
        for (const key in WARNING_TYPES) flags[WARNING_TYPES[key]] = false;
        return flags;
    }

    _getInitialViolationTimestamps() {
        const timestamps = {};
        for (const key in WARNING_TYPES) timestamps[WARNING_TYPES[key]] = 0;
        return timestamps;
    }

    _setStatus(statusType, message = '', error = null) {
        const statusData = { status: statusType, message, ...(error && { error }) };
        try {
            if (this.config && this.config.callbacks && this.config.callbacks.onStatusChange) {
                this.config.callbacks.onStatusChange(statusData);
            }
        } catch (e) { console.error("ProctorSDK: Error in onStatusChange callback:", e); }
        if (error) console.error(`ProctorSDK Error: ${message}`, error);
        else console.log(`ProctorSDK Status: ${statusType} - ${message}`);
    }

    _dispatchViolation(type, isActive, details = {}) {
        if (!this.config || !this.config.callbacks || !this.config.callbacks.onViolation) return;
        
        const wasActive = this.internalState.activeWarningFlags[type];
        this.internalState.activeWarningFlags[type] = isActive;
        if (type === WARNING_TYPES.MULTIPLE_FACES && isActive) this.internalState.multipleFaceCount = details.count || 0;

        const violationMessage = this._getViolationMessage(type, details); 
        const violationData = { type, active: isActive, message: violationMessage, timestamp: new Date(), details };
        
        const now = Date.now();
        const lastCallTime = this.internalState.lastViolationCallTimestamps[type] || 0;
        const throttleDuration = this.config.effectiveThrottleDurations[type] || 0;
        
        let shouldCallCallback = false;
        if (isActive) { 
            if (now - lastCallTime > throttleDuration) {
                shouldCallCallback = true;
                this.internalState.lastViolationCallTimestamps[type] = now;
            }
        } else if (wasActive && !isActive) {
            shouldCallCallback = true;
            this.internalState.lastViolationCallTimestamps[type] = 0; 
        }

        if (shouldCallCallback) {
            try { this.config.callbacks.onViolation(violationData); }
            catch (e) { console.error("ProctorSDK: Error in onViolation callback:", e); }
        }
    }

    _getViolationMessage(type, details) {
        switch (type) {
            case WARNING_TYPES.NO_FACE: return 'No face detected!';
            case WARNING_TYPES.MULTIPLE_FACES: return `Multiple faces detected: ${details.count || 'N/A'}`;
            case WARNING_TYPES.FULLSCREEN_EXIT: return 'User is not in fullscreen mode!';
            case WARNING_TYPES.TAB_SWITCH: return 'User switched tabs or minimized window!';
            case WARNING_TYPES.COPY_PASTE_ATTEMPT: return `User action: ${details.eventType || 'copy/paste/cut'} attempt detected!`;
            case WARNING_TYPES.MULTIPLE_SCREENS: return 'Multiple screens detected (extended display)!';
            default: return 'Unknown violation.';
        }
    }
    
    _addManagedEventListener(target, type, listener, context = 'global') {
        target.addEventListener(type, listener);
        this.internalState.eventListeners.push({ target, type, listener, context });
    }

    _removeAllManagedEventListeners(context = null) {
        const listenersToRemove = context 
            ? this.internalState.eventListeners.filter(l => l.context === context)
            : this.internalState.eventListeners;
        
        const remainingListeners = context
            ? this.internalState.eventListeners.filter(l => l.context !== context)
            : [];

        listenersToRemove.forEach(({ target, type, listener }) => {
            target.removeEventListener(type, listener);
        });
        this.internalState.eventListeners = remainingListeners;
    }


    async start() {
        if (this.internalState.isRunning) {
            console.warn('ProctorSDK: Already running.');
            return;
        }
        this._setStatus(STATUS_TYPES.STARTING, 'Attempting to start...');

        try {
            if (this.config.enabledChecks.faceDetection) {
                this._setStatus(STATUS_TYPES.MODEL_LOADING);
                await this.modelManager.loadModels();
                this._setStatus(STATUS_TYPES.MODEL_LOADED, 'Face detection model ready.');
            }

            this._setStatus(STATUS_TYPES.WEBCAM_REQUESTING);
            const stream = await this.streamManager.acquireStream();
            this._setStatus(STATUS_TYPES.WEBCAM_READY, 'Webcam stream acquired.');
            try { this.config.callbacks.onWebcamStreamReady(stream); }
            catch (e) { console.error("ProctorSDK: Error in onWebcamStreamReady callback", e); }

            this.internalState.isRunning = true;

            if (this.config.enabledChecks.faceDetection && this.modelManager.getModel()) {
                this.faceDetector = new FaceDetector(
                    this.modelManager.getModel(),
                    this.streamManager.getVideoElement(),
                    this.streamManager.getCanvasContext(),
                    this._dispatchViolation.bind(this),
                    this.config.callbacks.onFacePredictions,
                    () => this.internalState.isRunning 
                );
                this.faceDetector.startDetectionLoop();
            }

            if (this.config.enabledChecks.fullscreen || this.config.enabledChecks.tabSwitch ||
                this.config.enabledChecks.copyPaste || this.config.enabledChecks.multipleScreens) {
                this.environmentMonitor = new EnvironmentMonitor(
                    this._dispatchViolation.bind(this),
                    () => this.internalState.isRunning,
                    this._addManagedEventListener.bind(this), 
                    (context) => this._removeAllManagedEventListeners(context) 
                );
                this.environmentMonitor.startMonitoring();
            }

            this._setStatus(STATUS_TYPES.STARTED, 'Proctoring started successfully.');
        } catch (error) {
            this._setStatus(STATUS_TYPES.ERROR, 'Failed to start proctoring.', error);
            this.stop();
        }
    }

    stop() {
        this._setStatus(STATUS_TYPES.STOPPING, 'Stopping proctoring...');
        this.internalState.isRunning = false;

        if (this.faceDetector) {
            this.faceDetector.stopDetectionLoop();
            this.faceDetector = null;
        }
        if (this.environmentMonitor) {
            this.environmentMonitor = null;
        }
        
        this.streamManager.releaseStream();
        this._removeAllManagedEventListeners(); 

        for (const type in this.internalState.activeWarningFlags) {
            if (this.internalState.activeWarningFlags[type]) {
                this._dispatchViolation(type, false);
            }
        }
        this.internalState.lastViolationCallTimestamps = this._getInitialViolationTimestamps();
        this._setStatus(STATUS_TYPES.STOPPED, 'Proctoring stopped.');
    }

    isProctoringActive() { return this.internalState.isRunning; }

    requestFullscreen() {
        const elem = this.streamManager.getVideoElement()?.parentElement || document.documentElement;
        if (!elem) return Promise.reject(new Error('Container element not available for fullscreen request.'));
        
        if (elem.requestFullscreen) return elem.requestFullscreen();
        if (elem.webkitRequestFullscreen) return elem.webkitRequestFullscreen();
        if (elem.mozRequestFullScreen) return elem.mozRequestFullScreen();
        if (elem.msRequestFullscreen) return elem.msRequestFullscreen();
        return Promise.reject(new Error('Fullscreen API not supported.'));
    }

    destroy() {
        this.stop();
        if (this.streamManager) this.streamManager.destroy();
        if (this.modelManager) this.modelManager.destroy(); 
        
        this.streamManager = null;
        this.modelManager = null;
        this.configManager = null; 
        this.config = { callbacks: {}, enabledChecks: {}, tfjsModelPaths: {}, effectiveThrottleDurations: {} };

        this._setStatus(STATUS_TYPES.DESTROYED, 'SDK instance destroyed.');
    }
}

ProctorSDK.WARNING_TYPES = WARNING_TYPES;
ProctorSDK.STATUS_TYPES = STATUS_TYPES;

export { ProctorSDK }; 