// Push-to-talk voice input hook.
//
// PR ψ2.2 (2026-07-13). Extracted from the MiniMind chat client so
// State-module chats can reuse the same UX. Locked decision #22:
// server-side transcription via Groq Whisper turbo, audio never
// persisted, user reviews the transcript in the textarea before
// sending.
//
// This hook is i18n-agnostic — it emits raw error codes and the
// caller renders them via its own translator. The transcribe
// endpoint URL is passed in so surfaces can point at their own
// endpoint if they need surface-specific rate limits.
//
// SSR-safe: MediaRecorder support is detected in an effect so first
// render matches the server. On unsupported browsers `supported` stays
// false and the caller should hide the mic button entirely.

import { useEffect, useRef, useState } from 'react';

export type VoiceErrorCode =
  | 'permission_denied'
  | 'no_mic'
  | 'start_failed'
  | 'empty_audio'
  | 'rate_limited'
  | 'unavailable'
  | 'transcription_failed'
  | 'network_error';

export type UseVoiceInputArgs = {
  /** Transcription endpoint (POST multipart/form-data with `audio` field, returns `{ text }`). */
  endpoint: string;
  /** Hard ceiling for a single recording. Auto-stops at this many seconds. */
  maxSeconds: number;
  /**
   * Optional ISO-639-1 hint the endpoint may pass through to Whisper as
   * `language`. Improves accuracy on the app's active locale and
   * prevents mid-session drift into a wrong language. Omit if the
   * surface has no locale context.
   */
  hintLocale?: string;
  /** Called with the transcribed text on successful transcription. */
  onTranscript: (text: string) => void;
  /** Called when the user tries to record but is already sending — for callers that want to focus the textarea etc. Optional. */
  onError?: (code: VoiceErrorCode) => void;
};

export type UseVoiceInputReturn = {
  /** Whether MediaRecorder + getUserMedia are available in this browser. */
  supported: boolean;
  /** True while the user is actively recording. */
  recording: boolean;
  /** True while the server is transcribing the finished clip. */
  transcribing: boolean;
  /** Seconds elapsed in the current recording (0 when idle). */
  recordingSeconds: number;
  /** The most recent error code, or null. */
  error: VoiceErrorCode | null;
  /** Clear the error state (e.g. after showing a toast). */
  clearError: () => void;
  /** Toggle: start recording if idle, stop recording if active, no-op if transcribing. */
  toggle: () => void;
};

export function useVoiceInput({
  endpoint,
  maxSeconds,
  hintLocale,
  onTranscript,
  onError,
}: UseVoiceInputArgs): UseVoiceInputReturn {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState<VoiceErrorCode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSupported(
      typeof MediaRecorder !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);

  // Cleanup on unmount — stop the recorder and release the mic tracks
  // so navigation doesn't leave the browser's recording indicator on.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function emitError(code: VoiceErrorCode) {
    setError(code);
    onError?.(code);
  }

  function clearError() {
    setError(null);
  }

  async function startRecording() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as Error).name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        emitError('permission_denied');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        emitError('no_mic');
      } else {
        emitError('start_failed');
      }
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecording(false);
      setRecordingSeconds(0);

      const blob = new Blob(chunks, {
        type: recorder.mimeType || 'audio/webm',
      });
      if (blob.size === 0) {
        emitError('empty_audio');
        return;
      }

      const ext = recorder.mimeType.includes('mp4')
        ? 'm4a'
        : recorder.mimeType.includes('ogg')
          ? 'ogg'
          : 'webm';

      setTranscribing(true);
      try {
        const form = new FormData();
        form.append('audio', blob, `voice.${ext}`);
        if (hintLocale) form.append('locale', hintLocale);
        const res = await fetch(endpoint, { method: 'POST', body: form });
        if (!res.ok) {
          if (res.status === 429) emitError('rate_limited');
          else if (res.status === 503) emitError('unavailable');
          else emitError('transcription_failed');
          return;
        }
        const data: { text?: string } = await res.json();
        const text = data.text?.trim() ?? '';
        if (text.length === 0) {
          emitError('empty_audio');
        } else {
          onTranscript(text);
        }
      } catch {
        emitError('network_error');
      } finally {
        setTranscribing(false);
      }
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
    setRecordingSeconds(0);

    // Timer both ticks the visible countdown and enforces the hard cap.
    // Stop the recorder AND clear the interval together so the ticker
    // doesn't briefly overshoot during the async stop → onstop gap.
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => {
        const next = prev + 1;
        if (next >= maxSeconds) {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  function toggle() {
    if (transcribing) return;
    if (recording) stopRecording();
    else void startRecording();
  }

  return {
    supported,
    recording,
    transcribing,
    recordingSeconds,
    error,
    clearError,
    toggle,
  };
}

/**
 * Convenience: format `MM:SS` for the visible countdown.
 */
export function formatVoiceTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
