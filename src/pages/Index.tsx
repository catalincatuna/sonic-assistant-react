import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import RecordButton from '../components/RecordButton';
import MessageList, { Message } from '../components/MessageList';
import AudioWaveform from '../components/AudioWaveform';
import { initializeRecorder, startRecording, stopRecording } from '../utils/audioRecorder';
import { sendAudioToOpenAIWithSession } from '../utils/api';

const config = {
  apiBaseUrl: 'http://localhost:3000',
  endpoints: {
    session: '/session'
  }
};

const SYSTEM_PROMPT =
  "Esti un asistent care raspunde la intrebari legate de proprietatea urmatoare: The Episode - Jacuzzi Penthouses se află în Cluj-Napoca, la 15 minute de mers pe jos de EXPO Transilvania, și oferă WiFi gratuit, o terasă și parcare privată gratuită. Proprietatea se află la 3,3 km de Muzeul Etnografic al Transilvaniei și include vedere la oraș și la piscină.Acest apartament cu aer condiționat are 1 dormitor, un living, o bucătărie complet utilată, cu frigider și cafetieră, precum și 1 baie cu bideu și duș. Baia este dotată cu cadă cu hidromasaj și articole de toaletă gratuite. Există de asemenea prosoape și lenjerie de pat.Acest apartament oferă o cadă cu hidromasaj. The Episode - Jacuzzi Penthouses oferă un grătar.The Episode - Jacuzzi Penthouses se află la 3,8 km de Palatul Bánffy și la 4,8 km de Cluj Arena. Aeroportul Internaţional Avram Iancu Cluj se află la 4 km.Cuplurile apreciază în mod deosebit această locație. I-au dat scorul 9,8 pentru un sejur pentru 2 persoane.";

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
  const [isCallActive, setIsCallActive] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recordedAudioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const initializeCall = async () => {
    try {
      // Get an ephemeral key from your server
      const tokenResponse = await fetch(`${config.apiBaseUrl}${config.endpoints.session}`);
      console.log("token is :" + tokenResponse);
      const data = await tokenResponse.json();
      const EPHEMERAL_KEY = data.client_secret.value;

      // Create a peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Set up to play remote audio from the model
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      pc.ontrack = e => audioEl.srcObject = e.streams[0];

      // Add local audio track for microphone input in the browser
      const ms = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      pc.addTrack(ms.getTracks()[0]);

      // Set up data channel for sending and receiving events
      const dc = pc.createDataChannel("oai-events");
      dc.addEventListener("message", (e) => {
        // Realtime server events appear here!
        console.log(e);
      });

      // Start the session using the Session Description Protocol (SDP)
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      });

      await pc.setRemoteDescription({ type: 'answer', sdp: await sdpResponse.text() });
      setIsCallActive(true);
      addMessage('Call started successfully!', false);
    } catch (error) {
      console.error('Failed to initialize call:', error);
      addMessage(`Failed to start call: ${error}`, false);
    }
  };

  const stopCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
      setIsCallActive(false);
      addMessage('Call ended.', false);
    }
  };

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

        // Create URL for the recorded audio
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(audioUrl);

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

        // Process the audio with OpenAI using session token
        const response = await sendAudioToOpenAIWithSession(audioBlob);

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
        if (error.message.includes('session')) {
          errorMessage = 'Failed to authenticate with the server. Please try again.';
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

      {/* Messages Container */}
      <div className="flex-1 overflow-hidden mt-20 mb-24 px-4">
        <MessageList messages={messages} />
      </div>
      
      {/* Audio Elements (hidden) */}
      <audio ref={audioRef} className="hidden" controls />
      <audio ref={recordedAudioRef} className="hidden" controls />
      
      {/* Recording UI */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex flex-col items-center">
        {isRecording && <AudioWaveform />}
        
        {recordedAudioUrl && !isRecording && (
          <div className="mb-4">
            <button
              onClick={() => {
                if (recordedAudioRef.current) {
                  recordedAudioRef.current.src = recordedAudioUrl;
                  recordedAudioRef.current.play().catch(e => {
                    console.error('Recorded audio playback error:', e);
                  });
                }
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Play Recording
            </button>
          </div>
        )}

        <div className="flex items-center justify-center w-full gap-4">
          {!isCallActive ? (
            <button
              onClick={initializeCall}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-gray-400 text-white rounded-md hover:from-green-600 hover:to-gray-500 transition-colors"
            >
              Start Realtime Session
            </button>
          ) : (
            <button
              onClick={stopCall}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              Stop Call
            </button>
          )}

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
