const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;

export const authenticateUser = async (username, password) => {
  try {
    const url = `${SCRIPT_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&_=${Date.now()}`;
    console.log("Calling login endpoint:", SCRIPT_URL);

    const response = await fetch(url, { cache: "no-store" });

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (!response.ok) {
      throw new Error(`Authentication failed: HTTP ${response.status}`);
    }

    const text = await response.text();
    console.log("Raw response:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      throw new Error(`Server returned invalid JSON: ${text.substring(0, 100)}`);
    }

    console.log("Parsed data:", data);

    if (!data.success) {
      throw new Error(data.error || "Invalid credentials");
    }

    if (!data.user) {
      throw new Error("Invalid data format from server");
    }

    // Return user data from login response
    const user = data.user;

    // Parse page access if it's a comma-separated string
    const accessList = user.page && typeof user.page === 'string'
      ? user.page.split(",").map(item => item.trim()).filter(Boolean)
      : user.page ? [user.page] : [];

    return {
      id: user.id || user.username,
      name: user.name || user.username,
      username: user.username,
      role: user.role || "",
      access: accessList.length > 0 ? accessList : ["Dashboard"],
      firmName: user.firmName || "",
      manual: user.manual || "",
    };
  } catch (error) {
    console.error("Authentication error:", error);
    throw error;
  }
};
