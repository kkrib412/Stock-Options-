import { AudioSettings } from '../types';

class MarketAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private settings: AudioSettings = {
    isEnabled: false,
    masterVolume: 0.3,
    enableClicks: true,
    enableDrone: false,
    droneFrequency: 110,
    scaleType: 'pentatonic',
    dynamicFilter: true,
  };

  // Drone Synth Nodes
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;

  // Analyser for UI visualizers
  private analyser: AnalyserNode | null = null;

  constructor() {
    // Audio engine is initialized lazily upon user interaction (unlock requirement)
  }

  isInitialized(): boolean {
    return this.ctx !== null;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  async init() {
    if (this.ctx) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('Web Audio API is not supported in this browser.');
        return;
      }

      this.ctx = new AudioCtxClass();
      
      // Create master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.settings.isEnabled ? this.settings.masterVolume : 0, this.ctx.currentTime);
      
      // Direct Master analyzer for visual UI feedback
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Start drone synthesizer if enabled
      if (this.settings.enableDrone && this.settings.isEnabled) {
        this.startDrone();
      }
    } catch (err) {
      console.error('Failed to initialize MarketAudioEngine:', err);
    }
  }

  updateSettings(newSettings: AudioSettings) {
    const wasMuted = !this.settings.isEnabled;
    const wasDroneEnabled = this.settings.enableDrone;

    this.settings = { ...newSettings };

    if (!this.ctx) return;

    // Handle resume if suspended (standard browser security fallback)
    if (this.settings.isEnabled && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // Update master volume
    if (this.masterGain) {
      const targetGain = this.settings.isEnabled ? this.settings.masterVolume : 0;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }

    // Handle drone state transitions
    if (this.settings.isEnabled && this.settings.enableDrone) {
      if (!wasDroneEnabled || wasMuted) {
        this.startDrone();
      } else {
        this.updateDroneFrequency();
      }
    } else {
      this.stopDrone();
    }
  }

  private startDrone() {
    if (!this.ctx || !this.masterGain) return;
    this.stopDrone(); // Safety cleanup

    try {
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(250, this.ctx.currentTime);
      this.droneFilter.Q.setValueAtTime(3, this.ctx.currentTime);

      // Create fundamental and a perfect fifth above for a thick industrial organ drone
      const freq = this.settings.droneFrequency;
      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = 'sawtooth';
      this.droneOsc1.frequency.setValueAtTime(freq, this.ctx.currentTime);

      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = 'triangle';
      this.droneOsc2.frequency.setValueAtTime(freq * 1.5, this.ctx.currentTime); // 5th

      // Detune slightly for an analog chorus width
      this.droneOsc1.detune.setValueAtTime(-5, this.ctx.currentTime);
      this.droneOsc2.detune.setValueAtTime(5, this.ctx.currentTime);

      // Routing
      this.droneOsc1.connect(this.droneFilter);
      this.droneOsc2.connect(this.droneFilter);
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      // Start oscillators
      this.droneOsc1.start();
      this.droneOsc2.start();

      // Fade drone in slowly to match studio engineering guidelines
      this.droneGain.gain.setTargetAtTime(0.15, this.ctx.currentTime, 0.5);
    } catch (e) {
      console.error('Error starting drone:', e);
    }
  }

  private updateDroneFrequency() {
    if (!this.ctx || !this.droneOsc1 || !this.droneOsc2) return;
    const freq = this.settings.droneFrequency;
    
    this.droneOsc1.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.2);
    this.droneOsc2.frequency.setTargetAtTime(freq * 1.5, this.ctx.currentTime, 0.2);
  }

  private stopDrone() {
    try {
      if (this.droneGain && this.ctx) {
        // Fade out drone before stopping to avoid speaker pops
        this.droneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }

      setTimeout(() => {
        if (this.droneOsc1) {
          try { this.droneOsc1.stop(); } catch(e){}
          this.droneOsc1.disconnect();
          this.droneOsc1 = null;
        }
        if (this.droneOsc2) {
          try { this.droneOsc2.stop(); } catch(e){}
          this.droneOsc2.disconnect();
          this.droneOsc2 = null;
        }
        if (this.droneFilter) {
          this.droneFilter.disconnect();
          this.droneFilter = null;
        }
        if (this.droneGain) {
          this.droneGain.disconnect();
          this.droneGain = null;
        }
      }, 100);
    } catch(e) {
      console.error('Error stopping drone safety cleanup:', e);
    }
  }

  /**
   * Modulates the drone filter frequency and spatial elements based on order book imbalance.
   * imbalance goes from 0 (all bids/depth) to 1 (all asks/depth)
   */
  updateImbalance(imbalance: number) {
    if (!this.ctx || !this.droneFilter || !this.settings.enableDrone || !this.settings.isEnabled) return;
    
    // Imbalance shifts the low-pass filter cutoff
    // 0 (bids high) -> Warm low hum (cutoff 120Hz)
    // 1 (asks high) -> Brighter metallic buzz (cutoff 500Hz)
    const cutoff = 150 + imbalance * 350; // Ranges 150Hz to 500Hz
    this.droneFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.15);
  }

  /**
   * Synthesizes a transient tick trade sound
   * side: 'buy' = green trade, 'sell' = red trade
   * rawSize: BTC or token size
   * usdValue: Estimated value in USD for logarithmic scaling of acoustics
   */
  playTrade(side: 'buy' | 'sell', rawSize: number, usdValue: number) {
    if (!this.ctx || !this.masterGain || !this.settings.isEnabled || !this.settings.enableClicks) return;

    // Prevent audio congestion on rapid high frequency trade ticks (gatekeeping)
    if (this.ctx.state === 'suspended') return;

    try {
      const now = this.ctx.currentTime;

      // Logarithmic scaling for volume/impact based on trade value
      // $100 -> tiny click
      // $10,000 -> noticeable punch
      // $100,000+ -> heavy cinematic thump
      const logVal = Math.max(1, Math.log10(Math.max(10, usdValue))); // ranges approx 1 to 6
      const sizeIntensity = Math.min(1.5, logVal / 4.0); // ranges approx 0.25 to 1.5

      // Base nodes
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      const clickFilter = this.ctx.createBiquadFilter();

      // Pan nodes (channel spatial panning)
      let panNode: AudioNode = clickGain;
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        // Buy trades: Pan right (0.6). Sell trades: Pan left (-0.6).
        panner.pan.setValueAtTime(side === 'buy' ? 0.6 : -0.6, now);
        clickGain.connect(panner);
        panNode = panner;
      }

      // Route pan node to master gain
      panNode.connect(this.masterGain);

      // Pitch definitions based on buy vs sell or selected Scale
      let baseFreq = 1000;
      let sweepTarget = 200;

      if (side === 'buy') {
        // High, bright wooden block pop
        baseFreq = 800 + Math.random() * 400; // 800 - 1200Hz
        sweepTarget = 400;
        clickOsc.type = 'triangle';
      } else {
        // Heavy kick-type electronic click
        baseFreq = 150 + Math.random() * 60; // 150 - 210Hz
        sweepTarget = 40;
        clickOsc.type = 'sine';
      }

      // If extreme big whale trade, layer with a deep sub-bass generator
      const isWhaleTrade = usdValue >= 50000;
      if (isWhaleTrade) {
        this.playWhaleImpact(side, sizeIntensity);
        // Deeper pitch for whale clicks
        baseFreq *= 0.5;
        sweepTarget *= 0.5;
      }

      // Pitch sweep envelope (master mixer technique: snappy transients)
      clickOsc.frequency.setValueAtTime(baseFreq, now);
      clickOsc.frequency.exponentialRampToValueAtTime(sweepTarget, now + 0.04);

      // Filter settings (clean up high fizz on red trades, or boost presence on green trades)
      clickFilter.type = side === 'buy' ? 'bandpass' : 'lowpass';
      clickFilter.frequency.setValueAtTime(side === 'buy' ? 1800 : 350, now);
      
      // Routing oscillator to filter to gain
      clickOsc.connect(clickFilter);
      clickFilter.connect(clickGain);

      // Volume envelope: rapid attack + fast decay
      const volumeLevel = 0.4 * sizeIntensity;
      const decayTime = isWhaleTrade ? 0.15 : 0.035 + (sizeIntensity * 0.02);

      clickGain.gain.setValueAtTime(0, now);
      clickGain.gain.linearRampToValueAtTime(volumeLevel, now + 0.002); // 2ms attack
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + decayTime); // beautiful natural acoustic decay

      clickOsc.start(now);
      clickOsc.stop(now + decayTime + 0.05);
    } catch (e) {
      console.warn('Click audio schedule aborted due to congestion:', e);
    }
  }

  /**
   * Extra auxiliary physical sub-synthesizer for giant real-time block trades.
   * Creates a structural sub-bass slam.
   */
  private playWhaleImpact(side: 'buy' | 'sell', sizeIntensity: number) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();

      subOsc.type = 'sine';
      // Low subharmonic fundamental (55Hz for buys, 41Hz for sells)
      const subFreq = side === 'buy' ? 55 : 41.2;
      subOsc.frequency.setValueAtTime(subFreq, now);
      subOsc.frequency.exponentialRampToValueAtTime(20, now + 0.25);

      subGain.gain.setValueAtTime(0, now);
      subGain.gain.linearRampToValueAtTime(0.7 * sizeIntensity, now + 0.01); // 10ms heavy attack
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35); // longer heavy sub decay

      subOsc.connect(subGain);
      
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(side === 'buy' ? 0.3 : -0.3, now);
        subGain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        subGain.connect(this.masterGain);
      }

      subOsc.start(now);
      subOsc.stop(now + 0.4);
    } catch(e){}
  }
}

// Singleton instances are perfect for audio engines
export const marketAudio = new MarketAudioEngine();
