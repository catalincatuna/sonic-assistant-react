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

const config = {
  apiBaseUrl: "http://localhost:3000",
  endpoints: {
    session: "/session",
  },
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

// Function to initialize realtime session with OpenAI
export const initializeRealtimeSession = async (): Promise<{
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
}> => {
  try {
    // Get session token
    const tokenResponse = await fetch(
      `${config.apiBaseUrl}${config.endpoints.session}`
    );
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    // Create peer connection
    const pc = new RTCPeerConnection();

    // Get audio stream and add it to the connection
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    audioStream.getTracks().forEach((track) => {
      pc.addTrack(track, audioStream);
    });

    // Set up audio handling for incoming audio
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    pc.ontrack = (e) => (audioEl.srcObject = e.streams[0]);

    // Create and set local description
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
    });
    await pc.setLocalDescription(offer);

    // Initialize session with OpenAI
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

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    } as RTCSessionDescriptionInit;
    await pc.setRemoteDescription(answer);

    // Create data channel after connection is established
    const dc = pc.createDataChannel("oai-events");
    dc.addEventListener("message", (e) => {
      console.log("Data channel message:", e.data);
    });

    return { pc, dc };
  } catch (error) {
    console.error("Error initializing realtime session:", error);
    throw error;
  }
};
