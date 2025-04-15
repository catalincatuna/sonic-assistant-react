
import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

interface MessageListProps {
  messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <p className="text-center mb-2">No messages yet</p>
          <p className="text-center text-sm">Click the microphone to start a conversation</p>
        </div>
      ) : (
        messages.map((message) => (
          <ChatMessage
            key={message.id}
            text={message.text}
            isUser={message.isUser}
            timestamp={message.timestamp}
          />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
