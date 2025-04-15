
export interface RecorderState {
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
  audioBlob: Blob | null;
  isRecording: boolean;
}

export const initializeRecorder = async (): Promise<MediaRecorder> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const options = { mimeType: 'audio/webm' };
    return new MediaRecorder(stream, options);
  } catch (error) {
    console.error('Error initializing recorder:', error);
    throw error;
  }
};

export const startRecording = (
  mediaRecorder: MediaRecorder | null,
  setAudioChunks: React.Dispatch<React.SetStateAction<Blob[]>>
): void => {
  if (!mediaRecorder) return;

  // Reset audio chunks
  setAudioChunks([]);

  // Start recording
  mediaRecorder.start();

  // Handle data available event
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      setAudioChunks((currentChunks) => [...currentChunks, event.data]);
    }
  };
};

export const stopRecording = (
  mediaRecorder: MediaRecorder | null
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      reject(new Error('MediaRecorder is not recording'));
      return;
    }

    let recordedChunks: Blob[] = [];

    const originalDataHandler = mediaRecorder.ondataavailable;
    
    // Set up new data handler to capture final chunk
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    // Set up onstop handler to resolve the promise
    mediaRecorder.onstop = () => {
      // Restore original data handler
      mediaRecorder.ondataavailable = originalDataHandler;
      
      // Create a single blob from all chunks
      const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      resolve(audioBlob);
    };

    // Stop recording
    mediaRecorder.stop();
  });
};
