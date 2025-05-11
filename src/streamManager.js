export class StreamManager {
  constructor(containerElementConfig) { 
      this.videoElement = null;
      this.canvasElement = null;
      this.canvasCtx = null;
      this.webcamStream = null;
      this.containerElement = this._resolveContainerElement(containerElementConfig);
      this._initializeDOMElements();
  }

  _resolveContainerElement(containerElementConfig) {
      let container;
      if (typeof containerElementConfig === 'string') {
          container = document.getElementById(containerElementConfig);
      } else if (containerElementConfig instanceof HTMLElement) {
          container = containerElementConfig;
      }
      if (!container) {
          throw new Error(`StreamManager: Container element "${containerElementConfig}" not found or invalid.`);
      }
      return container;
  }

  _initializeDOMElements() {
      const containerPosition = window.getComputedStyle(this.containerElement).position;
      if (containerPosition === 'static') {
          console.warn('ProctorSDK StreamManager: Host container element has static positioning. For best results, set position to relative, absolute, or fixed.');
      }
      this.containerElement.innerHTML = ''; 

      this.videoElement = document.createElement('video');
      this.videoElement.setAttribute('autoplay', '');
      this.videoElement.setAttribute('playsinline', '');
      this.videoElement.style.width = '100%';
      this.videoElement.style.height = '100%';
      this.videoElement.style.objectFit = 'cover';
      this.videoElement.style.transform = 'scaleX(-1)';

      this.canvasElement = document.createElement('canvas');
      this.canvasElement.style.position = 'absolute';
      this.canvasElement.style.top = '0';
      this.canvasElement.style.left = '0';
      this.canvasElement.style.width = '100%';
      this.canvasElement.style.height = '100%';
      this.canvasElement.style.transform = 'scaleX(-1)';
      
      this.containerElement.appendChild(this.videoElement);
      this.containerElement.appendChild(this.canvasElement);
      this.canvasCtx = this.canvasElement.getContext('2d');
  }

  async acquireStream() {
      if (this.webcamStream) {
          this.webcamStream.getTracks().forEach(track => track.stop());
      }
      this.webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      this.videoElement.srcObject = this.webcamStream;
      await new Promise((resolve, reject) => { 
          this.videoElement.onloadedmetadata = resolve;
          this.videoElement.onerror = (e) => reject(new Error("StreamManager: Failed to load video metadata: " + (e.message || "Unknown video error")));
      });
      this.canvasElement.width = this.videoElement.videoWidth;
      this.canvasElement.height = this.videoElement.videoHeight;
      return this.webcamStream;
  }

  releaseStream() {
      if (this.webcamStream) {
          this.webcamStream.getTracks().forEach(track => track.stop());
          this.webcamStream = null;
      }
      if (this.videoElement) this.videoElement.srcObject = null;
      if (this.canvasCtx && this.canvasElement) {
          this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
     }
  }

  getVideoElement() { return this.videoElement; }
  getCanvasElement() { return this.canvasElement; }
  getCanvasContext() { return this.canvasCtx; }
  getWebcamStream() { return this.webcamStream; }

  destroy() {
      this.releaseStream();
      if (this.containerElement) this.containerElement.innerHTML = '';
      this.videoElement = null;
      this.canvasElement = null;
      this.canvasCtx = null;
      this.containerElement = null;
  }
}