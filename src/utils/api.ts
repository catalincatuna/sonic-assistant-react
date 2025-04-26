import { getCurrentSessionId, getSession } from "../services/RestCalls";

// const API_BASE_URL = "http://192.168.1.131:3000";
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
    audioEl.controls = true; // Add controls for debugging
    document.body.appendChild(audioEl); // Add to document for testing

    pc.ontrack = (event) => {
      console.log("Received track:", event.track.kind);
      if (event.track.kind === "audio") {
        console.log("Setting audio source");
        audioEl.srcObject = event.streams[0];
        // Play the audio
        audioEl.play().catch((error) => {
          console.error("Error playing audio:", error);
        });
      }
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

    // Create data channel
    const dc = pc.createDataChannel("local-events", {
      ordered: true,
    });

    // Set up audio handling for incoming audio
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.controls = true; // Add controls for debugging
    document.body.appendChild(audioEl); // Add to document for testing

    pc.ontrack = (event) => {
      console.log("Received track:", event.track.kind);
      if (event.track.kind === "audio") {
        console.log("Setting audio source");
        audioEl.srcObject = event.streams[0];
        // Play the audio
        audioEl.play().catch((error) => {
          console.error("Error playing audio:", error);
        });
      }
    };

    pc.ondatachannel = (event) => {
      const dcc = event.channel; // This is the data channel created by the server
      console.log("Received data channel:", dcc.label);
    };

    // Get audio stream and add it to the connection
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    audioStream.getTracks().forEach((track) => {
      pc.addTrack(track, audioStream);
    });

    /// add listeners

    // Set up message handler for data channel
    if (onMessage) {
      console.log("Adding message handler to data channel");
      dc.addEventListener("message", (event) => {
        console.log("Data channel message received:", event.data);
      });

      // dc.onmessage = (event) => {
      //   console.log("Data channel message received:", event.data);
      //   onMessage(event);
      // };
    }

    // Set up data channel open handler
    dc.onopen = () => {
      console.log("Data channel opened");
      // Send test message
      const testMessage = {
        type: "test",
        message: "Hello from client! Local session initialized successfully.",
        timestamp: new Date().toISOString(),
      };
      dc.send(JSON.stringify(testMessage));
      console.log("Sent test message:", testMessage);
    };

    // Set up connection state handling
    pc.onconnectionstatechange = () => {
      console.log("Connection state changed:", pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state changed:", pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log("Signaling state changed:", pc.signalingState);
    };

    // Create and set local description
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
    });
    await pc.setLocalDescription(offer);

    console.log("session id is :" + getCurrentSessionId());

    // Send offer to local server via HTTP
    const response = await fetch(`${API_BASE_URL}/start-local-stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sdp: offer.sdp,
        type: "offer",
        sessionId: getCurrentSessionId(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send offer: ${response.statusText}`);
    }

    // Get the raw response text first
    const responseText = await response.text();

    // Parse the JSON response
    const answerData = JSON.parse(responseText);

    // Ensure we have a valid SDP string
    if (answerData.answer) {
      // If the response is already an SDP string
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: answerData.answer.sdp,
      };
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } else if (typeof answerData === "object" && answerData.sdp) {
      // If the response is a JSON object with an sdp field
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: answerData.sdp,
      };
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } else {
      throw new Error("Invalid SDP format received from server");
    }

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
