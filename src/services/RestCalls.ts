import { PropertyInfo } from "../components/IntroPage";

// const API_BASE_URL = "http://localhost:3000";
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";


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
    const response = await fetch(`${API_BASE_URL}/session`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error getting session:", error);
    throw error;
  }
};
