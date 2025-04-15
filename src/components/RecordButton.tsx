
import React from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface RecordButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  toggleRecording: () => void;
}

const RecordButton: React.FC<RecordButtonProps> = ({ 
  isRecording, 
  isProcessing, 
  toggleRecording 
}) => {
  return (
    <div className="relative">
      {isRecording && (
        <div className="absolute inset-0 bg-red-500 rounded-full animate-[pulse-ring_1.25s_cubic-bezier(0.215,0.61,0.355,1)_infinite]"></div>
      )}
      
      <button
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`relative flex items-center justify-center w-16 h-16 rounded-full shadow-md transition-colors ${
          isRecording 
            ? 'bg-red-500 text-white' 
            : 'bg-white text-gray-700 hover:bg-gray-100'
        } disabled:opacity-50`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isProcessing ? (
          <Loader2 className="w-8 h-8 animate-spin" />
        ) : isRecording ? (
          <MicOff className="w-8 h-8" />
        ) : (
          <Mic className="w-8 h-8" />
        )}
      </button>
    </div>
  );
};

export default RecordButton;
