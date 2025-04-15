
import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import RecordButton from '../components/RecordButton';
import MessageList, { Message } from '../components/MessageList';
import AudioWaveform from '../components/AudioWaveform';
import { initializeRecorder, startRecording, stopRecording } from '../utils/audioRecorder';
import { sendAudioToOpenAI } from '../utils/api';

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Welcome to GPT-4o Voice Assistant! Click the microphone button and speak to start a conversation.",
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Initialize the MediaRecorder when component mounts
  useEffect(() => {
    const initialize = async () => {
      try {
        const recorder = await initializeRecorder();
        mediaRecorderRef.current = recorder;
      } catch (error) {
        console.error('Failed to initialize recorder:', error);
        // Show error message to user
        addMessage('Failed to access microphone. Please check permissions and try again.', false);
      }
    };

    initialize();

    // Cleanup function to stop recording and release media stream
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // Release the media stream
      if (mediaRecorderRef.current) {
        const stream = mediaRecorderRef.current.stream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Format timestamp for messages
  const formatTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Add a message to the chat
  const addMessage = (text: string, isUser: boolean) => {
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        text,
        isUser,
        timestamp: formatTimestamp()
      }
    ]);
  };

  // Toggle recording state
  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      setIsProcessing(true);
      
      try {
        // Stop recording and get the audio blob
        const audioBlob = await stopRecording(mediaRecorderRef.current);
        
        // Check if we have an actual audio blob with content
        if (!audioBlob || audioBlob.size === 0) {
          throw new Error('No audio recorded');
        }
        
        // Check for API key
        if (!apiKey) {
          addMessage('Please enter your OpenAI API key in the field above to process audio.', false);
          setIsProcessing(false);
          return;
        }
        
        // Add user message with "Transcribing..." text
        const userMessageId = Date.now().toString();
        setMessages(prev => [
          ...prev, 
          {
            id: userMessageId,
            text: 'Transcribing...',
            isUser: true,
            timestamp: formatTimestamp()
          }
        ]);
        
        // Process the audio with OpenAI
        const response = await sendAudioToOpenAI(audioBlob, apiKey);
        
        // Extract the user's transcribed text
        let userText = response.text;
        if (response.text.includes(':')) {
          // If there's a colon, take the first part as the user's speech
          userText = response.text.split(':')[0].trim();
        }
        
        // Update the user message with transcribed text (replace "Transcribing...")
        setMessages(prev => 
          prev.map(msg => 
            msg.id === userMessageId 
              ? { ...msg, text: userText }
              : msg
          )
        );
        
        // Add assistant response
        addMessage(response.text, false);
        
        // Set the audio URL for playback
        setCurrentAudio(response.audioUrl);
        
        // Automatically play the response audio
        if (audioRef.current && response.audioUrl) {
          audioRef.current.src = response.audioUrl;
          audioRef.current.play().catch(e => {
            console.error('Audio playback error:', e);
            addMessage('Audio playback failed. Check your speakers or headphones.', false);
          });
        }
      } catch (error: any) {
        console.error('Error processing recording:', error);
        let errorMessage = 'Sorry, there was an error processing your voice. Please try again.';
        
        // Provide more specific error messages
        if (error.message.includes('API key')) {
          errorMessage = 'Invalid OpenAI API key. Please check your key and try again.';
        } else if (error.message.includes('No audio')) {
          errorMessage = 'No audio was captured. Please check your microphone and try again.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        }
        
        addMessage(errorMessage, false);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Before starting recording, check if microphone is available
      if (!mediaRecorderRef.current) {
        try {
          const recorder = await initializeRecorder();
          mediaRecorderRef.current = recorder;
        } catch (error) {
          console.error('Failed to initialize recorder:', error);
          addMessage('Failed to access microphone. Please check permissions and try again.', false);
          return;
        }
      }
      
      // Start recording
      setIsRecording(true);
      startRecording(mediaRecorderRef.current, setAudioChunks);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      
      {/* API Key Input */}
      <div className="px-4 pt-20 pb-2">
        <div className="relative">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your OpenAI API key"
            className="w-full p-2 border border-gray-300 rounded-md text-sm pr-24"
            disabled={isRecording || isProcessing}
          />
          {apiKey && (
            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
              Key Set
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Your API key is stored locally and never sent to our servers.
        </p>
      </div>
      
      {/* Messages Container */}
      <div className="flex-1 overflow-hidden mt-2 mb-24">
        <MessageList messages={messages} />
      </div>
      
      {/* Audio Element (hidden) */}
      <audio ref={audioRef} className="hidden" controls />
      
      {/* Recording UI */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex flex-col items-center">
        {isRecording && <AudioWaveform />}
        
        <div className="flex items-center justify-center w-full">
          <RecordButton 
            isRecording={isRecording} 
            isProcessing={isProcessing}
            toggleRecording={toggleRecording}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
