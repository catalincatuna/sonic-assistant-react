// Function to convert blob to base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
        const base64Data = reader.result.split(",")[1];
        resolve(base64Data);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Function to get session token from server
export const getSessionToken = async (): Promise<string> => {
  try {
    const response = await fetch("/session");
    if (!response.ok) {
      throw new Error("Failed to get session token");
    }
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error("Error getting session token:", error);
    throw error;
  }
};

// Function to send audio to OpenAI API using server-side session
export const sendAudioToOpenAIWithSession = async (
  audioBlobInput: Blob
): Promise<{ text: string; audioUrl: string }> => {
  try {
    const base64Audio = await blobToBase64(audioBlobInput);
    const sessionToken = await getSessionToken();

    const response = await fetch(
      "https://api.openai.com/v1/audio/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "Esti un asistent care raspunde la intrebari legate de proprietatea urmatoare: The Episode - Jacuzzi Penthouses se află în Cluj-Napoca, la 15 minute de mers pe jos de EXPO Transilvania, și oferă WiFi gratuit, o terasă și parcare privată gratuită. Proprietatea se află la 3,3 km de Muzeul Etnografic al Transilvaniei și include vedere la oraș și la piscină.Acest apartament cu aer condiționat are 1 dormitor, un living, o bucătărie complet utilată, cu frigider și cafetieră, precum și 1 baie cu bideu și duș. Baia este dotată cu cadă cu hidromasaj și articole de toaletă gratuite. Există de asemenea prosoape și lenjerie de pat.Acest apartament oferă o cadă cu hidromasaj. The Episode - Jacuzzi Penthouses oferă un grătar.The Episode - Jacuzzi Penthouses se află la 3,8 km de Palatul Bánffy și la 4,8 km de Cluj Arena. Aeroportul Internaţional Avram Iancu Cluj se află la 4 km.Cuplurile apreciază în mod deosebit această locație. I-au dat scorul 9,8 pentru un sejur pentru 2 persoane.",
            },
            {
              role: "user",
              content: [
                {
                  type: "audio",
                  audio: base64Audio,
                },
              ],
            },
          ],
          response_format: { type: "text_and_audio" },
          audio: { format: "mp3" },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || "Failed to get response from OpenAI"
      );
    }

    const data = await response.json();

    // Extract text from the response
    let assistantMessage = "Sorry, I could not understand that.";

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const messageContent = data.choices[0].message.content;

      if (Array.isArray(messageContent)) {
        // Find the text content if it's an array
        const textItem = messageContent.find(
          (item: any) => item.type === "text"
        );
        if (textItem) {
          assistantMessage = textItem.text;
        }
      } else if (typeof messageContent === "string") {
        // If it's directly a string
        assistantMessage = messageContent;
      }
    }

    // Get the audio content
    let audioContent;

    if (data.audio) {
      audioContent = data.audio;
    } else if (
      data.choices &&
      data.choices[0]?.message?.content?.find(
        (item: any) => item.type === "audio"
      )
    ) {
      audioContent = data.choices[0].message.content.find(
        (item: any) => item.type === "audio"
      ).audio;
    }

    if (!audioContent) {
      throw new Error("No audio content in response");
    }

    // Create a blob URL for the audio
    const audioBytes = Uint8Array.from(atob(audioContent), (c) =>
      c.charCodeAt(0)
    );
    const responseAudioBlob = new Blob([audioBytes], { type: "audio/mp3" });
    const audioUrl = URL.createObjectURL(responseAudioBlob);

    return {
      text: assistantMessage,
      audioUrl,
    };
  } catch (error: any) {
    console.error("Error sending audio to OpenAI:", error);
    throw error;
  }
};
