import { loadScript } from './utils.js';

export class ModelManager {
    constructor(tfjsPath, blazefacePath) {
        this.tfjsPath = tfjsPath;
        this.blazefacePath = blazefacePath;
        this.model = null;
    }

    async loadModels() {
        if (this.model) return this.model;

        if (typeof tf === 'undefined') {
            await loadScript(this.tfjsPath);
            if (typeof tf === 'undefined') throw new Error('ModelManager: TensorFlow.js (tf) not available after loading script.');
        }
        
        if (typeof blazeface === 'undefined') {
            await loadScript(this.blazefacePath);
            if (typeof blazeface === 'undefined') throw new Error('ModelManager: BlazeFace (blazeface) not available after loading script.');
        }
        
        if (typeof blazeface.load !== 'function') {
             throw new Error('ModelManager: BlazeFace library or "load" function not available.');
        }
        this.model = await blazeface.load();
        return this.model;
    }

    getModel() {
        return this.model;
    }

    destroy() {
        this.model = null;
    }
}