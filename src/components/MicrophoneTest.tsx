/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Info, Activity, Square, Play, Pause, RotateCcw, AlertTriangle, Download } from 'lucide-react';

interface MicStats {
  label: string;
  sampleRate: number;
  channelCount: number;
}

export default function MicrophoneTest() {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [micStats, setMicStats] = useState<MicStats | null>(null);
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [peakVolume, setPeakVolume] = useState<number>(0);

  // Recording status states
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState<boolean>(false);
  const [recordDuration, setRecordDuration] = useState<number>(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');

  const stopMicrophone = () => {
    // Stop recording timer if running
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Cancel request animation frame
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Stop MediaRecorder if actively recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Media recorder stopped abruptly", e);
      }
    }

    // Clear tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsRunning(false);
    setCurrentVolume(0);
    setPeakVolume(0);
  };

  const startMicrophone = async () => {
    setErrorText(null);
    if (streamRef.current) {
      stopMicrophone();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // Initialize browser AudioContext
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      // Stream Source
      const source = audioCtx.createMediaStreamSource(stream);

      // Create analyser block
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Connect source to analyser
      source.connect(analyser);

      // Gather audio track definitions
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        setMicStats({
          label: audioTrack.label || 'System Sound Input channel',
          sampleRate: audioCtx.sampleRate,
          channelCount: audioTrack.getSettings().channelCount || 1,
        });
      }

      setIsRunning(true);
      drawVisuals();
    } catch (err: any) {
      console.error(err);
      let desc = "Hardware error: Microphone access was blocked, or input devices are restricted by safety permissions.";
      if (err.name === 'NotAllowedError') {
        desc = "Microphone protection rejected. Please open site permissions locked under your address bar lock to enable access.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        desc = "No physical microphone hardware or sound card inputs detected on your machine.";
      }
      setErrorText(desc);
      setIsRunning(false);
    }
  };

  const drawVisuals = () => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const currentCanvas = canvasRef.current;
      if (!currentCanvas || !analyserRef.current) return;
      const currentCtx = currentCanvas.getContext('2d');
      if (!currentCtx) return;

      const w = currentCanvas.width;
      const h = currentCanvas.height;

      animationRef.current = requestAnimationFrame(draw);

      analyserRef.current.getByteFrequencyData(dataArray);

      // Refresh background with slight transparency for a luxury visual lag
      currentCtx.fillStyle = 'rgba(15, 17, 19, 0.25)';
      currentCtx.fillRect(0, 0, w, h);

      // Draw frequency grid lines
      currentCtx.strokeStyle = 'rgba(16, 185, 129, 0.04)';
      currentCtx.lineWidth = 1;
      for (let i = 0; i < w; i += 40) {
        currentCtx.beginPath();
        currentCtx.moveTo(i, 0);
        currentCtx.lineTo(i, h);
        currentCtx.stroke();
      }

      // Calculate instantaneous volume level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const rawVolume = bufferLength > 0 ? sum / bufferLength : 0;
      const normalizedVolume = Math.min(100, Math.round((rawVolume / 130) * 100));
      
      setCurrentVolume(normalizedVolume);
      setPeakVolume((prev) => Math.max(prev, normalizedVolume));

      // Draw symmetrical stereo frequency spectrum waves
      const barWidth = (w / bufferLength) * 1.6;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * h * 0.85;

        // Create elegant color gradient matching the theme
        const gradient = currentCtx.createLinearGradient(0, h, 0, 0);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.15)'); // Emerald-500 base
        gradient.addColorStop(0.5, 'rgba(5, 150, 105, 0.7)');
        gradient.addColorStop(1, 'rgba(52, 211, 153, 1)'); // Mint green peaks

        currentCtx.fillStyle = gradient;

        // Upper-lower visual symmetrical wave spikes
        const centerY = h / 2;
        currentCtx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);

        x += barWidth + 1;
      }

      // Subtle active track watermark indicator
      currentCtx.fillStyle = 'rgba(16, 185, 129, 0.4)';
      currentCtx.font = '10px monospace';
      currentCtx.fillText('REALTIME STREAM ANALYSIS (FFT OSCILLOSCOPE ACTIVE)', 15, h - 15);
    };

    draw();
  };

  // Recording audio workflow
  const startRecording = () => {
    if (!streamRef.current) {
      setErrorText("You must initialize the microphone before launching quality record tests.");
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setErrorText("Your browser does not support audio recording (MediaRecorder API unavailable).");
      return;
    }

    // Pick the first mimeType the browser actually supports
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    const supported = candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? '';
    mimeTypeRef.current = supported || 'audio/webm';

    setRecordingState('recording');
    chunksRef.current = [];
    setRecordedChunks([]);
    setRecordDuration(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    timerRef.current = setInterval(() => {
      setRecordDuration((prev) => prev + 1);
    }, 1000);

    try {
      const recorder = new MediaRecorder(
        streamRef.current,
        supported ? { mimeType: supported } : undefined
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };

      // Only finalize once the recorder has fully stopped and flushed all data
      recorder.onstop = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setRecordingState('recorded');
      };

      recorder.start(100); // chunk every 100ms
    } catch (err) {
      console.error(err);
      setErrorText("Could not start audio recording on this device/browser.");
      setRecordingState('idle');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const stopRecording = () => {
    // Do NOT set recordingState here — recorder.onstop() does it
    // once the final chunk has actually been flushed.
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const togglePlayback = () => {
    const audio = playbackRef.current;
    if (!audio) return;

    if (isPlaybackPlaying) {
      audio.pause();
      setIsPlaybackPlaying(false);
    } else {
      audio.play();
      setIsPlaybackPlaying(true);
    }
  };

  const handlePlaybackFinished = () => {
    setIsPlaybackPlaying(false);
  };

  const resetRecordingSpace = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setRecordingState('idle');
    chunksRef.current = [];
    setRecordedChunks([]);
    setAudioUrl(null);
    setRecordDuration(0);
    setIsPlaybackPlaying(false);
  };

  // Clean-up hooks
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      {/* Title section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--theme-card-border)] pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--theme-text)] flex items-center gap-2">
            <Mic className="w-6 h-6 text-emerald-500" />
            <span>Sound Input & Recorder Diagnostic Unit</span>
          </h2>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1 font-sans">
            Verify microphone frequency volume, draw live voice graphs (Live Graph), log peak sound decibels, record audio clips offline, and play back track to test recording quality.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* WAVEFORM SPECTRUM VISUALIZER DISPLAY (COL-SPAN-7) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] rounded-lg overflow-hidden shadow-sm">
            
            <div className="bg-[var(--theme-bg)] border-b border-[var(--theme-card-border)] px-4 py-3 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="font-bold uppercase tracking-wider text-[var(--theme-text)]">
                  {isRunning ? 'Spectral Oscilloscope Live' : 'Microphone Stream Standby'}
                </span>
              </div>
            </div>

            {/* Visualizer Frame Canvas */}
            <div className="bg-[#0f1113] h-[240px] border-b border-[var(--theme-card-border)] relative flex items-center justify-center">
              {errorText ? (
                <div className="text-center p-6 space-y-3 max-w-sm">
                  <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                  <p className="text-xs text-red-400 font-medium leading-relaxed font-mono">
                    {errorText}
                  </p>
                  <button
                    onClick={startMicrophone}
                    className="text-[10px] font-mono font-extrabold uppercase px-4 py-2 border border-red-500/30 text-red-400 rounded hover:bg-rose-500/10 transition-colors"
                  >
                    Allow Microphone Capture
                  </button>
                </div>
              ) : isRunning ? (
                <canvas
                  ref={canvasRef}
                  width="600"
                  height="240"
                  className="w-full h-full block"
                />
              ) : (
                <div className="text-center p-6 space-y-4 select-none">
                  <span className="w-16 h-16 rounded-full bg-[#1c1f22] flex items-center justify-center mx-auto text-emerald-500 border border-neutral-800">
                    <Mic className="w-8 h-8 animate-pulse" />
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest">Active Core Stream Offline</h3>
                    <p className="text-[10px] text-neutral-400 max-w-xs mx-auto text-center font-sans">
                      Oscilloscope and input recording circuits are in sleep mode. Click the connect button below to run live microphone routing.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Controller Underneath visualizer */}
            <div className="p-4 bg-[var(--theme-card-bg)] flex items-center justify-between gap-4">
              {!isRunning ? (
                <button
                  onClick={startMicrophone}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-mono font-extrabold uppercase px-5 py-2.5 rounded shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  <Mic className="w-4 h-4 animate-bounce" />
                  <span>Connect Microphone</span>
                </button>
              ) : (
                <button
                  onClick={stopMicrophone}
                  className="bg-red-500 hover:bg-red-600 text-white text-xs font-mono font-extrabold uppercase px-5 py-2.5 rounded shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  <MicOff className="w-4 h-4" />
                  <span>Disconnect Microphone</span>
                </button>
              )}
            </div>

          </div>

          <div className="p-4 bg-[var(--theme-bg)]/80 border border-[var(--theme-card-border)] rounded-md flex items-start gap-3">
            <Info className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed font-sans space-y-1">
              <p className="font-bold text-[var(--theme-text)] uppercase tracking-wider">🔒 Isolation of Audio Signals</p>
              <p>
                Voice test recording chunks are contained in secure local Blob registers. No network packets are emitted, meaning all acoustics and recordings are exclusively local to your computer.
              </p>
            </div>
          </div>
        </div>

        {/* METRICS & AUDIO RECORDING / PLAYBACK CONTROLS (COL-SPAN-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* SECURE RECORDING & PLAYBACK CONSOLE */}
          <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] p-5 rounded-lg space-y-5 shadow-sm">
            <span className="text-xs font-extrabold uppercase font-mono tracking-wider text-[var(--theme-text)] block border-b border-[var(--theme-card-border)] pb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              <span>Audio Record & Playback Tester</span>
            </span>

            {/* Conditional layouts based on recording states */}
            {recordingState === 'idle' && (
              <div className="space-y-4 py-3 text-center border-2 border-dashed border-[var(--theme-card-border)] rounded bg-[var(--theme-bg)]/40">
                <p className="text-[11px] font-mono text-[var(--theme-text-muted)]">
                  READY TO RECORD AUDIO CLIP TO VERIFY PLAYBACK SOUND
                </p>
                <button
                  disabled={!isRunning}
                  onClick={startRecording}
                  className="mx-auto bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 text-xs font-mono font-extrabold uppercase px-5 py-2.5 rounded transition-all active:scale-95 flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Start Recording</span>
                </button>
                {!isRunning && (
                  <p className="text-[10px] text-amber-500 font-semibold font-mono uppercase">
                    * Please connect microphone above to start recording.
                  </p>
                )}
              </div>
            )}

            {recordingState === 'recording' && (
              <div className="space-y-4 py-4 text-center border-2 border-dashed border-red-500/40 rounded bg-red-500/5 animate-pulse">
                <div className="flex items-center justify-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-ping"></span>
                  <span className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest">
                    RECORDING LIVE SOUND
                  </span>
                </div>
                
                <span className="text-2xl font-mono font-black text-[var(--theme-text)] block">
                  {formatTime(recordDuration)}
                </span>

                <button
                  onClick={stopRecording}
                  className="mx-auto bg-neutral-800 hover:bg-neutral-900 border border-neutral-700 text-white text-xs font-mono font-extrabold uppercase px-5 py-2.5 rounded transition-all active:scale-95 flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Record</span>
                </button>
              </div>
            )}

            {recordingState === 'recorded' && (
              <div className="space-y-5 p-4 bg-[var(--theme-bg)]/90 border border-[var(--theme-card-border)] rounded">
                <div className="flex justify-between items-center border-b border-[var(--theme-card-border)] pb-2">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                    Captured Sound Buffers Ready!
                  </span>
                  <span className="text-xs font-mono text-[var(--theme-text-muted)]">
                    Length: {formatTime(recordDuration)}
                  </span>
                </div>

                {/* Simulated Audio cassette / controller deck */}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={togglePlayback}
                    className="flex-grow bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-mono font-extrabold uppercase py-2.5 rounded transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isPlaybackPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlaybackPlaying ? "Pause Listening" : "Play Back"}</span>
                  </button>

                  <button
                    onClick={resetRecordingSpace}
                    className="bg-[var(--theme-bg)] hover:border-red-500 hover:text-red-500 border border-[var(--theme-card-border)] text-[var(--theme-text-muted)] text-xs font-mono font-extrabold uppercase px-4 py-2.5 rounded transition-all active:scale-95 flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Redo</span>
                  </button>
                </div>

                {audioUrl && (
                  <div className="space-y-4 pt-1.5">
                    {/* Hidden Native Audio Controller Element for Playbacks */}
                    <audio
                      ref={playbackRef}
                      src={audioUrl}
                      onEnded={handlePlaybackFinished}
                      className="hidden"
                    />

                    {/* Download capability */}
                    <a
                      href={audioUrl}
                      download={`diagnostic-mic-recording.${mimeTypeRef.current.includes('mp4') ? 'm4a' : 'webm'}`}
                      className="w-full border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 text-[10px] font-mono font-bold uppercase py-2 rounded text-center block transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download sound recording</span>
                    </a>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* CALIBRATION SOUND VOLUME METER */}
          <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] p-5 rounded-lg space-y-5 shadow-sm">
            <span className="text-xs font-extrabold uppercase font-mono tracking-wider text-[var(--theme-text)] block border-b border-[var(--theme-card-border)] pb-2 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-500" />
              <span>Calibrate Sound Volume Gain</span>
            </span>

            {/* Instant sounds capture */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wide">Live Volume Gain</span>
                <span className={`font-extrabold ${currentVolume > 85 ? 'text-rose-500' : 'text-[var(--theme-text)]'}`}>{currentVolume}%</span>
              </div>
              <div className="h-3.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] rounded-full overflow-hidden p-0.5">
                <div
                  style={{ width: `${currentVolume}%` }}
                  className={`h-full rounded-full transition-all duration-75 ${
                    currentVolume > 85 
                      ? 'bg-rose-500' 
                      : currentVolume > 60 
                        ? 'bg-amber-400' 
                        : 'bg-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* Highest captured sound decibel */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wide">Peak dB Captured</span>
                <span className="font-extrabold text-emerald-400">{peakVolume}%</span>
              </div>
              <div className="h-3.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] rounded-full overflow-hidden p-0.5 relative">
                <div
                  style={{ width: `${peakVolume}%` }}
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                />
                {/* Horizontal marker on current peak session */}
                {peakVolume > 0 && (
                  <div
                    style={{ left: `${peakVolume}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                  />
                )}
              </div>
            </div>

          </div>

          {/* Connected physical driver statistics */}
          {isRunning && micStats && (
            <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] p-5 rounded-lg space-y-4 shadow-sm">
              <span className="text-xs font-extrabold uppercase font-mono tracking-wider text-[var(--theme-text)] block border-b border-[var(--theme-card-border)] pb-2 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>Microphone Driver Registry Specs</span>
              </span>
              <div className="text-xs font-mono space-y-2.5 text-[var(--theme-text)]">
                <div>
                  <span className="text-[9px] text-[var(--theme-text-muted)] uppercase block mb-0.5">Hardware Driver ID Name</span>
                  <span className="font-bold text-[var(--theme-text)] block leading-tight truncate">
                    {micStats.label}
                  </span>
                </div>
                <div className="flex justify-between border-b border-dotted border-[var(--theme-card-border)] pb-1 pt-1.5">
                  <span className="text-[10px] text-[var(--theme-text-muted)] uppercase">Sample Rate</span>
                  <span className="font-bold text-emerald-400">{micStats.sampleRate / 1000} kHz (CD standard)</span>
                </div>
                <div className="flex justify-between pb-0.5">
                  <span className="text-[10px] text-[var(--theme-text-muted)] uppercase">Channel Track</span>
                  <span className="font-bold uppercase">
                    {micStats.channelCount === 1 ? 'Mono (1 Channel)' : `Stereo (${micStats.channelCount} Channels)`}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
