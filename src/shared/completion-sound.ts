let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
	if (!audioCtx || audioCtx.state === "closed") {
		audioCtx = new AudioContext();
	}
	return audioCtx;
}

/**
 * Play a short two-tone ascending chime to signal agent completion.
 * Uses Web Audio API (available in Electron) — no external files needed.
 */
export function playCompletionSound(): void {
	try {
		const ctx = getAudioContext();

		const playTone = (
			frequency: number,
			startTime: number,
			duration: number,
		) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = frequency;
			gain.gain.setValueAtTime(0, startTime);
			gain.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
			gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(startTime);
			osc.stop(startTime + duration);
		};

		const now = ctx.currentTime;
		playTone(523.25, now, 0.15); // C5
		playTone(659.25, now + 0.12, 0.2); // E5
	} catch {
		// Audio playback is best-effort; silently ignore failures
	}
}
