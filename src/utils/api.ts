
// Function to convert blob to base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
        const base64Data = reader.result.split(',')[1];
        resolve(base64Data);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Function to send audio to OpenAI API
export const sendAudioToOpenAI = async (
  audioBlobInput: Blob,
  apiKey: string
): Promise<{ text: string; audioUrl: string }> => {
  try {
    const base64Audio = await blobToBase64(audioBlobInput);
    
    const response = await fetch('https://api.openai.com/v1/audio/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'audio',
                audio: base64Audio
              }
            ]
          }
        ],
        response_format: { type: 'text_and_audio' },
        audio: { format: 'mp3' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to get response from OpenAI');
    }

    const data = await response.json();
    
    // Extract text from the response
    let assistantMessage = 'Sorry, I could not understand that.';
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const messageContent = data.choices[0].message.content;
      
      if (Array.isArray(messageContent)) {
        // Find the text content if it's an array
        const textItem = messageContent.find((item: any) => item.type === 'text');
        if (textItem) {
          assistantMessage = textItem.text;
        }
      } else if (typeof messageContent === 'string') {
        // If it's directly a string
        assistantMessage = messageContent;
      }
    }
    
    // Get the audio content - it could be in different places depending on the API version
    let audioContent;
    
    if (data.audio) {
      // Newer API format may place it directly in "audio"
      audioContent = data.audio;
    } else if (data.choices && 
               data.choices[0]?.message?.content?.find((item: any) => item.type === 'audio')) {
      // Or it may be in the content array as a specific item
      audioContent = data.choices[0].message.content.find(
        (item: any) => item.type === 'audio'
      ).audio;
    }
    
    if (!audioContent) {
      throw new Error('No audio content in response');
    }
    
    // Create a blob URL for the audio
    const audioBytes = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));
    const responseAudioBlob = new Blob([audioBytes], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(responseAudioBlob);
    
    return {
      text: assistantMessage,
      audioUrl
    };
  } catch (error: any) {
    console.error('Error sending audio to OpenAI:', error);
    throw error;
  }
};
