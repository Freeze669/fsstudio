// Panneau de contrôle audio en temps réel
// Permet de modifier tous les paramètres audio et les synchroniser avec les listeners

class AudioControlPanel {
    constructor(mediasoupBroadcaster) {
        this.broadcaster = mediasoupBroadcaster;
        this.audioContext = null;
        this.audioNodes = {}; // Stocke tous les nodes audio pour modification en temps réel
        this.currentParams = this.loadSavedParams(); // Charge les paramètres sauvegardés
        this.isInitialized = false;
    }
    
    // Charger les paramètres sauvegardés
    loadSavedParams() {
        const saved = localStorage.getItem('audioParams');
        if (saved) {
            return JSON.parse(saved);
        }
        // Paramètres par défaut (radio FM)
        return {
            // Filtres
            highPassFreq: 50,
            lowPassFreq: 15000,
            preEmphasisGain: 3,
            preEmphasisFreq: 3000,
            // EQ
            eqLowFreq: 200,
            eqLowGain: 1.5,
            eqLowQ: 1.0,
            eqMidFreq: 2000,
            eqMidGain: 2.5,
            eqMidQ: 1.2,
            eqHighFreq: 6000,
            eqHighGain: 2,
            eqHighQ: 1.0,
            // Compresseur
            compressorThreshold: -18,
            compressorKnee: 15,
            compressorRatio: 3,
            compressorAttack: 0.003,
            compressorRelease: 0.15,
            // AGC
            agcGain: 1.0,
            // Limiter
            limiterThreshold: -0.3,
            limiterKnee: 0,
            limiterRatio: 20,
            limiterAttack: 0.001,
            limiterRelease: 0.05,
            // De-emphasis
            deEmphasisGain: -1,
            deEmphasisFreq: 3000
        };
    }
    
    // Sauvegarder les paramètres
    saveParams() {
        localStorage.setItem('audioParams', JSON.stringify(this.currentParams));
        console.log('✅ Paramètres audio sauvegardés');
    }
    
    // Appliquer les filtres avec les paramètres actuels
    async applyAudioFilters(mediaStream) {
        if (!mediaStream) return null;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100,
                latencyHint: 'interactive'
            });
            
            const source = this.audioContext.createMediaStreamSource(mediaStream);
            
            // 1. High-pass filter
            const highPassFilter = this.audioContext.createBiquadFilter();
            highPassFilter.type = 'highpass';
            highPassFilter.frequency.value = this.currentParams.highPassFreq;
            highPassFilter.Q.value = 0.7;
            this.audioNodes.highPass = highPassFilter;
            
            // 2. Low-pass filter
            const lowPassFilter = this.audioContext.createBiquadFilter();
            lowPassFilter.type = 'lowpass';
            lowPassFilter.frequency.value = this.currentParams.lowPassFreq;
            lowPassFilter.Q.value = 0.7;
            this.audioNodes.lowPass = lowPassFilter;
            
            // 3. Pré-emphasis
            const preEmphasis = this.audioContext.createBiquadFilter();
            preEmphasis.type = 'highshelf';
            preEmphasis.frequency.value = this.currentParams.preEmphasisFreq;
            preEmphasis.gain.value = this.currentParams.preEmphasisGain;
            preEmphasis.Q.value = 0.7;
            this.audioNodes.preEmphasis = preEmphasis;
            
            // 4. Égaliseur
            const eqLow = this.audioContext.createBiquadFilter();
            eqLow.type = 'peaking';
            eqLow.frequency.value = this.currentParams.eqLowFreq;
            eqLow.gain.value = this.currentParams.eqLowGain;
            eqLow.Q.value = this.currentParams.eqLowQ;
            this.audioNodes.eqLow = eqLow;
            
            const eqMid = this.audioContext.createBiquadFilter();
            eqMid.type = 'peaking';
            eqMid.frequency.value = this.currentParams.eqMidFreq;
            eqMid.gain.value = this.currentParams.eqMidGain;
            eqMid.Q.value = this.currentParams.eqMidQ;
            this.audioNodes.eqMid = eqMid;
            
            const eqHigh = this.audioContext.createBiquadFilter();
            eqHigh.type = 'peaking';
            eqHigh.frequency.value = this.currentParams.eqHighFreq;
            eqHigh.gain.value = this.currentParams.eqHighGain;
            eqHigh.Q.value = this.currentParams.eqHighQ;
            this.audioNodes.eqHigh = eqHigh;
            
            // 5. Compresseur
            const compressor = this.audioContext.createDynamicsCompressor();
            compressor.threshold.value = this.currentParams.compressorThreshold;
            compressor.knee.value = this.currentParams.compressorKnee;
            compressor.ratio.value = this.currentParams.compressorRatio;
            compressor.attack.value = this.currentParams.compressorAttack;
            compressor.release.value = this.currentParams.compressorRelease;
            this.audioNodes.compressor = compressor;
            
            // 6. AGC
            const agcGain = this.audioContext.createGain();
            agcGain.gain.value = this.currentParams.agcGain;
            this.audioNodes.agcGain = agcGain;
            
            // 7. Limiter
            const limiter = this.audioContext.createDynamicsCompressor();
            limiter.threshold.value = this.currentParams.limiterThreshold;
            limiter.knee.value = this.currentParams.limiterKnee;
            limiter.ratio.value = this.currentParams.limiterRatio;
            limiter.attack.value = this.currentParams.limiterAttack;
            limiter.release.value = this.currentParams.limiterRelease;
            this.audioNodes.limiter = limiter;
            
            // 8. De-emphasis
            const deEmphasis = this.audioContext.createBiquadFilter();
            deEmphasis.type = 'lowshelf';
            deEmphasis.frequency.value = this.currentParams.deEmphasisFreq;
            deEmphasis.gain.value = this.currentParams.deEmphasisGain;
            deEmphasis.Q.value = 0.7;
            this.audioNodes.deEmphasis = deEmphasis;
            
            // Chaînage
            source.connect(highPassFilter);
            highPassFilter.connect(lowPassFilter);
            lowPassFilter.connect(preEmphasis);
            preEmphasis.connect(eqLow);
            eqLow.connect(eqMid);
            eqMid.connect(eqHigh);
            eqHigh.connect(compressor);
            compressor.connect(agcGain);
            agcGain.connect(limiter);
            limiter.connect(deEmphasis);
            
            const destination = this.audioContext.createMediaStreamDestination();
            deEmphasis.connect(destination);
            
            this.isInitialized = true;
            return destination.stream;
        } catch (error) {
            console.error('❌ Erreur application filtres:', error);
            return null;
        }
    }
    
    // Mettre à jour un paramètre en temps réel
    updateParam(key, value) {
        this.currentParams[key] = value;
        
        // Appliquer immédiatement si les nodes existent
        if (this.isInitialized && this.audioNodes) {
            switch(key) {
                case 'highPassFreq':
                    if (this.audioNodes.highPass) this.audioNodes.highPass.frequency.value = value;
                    break;
                case 'lowPassFreq':
                    if (this.audioNodes.lowPass) this.audioNodes.lowPass.frequency.value = value;
                    break;
                case 'preEmphasisGain':
                    if (this.audioNodes.preEmphasis) this.audioNodes.preEmphasis.gain.value = value;
                    break;
                case 'preEmphasisFreq':
                    if (this.audioNodes.preEmphasis) this.audioNodes.preEmphasis.frequency.value = value;
                    break;
                case 'eqLowFreq':
                    if (this.audioNodes.eqLow) this.audioNodes.eqLow.frequency.value = value;
                    break;
                case 'eqLowGain':
                    if (this.audioNodes.eqLow) this.audioNodes.eqLow.gain.value = value;
                    break;
                case 'eqLowQ':
                    if (this.audioNodes.eqLow) this.audioNodes.eqLow.Q.value = value;
                    break;
                case 'eqMidFreq':
                    if (this.audioNodes.eqMid) this.audioNodes.eqMid.frequency.value = value;
                    break;
                case 'eqMidGain':
                    if (this.audioNodes.eqMid) this.audioNodes.eqMid.gain.value = value;
                    break;
                case 'eqMidQ':
                    if (this.audioNodes.eqMid) this.audioNodes.eqMid.Q.value = value;
                    break;
                case 'eqHighFreq':
                    if (this.audioNodes.eqHigh) this.audioNodes.eqHigh.frequency.value = value;
                    break;
                case 'eqHighGain':
                    if (this.audioNodes.eqHigh) this.audioNodes.eqHigh.gain.value = value;
                    break;
                case 'eqHighQ':
                    if (this.audioNodes.eqHigh) this.audioNodes.eqHigh.Q.value = value;
                    break;
                case 'compressorThreshold':
                    if (this.audioNodes.compressor) this.audioNodes.compressor.threshold.value = value;
                    break;
                case 'compressorKnee':
                    if (this.audioNodes.compressor) this.audioNodes.compressor.knee.value = value;
                    break;
                case 'compressorRatio':
                    if (this.audioNodes.compressor) this.audioNodes.compressor.ratio.value = value;
                    break;
                case 'compressorAttack':
                    if (this.audioNodes.compressor) this.audioNodes.compressor.attack.value = value;
                    break;
                case 'compressorRelease':
                    if (this.audioNodes.compressor) this.audioNodes.compressor.release.value = value;
                    break;
                case 'agcGain':
                    if (this.audioNodes.agcGain) this.audioNodes.agcGain.gain.value = value;
                    break;
                case 'limiterThreshold':
                    if (this.audioNodes.limiter) this.audioNodes.limiter.threshold.value = value;
                    break;
                case 'limiterKnee':
                    if (this.audioNodes.limiter) this.audioNodes.limiter.knee.value = value;
                    break;
                case 'limiterRatio':
                    if (this.audioNodes.limiter) this.audioNodes.limiter.ratio.value = value;
                    break;
                case 'limiterAttack':
                    if (this.audioNodes.limiter) this.audioNodes.limiter.attack.value = value;
                    break;
                case 'limiterRelease':
                    if (this.audioNodes.limiter) this.audioNodes.limiter.release.value = value;
                    break;
                case 'deEmphasisGain':
                    if (this.audioNodes.deEmphasis) this.audioNodes.deEmphasis.gain.value = value;
                    break;
                case 'deEmphasisFreq':
                    if (this.audioNodes.deEmphasis) this.audioNodes.deEmphasis.frequency.value = value;
                    break;
            }
        }
        
        // Sauvegarder automatiquement
        this.saveParams();
        
        // Envoyer au serveur pour synchroniser avec les listeners
        this.broadcastParams();
    }
    
    // Envoyer les paramètres au serveur
    broadcastParams() {
        if (this.broadcaster && this.broadcaster.socket) {
            this.broadcaster.socket.emit('audio-params', {
                roomId: this.broadcaster.roomId,
                params: this.currentParams
            });
        }
    }
    
    // Réinitialiser aux valeurs par défaut
    resetToDefaults() {
        this.currentParams = {
            highPassFreq: 50,
            lowPassFreq: 15000,
            preEmphasisGain: 3,
            preEmphasisFreq: 3000,
            eqLowFreq: 200,
            eqLowGain: 1.5,
            eqLowQ: 1.0,
            eqMidFreq: 2000,
            eqMidGain: 2.5,
            eqMidQ: 1.2,
            eqHighFreq: 6000,
            eqHighGain: 2,
            eqHighQ: 1.0,
            compressorThreshold: -18,
            compressorKnee: 15,
            compressorRatio: 3,
            compressorAttack: 0.003,
            compressorRelease: 0.15,
            agcGain: 1.0,
            limiterThreshold: -0.3,
            limiterKnee: 0,
            limiterRatio: 20,
            limiterAttack: 0.001,
            limiterRelease: 0.05,
            deEmphasisGain: -1,
            deEmphasisFreq: 3000
        };
        this.saveParams();
        this.broadcastParams();
        this.updateUI();
    }
    
    // Mettre à jour l'interface utilisateur
    updateUI() {
        // Cette fonction sera appelée depuis l'interface HTML
        Object.keys(this.currentParams).forEach(key => {
            const input = document.getElementById(`audio-${key}`);
            if (input) {
                input.value = this.currentParams[key];
                const display = document.getElementById(`audio-${key}-display`);
                if (display) {
                    display.textContent = this.formatValue(key, this.currentParams[key]);
                }
            }
        });
    }
    
    // Formater la valeur pour l'affichage
    formatValue(key, value) {
        if (key.includes('Freq')) {
            return `${value} Hz`;
        } else if (key.includes('Gain')) {
            return `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`;
        } else if (key.includes('Threshold')) {
            return `${value.toFixed(1)} dB`;
        } else if (key.includes('Ratio')) {
            return `${value.toFixed(1)}:1`;
        } else if (key.includes('Attack') || key.includes('Release')) {
            return `${(value * 1000).toFixed(1)} ms`;
        } else if (key.includes('Knee')) {
            return `${value.toFixed(1)} dB`;
        } else if (key.includes('Q')) {
            return value.toFixed(2);
        }
        return value.toFixed(2);
    }
}

// Exporter pour utilisation globale
window.AudioControlPanel = AudioControlPanel;

