
import React from 'react';

const AudioWaveform = () => {
  return (
    <div className="flex items-center justify-center h-12 gap-1 my-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 h-8 bg-red-500 rounded-full"
          style={{
            animation: `wave 0.5s ease-in-out infinite`,
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  );
};

export default AudioWaveform;
