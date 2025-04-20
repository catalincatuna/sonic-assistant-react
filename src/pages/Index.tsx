import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import RecordButton from '../components/RecordButton';
import MessageList, { Message } from '../components/MessageList';
import AudioWaveform from '../components/AudioWaveform';
import IntroPage from '../components/IntroPage';
import { initializeRecorder, startRecording, stopRecording } from '../utils/audioRecorder';
import { initializeRealtimeSession } from '../utils/api';
import ChatHistorySidebar from '../components/ChatHistorySidebar';
import { chatHistoryService } from '../services/ChatHistory';
import { ChatSession } from '../services/ChatHistory';

interface PropertyInfo {
  name: string;
  address: string;
  description: string;
}


const Index = () => {
  const [propertyInfo, setPropertyInfo] = useState<PropertyInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Welcome to GPT-4o Voice Assistant! Click the microphone button to start a conversation.",
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [reservation, setReservation] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Format timestamp for messages
  const formatTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Add a message to the chat
  const addMessage = (text: string, isUser: boolean) => {
    const newMessage = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMessage]);
  };

  // Clean up function
  const cleanupConnection = () => {
    // Stop all media tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }

    setIsCallActive(false);
    setIsRecording(false);
    setIsProcessing(false);

    // Save chat history when conversation ends
    if (messages.length > 1) {
      // Create a new array with all messages except the initial welcome message
      const conversationMessages = messages.filter(msg => msg.id !== "welcome");
      if (conversationMessages.length > 0) {
        // Ensure we have a valid property name
        const propertyName = propertyInfo?.name || 'Unknown Property';

        // Save to chat history
        chatHistoryService.addSession(conversationMessages, propertyName);
      }
    }
  };

  // Function to send reservation data through data channel
  const sendReservationData = () => {
    try {


      let event = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `rezervare gasita
                       nume: Catalin Catuna
                       data: 18.04.2025`,
            }
          ]
        },
      };

      dcRef.current.send(JSON.stringify(event));
      console.log("Sent reservation data:", event);
      let response = {
        type: "response.create",
        response: {
          instructions: "te rog spune-i clientului ce rezervare ai gasit "
        },
      };

      // WebRTC data channel and WebSocket both have .send()
      dcRef.current.send(JSON.stringify(response));
      console.log("Sent response:", response);

    } catch (error) {
      console.error("Error sending reservation data:", error);
    }
  };

  // Message handler function
  const handleMessage = (event: MessageEvent) => {
    console.log("=== Message Event Received ===");

    try {
      const response = JSON.parse(event.data);
      console.log("Parsed response:", response);

      // Handle conversation end message
      if (response.type === "response.done") {
        if (response.response.output[0].type === "function_call") {
          console.log("Parsed response:", response);
          if (response.response.output[0].arguments == "{\"should_end\":true}") {
            let response = {
              type: "response.create",
              response: {
                instructions: "te rog ia ti ramas bun de la client "
              },
            };

            // WebRTC data channel and WebSocket both have .send()
            dcRef.current.send(JSON.stringify(response));

            console.log("Sent response:", response);
            console.log("Received conversation end signal");
            addMessage("Conversatie incheiata...", true);

            // Add 3 second delay before stopping
            setTimeout(() => {
              // Stop recording first
              if (isRecording) {
                setIsRecording(false);
                setIsProcessing(false);
              }

              // Then clean up the connection
              cleanupConnection();
            }, 4000);

            return;
          }
          else if (response.response.output[0].name === "get_reservation") {
            console.log("Received get_reservation function call");
            // Parse the arguments to get reservation data
            const args = JSON.parse(response.response.output[0].arguments);
            setReservation(args);
            addMessage("Rezervare gasita...", false);
            // Send the reservation data through the data channel
            sendReservationData();
          }
        }
      }

      // Handle user response
      if (response.type === "conversation.item.input_audio_transcription.completed") {
        console.log("Adding chatbot response to chat:", response.transcript);
        addMessage(response.transcript, true);
      }

      // Handle agent transcription
      if (response.type === "response.audio_transcript.done") {
        console.log("Adding user transcription to chat:", response.transcript);
        addMessage(response.transcript, false);
      }

      // Handle audio response
      if (response.audio) {
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      console.error('Raw data that failed to parse:', event.data);
    }
  };

  // Toggle recording state
  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      setIsProcessing(true);

      try {
        // Stop recording
        const audioBlob = await stopRecording(mediaRecorderRef.current);

        // Send audio through data channel if it's open
        if (dcRef.current && dcRef.current.readyState === 'open') {
          console.log("Sending audio through data channel");
          dcRef.current.send(audioBlob);
        } else {
          console.log("Data channel not ready, skipping audio send");
        }

        // Clean up resources
        cleanupConnection();
      } catch (error) {
        console.error('Error processing recording:', error);
        cleanupConnection();
      } finally {
        setIsProcessing(false);
      }
    } else {
      if (!isCallActive) {
        try {
          // Initialize realtime session with message handler
          const { pc, dc, ws } = await initializeRealtimeSession(handleMessage);

          // Set up connection state handling
          pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);
            if (pc.connectionState === 'disconnected' ||
              pc.connectionState === 'failed' ||
              pc.connectionState === 'closed') {
              cleanupConnection();
            }
          };

          // Set up data channel handling
          dc.onclose = () => {
            console.log('Data channel closed');
            cleanupConnection();
          };

          // Log data channel state changes
          dc.onopen = () => {
            console.log('Data channel opened in component');   
            // Send welcome message
            let response = {
              type: "response.create",
              response: {
                instructions: "te rog spune-i buna ziua clientului, unde a sunat si ce poti face pentru el"
              },
            };

            // WebRTC data channel and WebSocket both have .send()
            dcRef.current.send(JSON.stringify(response));
          };

          pcRef.current = pc;
          dcRef.current = dc;
          wsRef.current = ws;
          setIsCallActive(true);



          // Start recording after connection is established
          if (!mediaRecorderRef.current) {
            try {
              const { recorder, stream } = await initializeRecorder();
              mediaRecorderRef.current = recorder;
              mediaStreamRef.current = stream;
            } catch (error) {
              console.error('Failed to initialize recorder:', error);
              cleanupConnection();
              return;
            }
          }

          setIsRecording(true);
          startRecording(mediaRecorderRef.current, (chunks) => {
            // Handle audio chunks if needed
          });
        } catch (error) {
          console.error('Failed to initialize session:', error);
          cleanupConnection();
          return;
        }
      } else {
        // If call is already active, just start recording
        if (!mediaRecorderRef.current) {
          try {
            const { recorder, stream } = await initializeRecorder();
            mediaRecorderRef.current = recorder;
            mediaStreamRef.current = stream;
          } catch (error) {
            console.error('Failed to initialize recorder:', error);
            return;
          }
        }
        setIsRecording(true);
        startRecording(mediaRecorderRef.current, (chunks) => {
          // Handle audio chunks if needed
        });
      }
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, []);

  const handlePropertySubmit = (info: PropertyInfo) => {
    setPropertyInfo(info);
    // Add a welcome message with property info
    //addMessage(`Welcome to ${info.name}! How can I help you today?`, false);
  };

  // Add this function to handle session selection
  const handleSessionSelect = (session: ChatSession) => {
    setSelectedSession(session);
    setMessages(session.messages);
  };

  const handleDownloadConversation = () => {
    const sessions = chatHistoryService.getSessions();
    if (sessions.length > 0) {
      const logEntry = sessions.map(session => `
Property: ${session.propertyName}
Timestamp: ${new Date(session.timestamp).toLocaleString()}
Messages:
${session.messages
          .map(
            (msg) =>
              `[${msg.timestamp}] ${msg.isUser ? "User" : "Assistant"}: ${msg.text}`
          )
          .join("\n")}
----------------------------------------
`).join("\n\n");

      const blob = new Blob([logEntry], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation_history_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleNewChat = () => {
    // Reset the messages to just the welcome message
    setMessages([]);

    // Clean up any active connections
    cleanupConnection();
  };

  if (!propertyInfo) {
    return <IntroPage onPropertySubmit={handlePropertySubmit} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ChatHistorySidebar
        onSelectSession={handleSessionSelect}
        onNewChat={handleNewChat}
      />

      <div className="flex-1 flex flex-col min-h-screen">
        <Header />

        {/* Messages Container */}
        <div className="flex-1 overflow-hidden mt-20 mb-24 px-4 relative">
          <MessageList messages={messages} />

          {/* Action Buttons */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={handleDownloadConversation}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors bg-white rounded-full shadow-sm"
              title="Download conversation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => setMessages([{
                id: "welcome",
                text: "Welcome to GPT-4o Voice Assistant! Click the microphone button to start a conversation.",
                isUser: false,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }])}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors bg-white rounded-full shadow-sm"
              title="Clear chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Audio Elements (hidden) */}
        <audio ref={audioRef} className="hidden" controls />

        {/* Recording UI */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex flex-col items-center">
          {isRecording && <AudioWaveform />}

          <div className="flex items-center justify-center w-full gap-4">
            <RecordButton
              isRecording={isRecording}
              isProcessing={isProcessing}
              toggleRecording={toggleRecording}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
