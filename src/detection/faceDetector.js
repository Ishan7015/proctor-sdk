import { WARNING_TYPES } from '../constants.js';

export class FaceDetector {
    constructor(model, videoElement, canvasCtx, dispatchViolationCallback, onFacePredictionsCallback, isRunningGetter) {
        this.model = model;
        this.videoElement = videoElement;
        this.canvasCtx = canvasCtx;
        this.dispatchViolation = dispatchViolationCallback;
        this.onFacePredictions = onFacePredictionsCallback;
        this.isRunning = isRunningGetter; 
        this.animationFrameId = null;
    }

    startDetectionLoop() {
        if (!this.model) {
            console.error("FaceDetector: Model not available for starting detection loop.");
            return;
        }
        this._detectFacesLoop();
    }

    stopDetectionLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    async _detectFacesLoop() {
        if (!this.isRunning() || !this.model || !this.videoElement || this.videoElement.readyState < 4) {
            if (this.isRunning()) {
               this.animationFrameId = requestAnimationFrame(this._detectFacesLoop.bind(this));
            }
            return;
        }
        
        try {
            const predictions = await this.model.estimateFaces(this.videoElement, false);
            
            try { this.onFacePredictions(predictions); }
            catch (e) { console.error("FaceDetector: Error in user's onFacePredictions callback:", e); }

            if (this.canvasCtx && this.videoElement) { 
                this.canvasCtx.clearRect(0, 0, this.canvasCtx.canvas.width, this.canvasCtx.canvas.height);
            }

            if (predictions.length === 0) {
                this.dispatchViolation(WARNING_TYPES.NO_FACE, true);
                this.dispatchViolation(WARNING_TYPES.MULTIPLE_FACES, false); 
            } else if (predictions.length === 1) {
                this.dispatchViolation(WARNING_TYPES.NO_FACE, false);
                this.dispatchViolation(WARNING_TYPES.MULTIPLE_FACES, false);
            } else {
                this.dispatchViolation(WARNING_TYPES.NO_FACE, false); 
                this.dispatchViolation(WARNING_TYPES.MULTIPLE_FACES, true, { count: predictions.length });
            }
            this._drawFaceBoxes(predictions);
        } catch (error) {
            console.error('FaceDetector: Error during face detection:', error);
        }
        
        if(this.isRunning()) {
            this.animationFrameId = requestAnimationFrame(this._detectFacesLoop.bind(this));
        }
    }

    _drawFaceBoxes(predictions) {
        const ctx = this.canvasCtx;
        if (!ctx || !ctx.canvas || !ctx.canvas.width || !ctx.canvas.height) return;

        let strokeStyle = '#4CAF50'; 

        ctx.strokeStyle = strokeStyle; 
        ctx.lineWidth = 3;
        ctx.font = '14px Arial';

        predictions.forEach((prediction, index) => {
            const topLeft = prediction.topLeft;
            const bottomRight = prediction.bottomRight;
            const startX = Number(topLeft[0]);
            const startY = Number(topLeft[1]);
            const endX = Number(bottomRight[0]);
            const endY = Number(bottomRight[1]);

            if (isNaN(startX) || isNaN(startY) || isNaN(endX) || isNaN(endY)) return;

            const width = endX - startX;
            const height = endY - startY;
            
            ctx.strokeRect(startX, startY, width, height);
            
            const label = `Face ${index + 1}`;
            const textMetrics = ctx.measureText(label);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(startX, startY - 20, textMetrics.width + 10, 20);
            ctx.fillStyle = 'white';
            ctx.fillText(label, startX + 5, startY - 5);
        });
    }
}