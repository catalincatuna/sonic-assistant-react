import { getSession } from "../services/RestCalls";

const API_BASE_URL = "http://localhost:3000";

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

// Function to initialize realtime session with OpenAI
export const initializeRealtimeSession = async (
  onMessage?: (event: MessageEvent) => void
): Promise<{
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  ws: WebSocket;
}> => {
  try {
    // Get session token
    const data = await getSession();
    const EPHEMERAL_KEY = data.client_secret.value;

    const url = "wss://api.openai.com/v1/realtime?intent=transcription";

    // Create WebSocket connection using browser's native WebSocket
    const ws = new WebSocket(url);

    // Wait for WebSocket to open
    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        console.log("WebSocket connected to server");
        // Send authentication headers after connection is established
        ws.send(
          JSON.stringify({
            type: "auth",
            token: EPHEMERAL_KEY,
            headers: {
              "OpenAI-Beta": "realtime=v1",
            },
          })
        );
        resolve(true);
      };
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      };
    });

    // Create peer connection
    const pc = new RTCPeerConnection();

    // Set up audio handling for incoming audio
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    pc.ontrack = (e) => {
      console.log("Received audio track:", e);
      audioEl.srcObject = e.streams[0];
    };

    // Get audio stream and add it to the connection
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    audioStream.getTracks().forEach((track) => {
      pc.addTrack(track, audioStream);
    });

    // Create data channel after connection is established
    const dc = pc.createDataChannel("oai-events", {
      ordered: true,
    });

    if (onMessage) {
      console.log("Adding message handler to data channel");
      dc.addEventListener("message", onMessage);
    } else {
      console.log("No message handler provided for data channel");
    }
    // Set up WebSocket message handler
    if (onMessage) {
      ws.onmessage = (event) => {
        console.log("WebSocket message received:", event.data);
        onMessage(event);
      };
    }

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

    return { pc, dc, ws };
  } catch (error) {
    console.error("Error initializing realtime session:", error);
    throw error;
  }
};

// Function to initialize realtime session with local server
export const initializeLocalRealtimeSession = async (
  onMessage?: (event: MessageEvent) => void
): Promise<{
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  ws: WebSocket;
}> => {
  try {
    // Create peer connection
    const pc = new RTCPeerConnection();

    // Set up audio handling for incoming audio
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    pc.ontrack = (e) => {
      console.log("Received audio track:", e);
      audioEl.srcObject = e.streams[0];
    };

    // Get audio stream and add it to the connection
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    audioStream.getTracks().forEach((track) => {
      pc.addTrack(track, audioStream);
    });

    // Create data channel
    const dc = pc.createDataChannel("local-events", {
      ordered: true,
    });

    // Set up message handler for data channel
    if (onMessage) {
      dc.onmessage = (event) => {
        console.log("Data channel message received:", event.data);
        onMessage(event);
      };
    }

    // Create and set local description
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
    });
    await pc.setLocalDescription(offer);

    // Send offer to local server via HTTP
    const response = await fetch("http://192.168.1.131:3000/start-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "offer",
        sdp: offer.sdp,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send offer: ${response.statusText}`);
    }

    const answer = await response.json();
    if (answer.type !== "answer") {
      throw new Error("Invalid answer received from server");
    }

    await pc.setRemoteDescription(new RTCSessionDescription(answer));

    // Return the connection objects
    return {
      pc,
      dc,
      ws: null as unknown as WebSocket, // Keep the same return type but return null for ws
    };
  } catch (error) {
    console.error("Error initializing local realtime session:", error);
    throw error;
  }
};

export const getVision = async (imageData: {
  image_url: string;
  prompt: string;
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/vision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        image: imageData.image_url,
        prompt: imageData.prompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Vision API error response:", errorText);
      throw new Error(`Failed to process image: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
};
