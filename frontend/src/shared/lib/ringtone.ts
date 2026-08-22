class RingtonePlayer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private intervalId: any = null;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play synthetic outgoing dial tone (440Hz + 480Hz)
  public playOutgoing() {
    this.stop();
    this.isPlaying = true;

    const playBeep = () => {
      if (!this.isPlaying) return;
      try {
        const ctx = this.getContext();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.value = 440;
        osc2.frequency.value = 480;

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();

        osc1.stop(ctx.currentTime + 1.2);
        osc2.stop(ctx.currentTime + 1.2);
      } catch {
        // Audio error ignored
      }
    };

    playBeep();
    this.intervalId = setInterval(playBeep, 3000);
  }

  // Play synthetic incoming ringer (warm melodic chord)
  public playIncoming() {
    this.stop();
    this.isPlaying = true;

    const playChord = () => {
      if (!this.isPlaying) return;
      try {
        const ctx = this.getContext();
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 major triad

        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.value = freq;

          gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.6);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(ctx.currentTime + i * 0.1);
          osc.stop(ctx.currentTime + i * 0.1 + 0.6);
        });
      } catch {
        // Audio error ignored
      }
    };

    playChord();
    this.intervalId = setInterval(playChord, 2200);
  }

  // Play end call short beep
  public playEndCall() {
    this.stop();
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.value = 480;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Ignore
    }
  }

  public stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const ringtone = new RingtonePlayer();
