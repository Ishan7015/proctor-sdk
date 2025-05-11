import { WARNING_TYPES } from '../constants.js';

export class EnvironmentMonitor {
    constructor(dispatchViolationCallback, isRunningGetter, addManagedEventListener, removeAllManagedEventListenersForContext) {
        this.dispatchViolation = dispatchViolationCallback;
        this.isRunning = isRunningGetter;
        this.addManagedEventListener = addManagedEventListener;
        this.removeAllManagedEventListenersForContext = removeAllManagedEventListenersForContext;
        this.listenerContext = 'environmentMonitor'; 
        this.boundListeners = {}; 
    }

    startMonitoring() {
        this._checkFullscreen(); 
        this.boundListeners.checkFullscreen = this._checkFullscreen.bind(this);
        this.addManagedEventListener(document, 'fullscreenchange', this.boundListeners.checkFullscreen, this.listenerContext);
        this.addManagedEventListener(document, 'webkitfullscreenchange', this.boundListeners.checkFullscreen, this.listenerContext);
        this.addManagedEventListener(document, 'mozfullscreenchange', this.boundListeners.checkFullscreen, this.listenerContext);
        this.addManagedEventListener(document, 'MSFullscreenChange', this.boundListeners.checkFullscreen, this.listenerContext);

        this._handleVisibilityChange();
        this.boundListeners.handleVisibilityChange = this._handleVisibilityChange.bind(this);
        this.addManagedEventListener(document, 'visibilitychange', this.boundListeners.handleVisibilityChange, this.listenerContext);

        this.boundListeners.handleCopy = (e) => this._handleCopyPasteAttempt(e, 'copy');
        this.boundListeners.handlePaste = (e) => this._handleCopyPasteAttempt(e, 'paste');
        this.boundListeners.handleCut = (e) => this._handleCopyPasteAttempt(e, 'cut');
        this.addManagedEventListener(document, 'copy', this.boundListeners.handleCopy, this.listenerContext);
        this.addManagedEventListener(document, 'paste', this.boundListeners.handlePaste, this.listenerContext);
        this.addManagedEventListener(document, 'cut', this.boundListeners.handleCut, this.listenerContext);
        
        this._checkMultipleScreens();
    }

    stopMonitoring() {
        this.removeAllManagedEventListenersForContext(this.listenerContext);
    }

    _checkFullscreen() {
        if (!this.isRunning()) return;
        const isFullScreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        this.dispatchViolation(WARNING_TYPES.FULLSCREEN_EXIT, !isFullScreen);
    }

    _handleVisibilityChange() {
        if (!this.isRunning()) return;
        if (document.visibilityState === 'hidden') {
            this.dispatchViolation(WARNING_TYPES.TAB_SWITCH, true);
        } else {
            this.dispatchViolation(WARNING_TYPES.TAB_SWITCH, false);
        }
    }

    _handleCopyPasteAttempt(event, eventType) {
        if (!this.isRunning()) return;
        this.dispatchViolation(WARNING_TYPES.COPY_PASTE_ATTEMPT, true, { eventType: event.type });
    }

    _checkMultipleScreens() {
        if (!this.isRunning()) return;
        if (window.screen && typeof window.screen.isExtended !== 'undefined') {
            this.dispatchViolation(WARNING_TYPES.MULTIPLE_SCREENS, window.screen.isExtended);
        } else {
            console.info('EnvironmentMonitor: Multiple screen detection (window.screen.isExtended) not supported. Assuming single screen.');
            this.dispatchViolation(WARNING_TYPES.MULTIPLE_SCREENS, false); 
        }
    }
}