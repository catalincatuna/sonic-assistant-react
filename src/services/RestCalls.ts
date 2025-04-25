import { PropertyInfo } from "../components/IntroPage";

// const API_BASE_URL = "http://localhost:3000";
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

// Generate a unique session ID
const generateSessionId = (): string => {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Store sessionId in memory
const currentSessionId: string = generateSessionId();

export const saveProperty = async (propertyInfo: PropertyInfo) => {
  try {
    const response = await fetch(`${API_BASE_URL}/property`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Name: propertyInfo.name,
        Location: propertyInfo.address,
        Description: propertyInfo.description,
        sessionId: currentSessionId
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error saving property:", error);
    throw error;
  }
};

export const getSession = async () => {
  try {
    const url = new URL(`${API_BASE_URL}/session`);
    url.searchParams.append('sessionId', currentSessionId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting session:", error);
    throw error;
  }
};

// Function to get the current session ID
export const getCurrentSessionId = (): string => {
  return currentSessionId;
};
