/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, VideoOff, Download, Info, Activity, AlertCircle, Cpu } from 'lucide-react';

interface StreamStats {
  width: number;
  height: number;
  aspectRatio: number;
  frameRate: number;
  label: string;
  facingMode: string;
  deviceId: string;
  groupId: string;
  channelType: string;
  exposureMode?: string;
  focusMode?: string;
  whiteBalanceMode?: string;
}

export default function WebcamTest() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [stats, setStats] = useState<StreamStats | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [supportedCapabilities, setSupportedCapabilities] = useState<any>(null);

  // Enumerate cameras on component mount and monitor updates
  const updateDeviceList = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      setErrorText("Browser does not support media device enumeration APIs.");
      return;
    }
    
    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        const videoInputs = devices.filter((device) => device.kind === 'videoinput');
        setCameraDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      })
      .catch((err) => {
        console.warn("Could not enumerate camera capture units", err);
      });
  };

  useEffect(() => {
    updateDeviceList();
    
    // Listen for device changes (e.g. plugging/unplugging webcam)
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', updateDeviceList);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', updateDeviceList);
      };
    }
  }, []);

  // Safe release of capture stream resources
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsRunning(false);
    setStats(null);
    setSupportedCapabilities(null);
  };

  const startWebcam = async () => {
    setErrorText(null);
    setSnapshotUrl(null);

    // Turn off previous capture streams if running
    if (streamRef.current) {
      stopWebcam();
    }

    const constraints: MediaStreamConstraints = {
      video: selectedDeviceId 
        ? { deviceId: { exact: selectedDeviceId } }
        : { width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false, // Webcam test serves purely as video boundary diagnostic
    };

    try {
      // First ask for camera access
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsRunning(true);

      // Extract details about the active physical camera
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        
        // Read extended media capabilities if available from user constraints
        let capabilities: any = {};
        if (typeof videoTrack.getCapabilities === 'function') {
          capabilities = videoTrack.getCapabilities();
          setSupportedCapabilities(capabilities);
        }

        // Determine camera brand or label descriptor
        let labelName = videoTrack.label || 'Default Camera Capture Device';
        if (!labelName || labelName === '') {
          // If labels are locked, re-run device lookup representing correct strings
          const updatedDevices = await navigator.mediaDevices.enumerateDevices();
          const match = updatedDevices.find(d => d.deviceId === settings.deviceId && d.kind === 'videoinput');
          if (match) {
            labelName = match.label;
          }
        }

        setStats({
          width: settings.width || 0,
          height: settings.height || 0,
          aspectRatio: settings.aspectRatio || (settings.width && settings.height ? settings.width / settings.height : 1.77),
          frameRate: Math.round(settings.frameRate || 30),
          label: labelName || 'Standard Web Camera hardware unit',
          facingMode: settings.facingMode || 'User Facing / Integrated',
          deviceId: settings.deviceId || selectedDeviceId,
          groupId: settings.groupId || 'Default System PCI Group',
          channelType: videoTrack.contentHint || 'PCI Streaming Controller',
          exposureMode: (settings as any).exposureMode,
          focusMode: (settings as any).focusMode,
          whiteBalanceMode: (settings as any).whiteBalanceMode,
        });
      }

      // Refresh camera list (asking permissions releases full labels)
      updateDeviceList();
    } catch (err: any) {
      console.error(err);
      let desc = "Hardware interface: Webcam access blocked or camera currently held by another background software.";
      if (err.name === 'NotAllowedError') {
        desc = "Camera permission was rejected. Please enable camera access in your browser location box or system privacy panels.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        desc = "No physical camera or USB video input device was detected on your hardware configuration.";
      }
      setErrorText(desc);
      setIsRunning(false);
    }
  };

  // Re-run stream when picker values change
  useEffect(() => {
    if (isRunning && selectedDeviceId) {
      startWebcam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId]);

  // Clean-up streamer hooks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video || !isRunning) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeFilter !== 'none') {
      let filterStr = '';
      if (activeFilter === 'grayscale') filterStr = 'grayscale(1)';
      else if (activeFilter === 'sepia') filterStr = 'sepia(1)';
      else if (activeFilter === 'invert') filterStr = 'invert(1)';
      else if (activeFilter === 'noir') filterStr = 'grayscale(1) contrast(1.4) brightness(0.9)';
      ctx.filter = filterStr;
    }

    // Capture visual frame mirrored for natural look
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setSnapshotUrl(dataUrl);
  };

  const getFilterStyles = (): string => {
    switch (activeFilter) {
      case 'grayscale': return 'grayscale';
      case 'sepia': return 'sepia';
      case 'invert': return 'invert';
      case 'noir': return 'contrast-125 brightness-90 grayscale';
      default: return '';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--theme-text)] flex items-center gap-2">
            <Video className="w-6 h-6 text-emerald-500" />
            <span>Hardware Webcam Diagnostics Tracker</span>
          </h2>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1 font-sans">
            Verify video signals, read detailed camera hardware specifications, check capabilities, and capture snaps with active filters.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* INTERACTIVE VIDEO PREVIEW VIEW (COL-SPAN-7) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] rounded-lg overflow-hidden relative shadow-sm">
            
            {/* Header top settings */}
            <div className="bg-[var(--theme-bg)] border-b border-[var(--theme-card-border)] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-505 bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="font-bold uppercase tracking-wider text-[var(--theme-text)] text-[11px]">
                  {isRunning ? 'Webcam Signal Active' : 'Camera Signal Standby'}
                </span>
              </div>

              {cameraDevices.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--theme-text-muted)] font-bold">DEVICE:</span>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] outline-none rounded py-1 px-2 text-[10px] font-bold font-mono focus:border-emerald-500 text-[var(--theme-text)]"
                  >
                    {cameraDevices.map((dev) => (
                      <option key={dev.deviceId} value={dev.deviceId}>
                        {dev.label || `Camera Hardware (${dev.deviceId.slice(0,6)}...)`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Video preview frame */}
            <div className="relative aspect-video bg-neutral-900 border-b border-[var(--theme-card-border)] flex items-center justify-center overflow-hidden">
              {errorText ? (
                <div className="text-center p-6 space-y-3 max-w-sm">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                  <p className="text-xs text-red-400 font-medium leading-relaxed font-mono">
                    {errorText}
                  </p>
                  <button
                    onClick={startWebcam}
                    className="text-[10px] font-mono font-extrabold uppercase px-4 py-2 border border-red-500/30 text-red-400 rounded hover:bg-rose-500/10 transition-colors"
                  >
                    Request Permissions Again
                  </button>
                </div>
              ) : isRunning ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] transition-transform ${getFilterStyles()}`}
                />
              ) : (
                <div className="text-center p-6 space-y-4">
                  <span className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
                    <Camera className="w-8 h-8 text-emerald-500" />
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest">Webcam Feed is Suspended</h3>
                    <p className="text-[10px] text-neutral-400 max-w-xs mx-auto text-center font-sans">
                      Tap the start button below to initiate hardware feed and read full product specifications.
                    </p>
                  </div>
                </div>
              )}

              {/* Resolution indicator watermarking block */}
              {isRunning && stats && (
                <div className="absolute bottom-3 left-3 bg-black/85 px-3 py-1 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30 shadow select-none uppercase tracking-wider font-extrabold">
                  {stats.width} &times; {stats.height} px @ {stats.frameRate} FPS
                </div>
              )}
            </div>

            {/* Action panel underneath preview */}
            <div className="p-4 bg-[var(--theme-card-bg)] flex flex-wrap gap-3.5 items-center justify-between">
              <div className="flex gap-2.5">
                {!isRunning ? (
                  <button
                    onClick={startWebcam}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-mono font-extrabold uppercase px-5 py-2.5 rounded shadow transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    <span>Initialize Camera hardware</span>
                  </button>
                ) : (
                  <button
                    onClick={stopWebcam}
                    className="bg-red-500 hover:bg-red-600 text-white text-xs font-mono font-extrabold uppercase px-5 py-2.5 rounded shadow transition-all active:scale-95 flex items-center gap-2"
                  >
                    <VideoOff className="w-4 h-4" />
                    <span>Terminate Webcam Stream</span>
                  </button>
                )}

                {isRunning && (
                  <button
                    onClick={takeSnapshot}
                    className="bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-text)] text-[var(--theme-text)] text-xs font-mono font-extrabold uppercase px-[18px] py-2.5 rounded transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4 text-emerald-500" />
                    <span>Take Snap</span>
                  </button>
                )}
              </div>

              {isRunning && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-[var(--theme-text-muted)] uppercase mr-1">FX Layers:</span>
                  {(['none', 'grayscale', 'sepia', 'noir'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-2 py-1 text-[9px] font-mono font-bold uppercase rounded border transition-all ${
                        activeFilter === filter
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'border-[var(--theme-card-border)] hover:border-[var(--theme-text)] text-[var(--theme-text-muted)] bg-[var(--theme-bg)]'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="p-4 bg-[var(--theme-bg)]/80 border border-[var(--theme-card-border)] rounded-md flex items-start gap-3">
            <Info className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed font-sans space-y-1">
              <p className="font-bold text-[var(--theme-text)] uppercase tracking-wider">🔒 Media Stream Isolation</p>
              <p>
                All frame extraction pipelines run natively inside local hardware buffers. Video records are processed on local memory stacks and never transmitted overseas.
              </p>
            </div>
          </div>
        </div>

        {/* METRICS & SNAPSHOT GALLERY GALLERY (COL-SPAN-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* CAMERA DETAILED SPECIFICATION BLOCK */}
          <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] p-5 rounded-lg space-y-4 shadow-sm">
            <span className="text-xs font-extrabold uppercase font-mono tracking-wider text-[var(--theme-text)] block border-b border-[var(--theme-card-border)] pb-2 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-500" />
              <span>Camera Hardware Info</span>
            </span>

            {isRunning && stats ? (
              <div className="text-xs font-mono space-y-3.5 text-[var(--theme-text)]">
                <div>
                  <span className="text-[9px] text-[var(--theme-text-muted)] uppercase block mb-0.5">Model Name / Device ID</span>
                  <span className="font-bold text-emerald-400 block leading-tight break-words bg-[var(--theme-bg)] p-2 rounded border border-[var(--theme-card-border)]">
                    {stats.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-[9px] text-[var(--theme-text-muted)] uppercase block">Sensor Resolution</span>
                    <span className="font-bold text-[var(--theme-text)]">{stats.width} &times; {stats.height} px</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--theme-text-muted)] uppercase block">Frame Frequency</span>
                    <span className="font-bold text-[var(--theme-text)]">{stats.frameRate} FPS (Hz)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-[9px] text-[var(--theme-text-muted)] uppercase block">Aspect Aspect</span>
                    <span className="font-bold text-[var(--theme-text)]">{stats.aspectRatio.toFixed(2)}:1</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--theme-text-muted)] uppercase block">Facing Anchor</span>
                    <span className="font-bold text-emerald-500 uppercase">{stats.facingMode}</span>
                  </div>
                </div>

                {supportedCapabilities && (
                  <div className="border-t border-[var(--theme-card-border)] pt-3.5 space-y-2">
                    <span className="text-[9px] text-[var(--theme-text-muted)] uppercase block font-bold">Hardware Capability Registry</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-[var(--theme-text-muted)]">
                      <div className="flex justify-between">
                        <span>Zoom Support:</span>
                        <span className="font-bold text-[var(--theme-text)]">{supportedCapabilities.zoom ? 'YES' : 'NO'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Focus Settings:</span>
                        <span className="font-bold text-[var(--theme-text)]">{supportedCapabilities.focusMode ? 'AUTO' : 'MANUAL'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Aspect constraints:</span>
                        <span className="font-bold text-[var(--theme-text)]">
                          {supportedCapabilities.aspectRatio ? `${supportedCapabilities.aspectRatio.min.toFixed(1)}-${supportedCapabilities.aspectRatio.max.toFixed(1)}` : 'STANDARD'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Light sensor:</span>
                        <span className="font-bold text-[var(--theme-text)]">{supportedCapabilities.brightness ? 'AUTO_GAIN' : 'STATIC'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-6 border border-dashed border-[var(--theme-card-border)] rounded bg-[var(--theme-bg)]/40">
                <Activity className="w-5 h-5 text-[var(--theme-text-muted)] mx-auto mb-2 animate-pulse" />
                <p className="text-[10px] text-[var(--theme-text-muted)] font-mono uppercase">
                  Awaiting feed diagnostics...
                </p>
              </div>
            )}
          </div>

          {/* Captured Gallery snapshots */}
          <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] p-5 rounded-lg space-y-4 shadow-sm flex flex-col h-full min-h-[300px]">
            <span className="text-xs font-extrabold uppercase font-mono tracking-wider text-[var(--theme-text)] block border-b border-[var(--theme-card-border)] pb-2 flex items-center justify-between">
              <span>🖼️ Canvas Export Capture</span>
              {snapshotUrl && (
                <button
                  onClick={() => setSnapshotUrl(null)}
                  className="text-[9px] uppercase hover:text-red-500 font-extrabold transition-all"
                >
                  Discard File
                </button>
              )}
            </span>

            {snapshotUrl ? (
              <div className="space-y-4 flex-grow flex flex-col justify-between">
                <div className="relative border border-[var(--theme-card-border)] bg-[var(--theme-bg)] rounded overflow-hidden aspect-video shadow-md">
                  <img
                    src={snapshotUrl}
                    alt="Captured test snapshot"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2 right-2 bg-emerald-500 text-white font-mono px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold shadow">
                    JPEG Export
                  </div>
                </div>

                <div className="space-y-2">
                  <a
                    href={snapshotUrl}
                    download="webcam-snapshot-capture.jpg"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-mono font-extrabold uppercase py-2.5 px-4 rounded text-center block shadow transition-all active:scale-98 flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Captured Frame</span>
                  </a>
                  <p className="text-[9px] font-mono text-[var(--theme-text-muted)] text-center">
                    Saved directly into local device storage registers.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-[var(--theme-card-border)] rounded bg-[var(--theme-bg)]/20">
                <Camera className="w-8 h-8 text-[var(--theme-text-muted)] opacity-50 mb-2" />
                <span className="text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wide block">No snapped frames</span>
                <p className="text-[9px] text-[var(--theme-text-muted)] max-w-[200px] mt-1 font-sans">
                  Start the webcam and click &ldquo;Take Snap&rdquo; to lock down current image matrix.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
