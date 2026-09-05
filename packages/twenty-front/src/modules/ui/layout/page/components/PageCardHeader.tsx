import { useNavigationDrawerExpanded } from '@/navigation/hooks/useNavigationDrawerExpanded';
import { PAGE_ACTION_CONTAINER_CLICK_OUTSIDE_ID } from '@/ui/layout/page/constants/PageActionContainerClickOutsideId';
import { Breadcrumb } from '@/ui/navigation/bread-crumb/components/Breadcrumb';
import { NavigationDrawerCollapseButton } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerCollapseButton';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import { styled } from '@linaria/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { IconPhone } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

// ================================================================
// ИМПОРТ Notification
// ================================================================
import Notification from '@/modules/ui/layout/modal/components/Notification';

const StyledHeader = styled.div<{ centerTitle?: boolean }>`
  align-items: center;
  display: flex;
  flex-direction: row;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  min-height: 40px;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[3]}
    ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  position: relative;
  width: 100%;
`;

const StyledLeft = styled.div`
  align-items: center;
  display: flex;
  flex: 0 1 auto;
  flex-direction: row;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
  overflow: hidden;
`;

const StyledRight = styled.div<{ centerTitle?: boolean }>`
  align-items: center;
  display: flex;
  flex: 1 1 0;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
  min-width: 0;
`;

const StyledTitle = styled.div<{ titleColor?: string }>`
  align-items: center;
  color: ${({ titleColor }) =>
    titleColor || themeCssVariables.font.color.primary};
  display: flex;
  flex-direction: row;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[1]};
  overflow: hidden;
`;

const StyledCenteredTitle = styled.div<{ titleColor?: string }>`
  align-items: center;
  color: ${({ titleColor }) =>
    titleColor || themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
`;

type PageCardHeaderProps = {
  links?: Array<{ name: string; path?: string }>;
  breadcrumb?: ReactNode;
  icon?: ReactNode;
  title?: ReactNode;
  tag?: ReactNode;
  actionButton?: ReactNode;
  centerTitle?: boolean;
  titleColor?: string;
};

// ================================================================
// Стили кнопки
// ================================================================
const StyledCallButton = styled.button<{
  isRecording?: boolean;
  isModelReady?: boolean;
}>`
  align-items: center;
  background: ${({ isRecording, isModelReady }) => {
    if (!isModelReady) return themeCssVariables.background.tertiary;
    if (isRecording) return '#e74c3c';
    return '#3498db';
  }};
  border: none;
  border-radius: 8px;
  box-shadow: ${({ isRecording }) =>
    isRecording ? '0 0 20px rgba(231, 76, 60, 0.4)' : 'none'};
  color: #ffffff;
  cursor: ${({ isModelReady }) => (isModelReady ? 'pointer' : 'not-allowed')};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[1]};
  height: 36px;
  justify-content: center;
  opacity: ${({ isModelReady }) => (isModelReady ? 1 : 0.4)};
  padding: 0 ${themeCssVariables.spacing[3]};
  position: relative;
  left: 30px;
  transition: all 0.2s ease;

  &:hover {
    background: ${({ isRecording, isModelReady }) => {
      if (!isModelReady) return themeCssVariables.background.tertiary;
      if (isRecording) return '#c0392b';
      return '#2980b9';
    }};
    transform: ${({ isModelReady }) => (isModelReady ? 'scale(1.02)' : 'none')};
  }

  &:active {
    transform: ${({ isModelReady }) => (isModelReady ? 'scale(0.97)' : 'none')};
  }

  &::after {
    animation: pulse-record 1s ease-in-out infinite;
    background: #ff0000;
    border: 2px solid #ffffff;
    border-radius: 50%;
    content: '';
    display: ${({ isRecording }) => (isRecording ? 'block' : 'none')};
    height: 12px;
    position: absolute;
    right: -4px;
    top: -4px;
    width: 12px;
  }

  @keyframes pulse-record {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.4);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

// ================================================================
// Speech recognition
// ================================================================
interface TranscriberInstance {
  (audio: Float32Array, options?: any): Promise<{ text: string }>;
}

function useSpeechRecognition() {
  const [isModelReady, setIsModelReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const transcriberRef = useRef<TranscriberInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadModel = async () => {
      try {
        const { pipeline } = await import('@huggingface/transformers');

        if (cancelled) return;

        const transcriber = await pipeline(
          'automatic-speech-recognition',
          'Xenova/whisper-base',
          {
            dtype: 'fp16',
          },
        );

        if (!cancelled) {
          transcriberRef.current = transcriber as TranscriberInstance;
          setIsModelReady(true);
          console.log('[Speech] Model ready');
        }
      } catch (err) {
        console.error('[Speech] Failed to load model:', err);
      }
    };

    loadModel();
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const float32FromAudioBuffer = async (
    audioBuffer: AudioBuffer,
  ): Promise<Float32Array> => {
    const offlineCtx = new OfflineAudioContext(
      1,
      Math.ceil(audioBuffer.duration * 16000),
      16000,
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
  };

  const blobToFloat32 = async (blob: Blob): Promise<Float32Array> => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    await audioCtx.close();
    return float32FromAudioBuffer(audioBuffer);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecordingSeconds(0);
  };

  const startRecording = async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
      console.log('[Speech] Recording started');
    } catch (err) {
      console.error('[Speech] Failed to start recording:', err);
    }
  };

  const stopRecordingAndTranscribe = async () => {
    if (!isRecording || !mediaRecorderRef.current) return;

    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;

      recorder.onstop = async () => {
        clearTimer();
        setIsRecording(false);
        setIsTranscribing(true);

        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          chunksRef.current = [];

          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }

          console.log('[Speech] Recording stopped, transcribing...');
          const audio = await blobToFloat32(blob);

          if (!transcriberRef.current) {
            console.error('[Speech] Transcriber not loaded');
            setIsTranscribing(false);
            resolve();
            return;
          }

          const result = await transcriberRef.current(audio, {
            language: 'ukrainian',
            task: 'transcribe',
          });

          const text = (result?.text || '').trim();

          // ================================================================
          // 🔥 ПОКАЗЫВАЕМ NOTIFICATION С РАСПОЗНАННЫМ ТЕКСТОМ
          // ================================================================
          if (text) {
            console.log('[Speech] Transcription result:', text);

            // Показываем уведомление с текстом на 30 секунд
            await Notification.show(
              `🎤 ${text}`,
              'center-center',
              30000, // 30 секунд
              {
                startIndex: 2, // Начинаем с эмодзи
                fontSize: 22,
                fontColor: '#67fe0f',
                bold: true,
                includeCopyBtn: true,
              },
              10, // Countdown с 10
            );
          } else {
            // Если текст пустой — показываем другое уведомление
            await Notification.show(
              '🤷 Не удалось распознать речь',
              'center-center',
              5000,
              {
                startIndex: 0,
                fontSize: 18,
                fontColor: '#ff6b6b',
                bold: false,
              },
              5,
            );
          }
        } catch (err) {
          console.error('[Speech] Transcription error:', err);

          // Показываем ошибку
          await Notification.show(
            `❌ Ошибка: ${(err as Error).message || 'неизвестная ошибка'}`,
            'center-center',
            8000,
            {
              startIndex: 0,
              fontSize: 16,
              fontColor: '#ff6b6b',
              bold: false,
            },
            8,
          );
        } finally {
          setIsTranscribing(false);
          mediaRecorderRef.current = null;
          resolve();
        }
      };

      recorder.stop();
    });
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearTimer();
      setIsRecording(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      chunksRef.current = [];
      mediaRecorderRef.current = null;
      console.log('[Speech] Recording cancelled');
    }
  };

  const toggleRecording = async () => {
    if (!isModelReady) return;
    if (isRecording) {
      await stopRecordingAndTranscribe();
    } else {
      await startRecording();
    }
  };

  return {
    isModelReady,
    isRecording,
    isTranscribing,
    recordingSeconds,
    toggleRecording,
    cancelRecording,
  };
}

const CallButton = () => {
  const {
    isModelReady,
    isRecording,
    isTranscribing,
    recordingSeconds,
    toggleRecording,
  } = useSpeechRecognition();

  return (
    <StyledCallButton
      isRecording={isRecording}
      isModelReady={isModelReady}
      onClick={() => {
        void toggleRecording();
      }}
      disabled={!isModelReady || isTranscribing}
      title={isRecording ? 'Stop recording' : 'Start voice recording'}
      type="button"
    >
      <IconPhone size={18} />
      {isRecording && (
        <span style={{ marginLeft: 4 }}>{recordingSeconds}s</span>
      )}
    </StyledCallButton>
  );
};

// ================================================================
// PageCardHeader
// ================================================================
export const PageCardHeader = ({
  links,
  breadcrumb,
  icon,
  title,
  tag,
  actionButton,
  centerTitle = false,
  titleColor,
}: PageCardHeaderProps) => {
  const isMobile = useIsMobile();
  const isNavigationDrawerExpanded = useNavigationDrawerExpanded();

  const hasTitleContent =
    !isMobile && (isDefined(icon) || isDefined(title) || isDefined(tag));
  const shouldCenterTitle = centerTitle && hasTitleContent;

  const titleContent = (
    <>
      {isDefined(title) && title}
      {tag}
    </>
  );

  return (
    <StyledHeader centerTitle={shouldCenterTitle}>
      <StyledLeft>
        {!isNavigationDrawerExpanded && (
          <NavigationDrawerCollapseButton direction="right" />
        )}
        {isDefined(breadcrumb)
          ? breadcrumb
          : isDefined(links) && <Breadcrumb links={links} />}
        {!shouldCenterTitle && hasTitleContent && (
          <StyledTitle titleColor={titleColor}>{titleContent}</StyledTitle>
        )}
      </StyledLeft>
      {shouldCenterTitle && (
        <StyledCenteredTitle titleColor={titleColor}>
          {titleContent}
        </StyledCenteredTitle>
      )}
      <StyledRight
        centerTitle={shouldCenterTitle}
        data-click-outside-id={PAGE_ACTION_CONTAINER_CLICK_OUTSIDE_ID}
      >
        <CallButton />
        {actionButton}
      </StyledRight>
    </StyledHeader>
  );
};
