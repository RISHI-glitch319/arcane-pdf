import { API_BASE } from "@/config/api";
// src/utils/analytics.ts
import axios from 'axios';

export const reportArcaneUsage = async (name: string, bytes: number = 0) => {
  try {
    await axios.post(`${API_BASE}/engine/pulse`, {
      tool_name: name,
      status: "success",
      size_bytes: bytes
    });
  } catch (err) {
    // We keep this quiet so it doesn't interrupt the user experience
    console.warn(`Telemetry Shard [${name}]: Pulse delivery failed.`);
  }
};
