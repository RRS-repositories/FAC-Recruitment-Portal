import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorLine } from './FormShell';
import { readIntoMemory } from './readIntoMemory';
import {
  checkAudioDuration,
  checkAudioFile,
  formatClock,
  formatMB,
  recordingTooShort,
  voiceFileName,
  wholeMB,
} from './helpers';

/** The recorder's preferred formats, best first. '' lets the browser choose. */
function pickMimeType() {
  const can = (type) =>
    typeof window.MediaRecorder?.isTypeSupported === 'function' &&
    window.MediaRecorder.isTypeSupported(type);
  if (can('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (can('audio/mp4')) return 'audio/mp4';
  return '';
}

/**
 * How long an audio file plays for, read from its metadata.
 *
 * Resolves NaN rather than rejecting when the browser cannot tell (an error,
 * no event within ten seconds, or a streamed file reporting Infinity) — the
 * design lets those through and the server has the final word.
 */
function readDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(Number.NaN), 10000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(Number.NaN);
    audio.src = url;
  });
}

/**
 * Record a voice note in the browser, or upload one — the design's recorder.
 *
 * `value` is `{ file, name, size, duration, source }` or null. `file` is
 * always an in-memory File: a recording is a Blob already, and an upload is
 * copied at selection (see readIntoMemory.js) so a phone revoking the picked
 * file cannot break the upload at Submit.
 *
 * Re-recording replaces the note only once the new one is long enough, so a
 * false start never costs the candidate the good take they already had.
 */
export function VoiceRecorder({ value, onChange, limits, onRecordingChange }) {
  const { voiceMaxSeconds: maxSecs, voiceMinSeconds: minSecs, voiceMaxBytes: maxBytes } = limits;
  const minutes = Math.round(maxSecs / 60);

  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [hint, setHint] = useState('Tap the microphone to start recording');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [playUrl, setPlayUrl] = useState('');

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const tickRef = useRef(null);
  const secsRef = useRef(0);
  const fileInputRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  // A playable URL for whichever note is current, released when it changes.
  useEffect(() => {
    if (!value?.file) {
      setPlayUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(value.file);
    setPlayUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stop = useCallback(() => {
    clearInterval(tickRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    releaseStream();
    setRecording(false);
    setHint('Tap the microphone to record again');
  }, []);

  // Leaving the step mid-recording discards that take and frees the
  // microphone — the browser's "recording" indicator must not stay on.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearInterval(tickRef.current);
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      releaseStream();
    };
  }, []);

  const toggle = async () => {
    setError('');
    if (recording) {
      stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setError("Your browser can't record audio here. Please upload a recording instead.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        'Microphone access was blocked. Allow it in your browser, or upload a recording instead.',
      );
      return;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const mime = pickMimeType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setError("Your browser can't record audio here. Please upload a recording instead.");
      return;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    secsRef.current = 0;
    setSecs(0);

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      if (!mountedRef.current) return;
      const tooShort = recordingTooShort(secsRef.current, minSecs);
      if (tooShort) {
        setError(tooShort);
        return;
      }
      const type = recorder.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      const file = new File([blob], voiceFileName(type), { type });
      onChange({
        file,
        name: file.name,
        size: file.size,
        duration: secsRef.current,
        source: 'recorded',
      });
    };

    recorder.start(1000);
    setRecording(true);
    setHint('Recording… tap the square to stop');
    tickRef.current = setInterval(() => {
      secsRef.current += 1;
      setSecs(secsRef.current);
      if (secsRef.current >= maxSecs) {
        stop();
        setHint(`${minutes}-minute limit reached — recording saved`);
      }
    }, 1000);
  };

  const handleFile = async (picked) => {
    setError('');
    const problem = checkAudioFile(picked, { maxBytes });
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    try {
      let copy;
      try {
        copy = await readIntoMemory(picked);
      } catch {
        setError("We couldn't read that file. Please choose it again.");
        return;
      }
      const duration = await readDuration(copy);
      if (!mountedRef.current) return;
      const tooLong = checkAudioDuration(duration, { minSeconds: minSecs, maxSeconds: maxSecs });
      if (tooLong) {
        setError(tooLong);
        return;
      }
      onChange({
        file: copy,
        name: copy.name,
        size: copy.size,
        duration: Number.isFinite(duration) ? Math.round(duration) : 0,
        source: 'uploaded',
      });
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  return (
    <>
      <div className={`rec ${recording ? 'live' : ''}`}>
        <button
          type="button"
          className={`mic ${recording ? 'live' : ''}`}
          onClick={toggle}
          disabled={busy}
          title="Record"
          aria-label={recording ? 'Stop recording' : value ? 'Record again' : 'Start recording'}
        >
          <span aria-hidden="true">{recording ? '■' : '🎙'}</span>
        </button>
        <div className={`timer ${secs >= maxSecs - 60 ? 'warnt' : ''}`}>{formatClock(secs)}</div>
        <div className="rec-hint" aria-live="polite">
          {hint}
        </div>
        <div className="bar" aria-hidden="true">
          <div style={{ width: `${Math.min(100, (secs / maxSecs) * 100)}%` }} />
        </div>
      </div>

      <div className="or">or upload a recording</div>
      <button
        type="button"
        className="drop"
        disabled={recording || busy}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files?.[0];
          if (dropped && !recording) handleFile(dropped);
        }}
      >
        <b>{busy ? 'Checking your file…' : 'Choose an audio file'}</b>
        <span>
          MP3, M4A, WAV or OGG · up to {wholeMB(maxBytes)} MB · max {minutes} minutes
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.webm"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = '';
          if (picked) handleFile(picked);
        }}
      />

      {value ? (
        <div>
          <div className="filepill">
            <span aria-hidden="true">🔊</span> {value.name} · {formatClock(value.duration)} ·{' '}
            {formatMB(value.size)} MB{' '}
            <button type="button" onClick={() => onChange(null)} title="Remove" aria-label="Remove voice note">
              ×
            </button>
          </div>
          {playUrl ? <audio controls src={playUrl} aria-label="Play back your voice note" /> : null}
        </div>
      ) : null}

      <ErrorLine message={error} />
    </>
  );
}

export default VoiceRecorder;
