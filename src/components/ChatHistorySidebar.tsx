import React, { useState } from 'react';
import { ChatSession } from '../services/ChatHistory';
import { chatHistoryService } from '../services/ChatHistory';

interface ChatHistorySidebarProps {
    onSelectSession: (session: ChatSession) => void;
    onNewChat: () => void;
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({ onSelectSession, onNewChat }) => {
    const [sessions, setSessions] = useState<ChatSession[]>(chatHistoryService.getSessions());
    const [isOpen, setIsOpen] = useState(true);

    const formatDate = (timestamp: string) => {
        return new Date(timestamp).toLocaleString();
    };

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div
            className={`h-screen bg-gray-50 text-gray-800 transition-all duration-300 ease-in-out relative ${isOpen ? 'w-64' : 'w-12'
                }`}
        >
            <button
                onClick={toggleSidebar}
                className={`absolute right-0 top-1/2 -translate-y-1/2 p-2 bg-white rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center shadow-sm z-10 ${isOpen ? '' : 'rotate-180'
                    }`}
                title={isOpen ? "Hide History" : "Show History"}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
            </button>

            <div className={`h-full transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                <div className="p-4 overflow-y-auto h-screen pt-20">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-800">Chat History</h2>
                        <button
                            onClick={onNewChat}
                            className="p-2 text-gray-500 hover:text-gray-700 transition-colors bg-white rounded-full shadow-sm"
                            title="Start new chat"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    <div className="space-y-2">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                onClick={() => onSelectSession(session)}
                                className="p-3 bg-white rounded-lg cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                <div className="font-semibold truncate text-gray-800">{session.propertyName}</div>
                                <div className="text-sm text-gray-500">{formatDate(session.timestamp)}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                    {session.messages.length} messages
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatHistorySidebar; 