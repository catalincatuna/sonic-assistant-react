
import React from 'react';

interface ChatMessageProps {
  text: string;
  isUser: boolean;
  timestamp: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ text, isUser, timestamp }) => {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser 
          ? 'bg-gray-200 text-gray-800 rounded-tr-none' 
          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
      }`}>
        <p className="text-sm sm:text-base">{text}</p>
        <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {timestamp}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
