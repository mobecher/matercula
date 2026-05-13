import { betterAuth } from "better-auth";

// Better Auth is initialized for future expansion (email/password + magic links).
// Initial login flow for this scaffold is handled by local API routes under /api/auth.
export const auth = betterAuth({
  appName: "Lehrplan-Tagger",
  baseURL: process.env.AUTH_BASE_URL,
  secret: process.env.AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  magicLink: {
    enabled: true,
    sendMagicLink: async () => {
      return;
    },
  },
});
