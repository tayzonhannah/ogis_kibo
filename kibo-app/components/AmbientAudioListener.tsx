'use client';

import { useEffect, useRef, useState } from 'react';

interface AmbientAudioListenerProps {
  onPresenceDetected?: () => void;
}

export function AmbientAudioListener({ onPresenceDetected }: AmbientAudioListenerProps) {
  const [listening, setListening] = useState(false);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [decibels, setDecibels] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
      setPermissionState('unsupported');
    }
  }, []);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      setPermissionState('granted');
      setListening(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let peakCount = 0;

      const analyze = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setDecibels(Math.round(average));

        // Detect sustained voice/presence threshold
        if (average > 35) {
          peakCount++;
          if (peakCount > 15 && onPresenceDetected) {
            onPresenceDetected();
            peakCount = 0;
          }
        } else {
          peakCount = Math.max(0, peakCount - 1);
        }

        animFrameRef.current = requestAnimationFrame(analyze);
      };

      analyze();
    } catch (err) {
      console.warn('[kibo] Audio permission denied or error:', err);
      setPermissionState('denied');
      setListening(false);
    }
  };

  const stopListening = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) void audioCtxRef.current.close();

    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setListening(false);
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  if (permissionState === 'unsupported') {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20 text-teal-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            {listening && (
              <span className="absolute inset-0 animate-ping rounded-full bg-teal-400/30 opacity-75" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-medium text-white/90">Ambient Audio Listener</h4>
            <p className="text-[11px] text-white/50">
              {listening
                ? 'On-device presence active (0 audio recorded)'
                : 'Detect shared in-person conversation & presence'}
            </p>
          </div>
        </div>

        {listening ? (
          <button
            type="button"
            onClick={stopListening}
            className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/20"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startListening()}
            className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1.5 text-xs text-teal-200 transition hover:bg-teal-500/25"
          >
            Enable
          </button>
        )}
      </div>

      {listening && (
        <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-cyan-300 transition-all duration-75"
              style={{ width: `${Math.min(100, (decibels / 60) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-teal-300/80">
            {decibels > 35 ? 'Conversation Detected' : 'Quiet Ambient'}
          </span>
        </div>
      )}

      {permissionState === 'denied' && (
        <p className="mt-2 text-[11px] text-rose-300/80">
          Microphone permission denied. Enable microphone in browser settings for ambient detection.
        </p>
      )}
    </div>
  );
}
