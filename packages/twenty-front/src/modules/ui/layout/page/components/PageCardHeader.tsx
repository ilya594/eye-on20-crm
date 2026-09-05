// Вставляем в PageCardHeader.tsx, добавляем новые импорты и логику

//@ts-nocheck

import { useNavigationDrawerExpanded } from '@/navigation/hooks/useNavigationDrawerExpanded';
import { PAGE_ACTION_CONTAINER_CLICK_OUTSIDE_ID } from '@/ui/layout/page/constants/PageActionContainerClickOutsideId';
import { Breadcrumb } from '@/ui/navigation/bread-crumb/components/Breadcrumb';
import { NavigationDrawerCollapseButton } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerCollapseButton';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import { StyledTitle } from '@/workflow/workflow-steps/workflow-actions/components/workflowRunStepLogsStyles';
import { styled } from '@linaria/react';
import { IconPhone } from '@tabler/icons-react'; // или любой другой иконка телефонного звонка
import { useEffect, useRef, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

// ================================================================
// Стили для кнопки звонка
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
  color: #ffffff;
  cursor: ${({ isModelReady }) => (isModelReady ? 'pointer' : 'not-allowed')};
  display: inline-flex;
  gap: ${themeCssVariables.spacing[1]};
  height: 36px;
  justify-content: center;
  align-items: center;
  opacity: ${({ isModelReady }) => (isModelReady ? 1 : 0.4)};
  padding: 0 ${themeCssVariables.spacing[3]};
  transition: all 0.2s ease;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  box-shadow: ${({ isRecording }) =>
    isRecording ? '0 0 20px rgba(231, 76, 60, 0.4)' : 'none'};
  position: relative;

  &:hover {
    transform: ${({ isModelReady }) => (isModelReady ? 'scale(1.02)' : 'none')};
    background: ${({ isRecording, isModelReady }) => {
      if (!isModelReady) return themeCssVariables.background.tertiary;
      if (isRecording) return '#c0392b';
      return '#2980b9';
    }};
  }

  &:active {
    transform: ${({ isModelReady }) => (isModelReady ? 'scale(0.97)' : 'none')};
  }

  // Пульсирующий индикатор записи
  &::after {
    content: '';
    display: ${({ isRecording }) => (isRecording ? 'block' : 'none')};
    position: absolute;
    top: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    background: #ff0000;
    border-radius: 50%;
    animation: pulse-record 1s ease-in-out infinite;
    border: 2px solid #ffffff;
  }

  @keyframes pulse-record {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.4);
      opacity: 0.6;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
`;

// ================================================================
// Хук для работы с распознаванием речи
// ================================================================
interface TranscriberInstance {
  (audio: Float32Array, options?: any): Promise<{ text: string }>;
}

function useSpeechRecognition() {
  const [isModelReady, setIsModelReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const transcriberRef = useRef<TranscriberInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Загрузка модели
  useEffect(() => {
    let cancelled = false;

    const loadModel = async () => {
      try {
        // Динамический импорт transformers
        const { pipeline } =
          await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0');

        if (cancelled) return;

        const transcriber = await pipeline(
          'automatic-speech-recognition',
          'Xenova/whisper-base',
          {
            // device: 'webgpu', // раскомментируй, если браузер поддерживает WebGPU
            dtype: 'q8',
          },
        );

        if (!cancelled) {
          transcriberRef.current = transcriber;
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
    };
  }, []);

  // Конвертация AudioBuffer в Float32Array
  const float32FromAudioBuffer = async (
    audioBuffer: AudioBuffer,
  ): Promise<Float32Array> => {
    const offlineCtx = new OfflineAudioContext(
      1,
      audioBuffer.duration * 16000,
      16000,
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
  };

  // Конвертация Blob в Float32Array
  const blobToFloat32 = async (blob: Blob): Promise<Float32Array> => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    await audioCtx.close();
    return float32FromAudioBuffer(audioBuffer);
  };

  // Начать запись
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
      console.log('[Speech] Recording started');
    } catch (err) {
      console.error('[Speech] Failed to start recording:', err);
    }
  };

  // Остановить запись и распознать
  const stopRecordingAndTranscribe = async () => {
    if (!isRecording || !mediaRecorderRef.current) return;

    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);

        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          chunksRef.current = [];

          // Останавливаем все треки
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }

          console.log('[Speech] Recording stopped, transcribing...');

          // Декодируем и распознаём
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
          console.log('[Speech] Transcription result:', text);
        } catch (err) {
          console.error('[Speech] Transcription error:', err);
        } finally {
          setIsTranscribing(false);
          mediaRecorderRef.current = null;
          resolve();
        }
      };

      recorder.stop();
    });
  };

  // Прервать запись (без распознавания)
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
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

  // Toggle: запись/остановка
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
    toggleRecording,
    cancelRecording,
  };
}

// ================================================================
// Компонент кнопки звонка
// ================================================================
const CallButton = () => {
  const {
    isModelReady,
    isRecording,
    isTranscribing,
    toggleRecording,
    cancelRecording,
  } = useSpeechRecognition();

  const handleClick = () => {
    toggleRecording();
  };

  const label = isRecording ? '⏹' : '🔊';

  return (
    <StyledCallButton
      isRecording={isRecording}
      isModelReady={isModelReady}
      onClick={handleClick}
      disabled={!isModelReady || isTranscribing}
      title={isRecording ? 'Stop recording' : 'Start voice recording'}
    >
      <IconPhone size={18} />
      {isRecording && (
        <span style={{ marginLeft: 4 }}>
          {Math.round((Date.now() / 1000) % 60)}s
        </span>
      )}
    </StyledCallButton>
  );
};

// ================================================================
// Модифицированный PageCardHeader
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
