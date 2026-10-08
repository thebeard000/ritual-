# Ritual API configuration

Ritual does not require an API key today.

When an API is introduced:
- Public/client configuration may be exposed to the app.
- Private/server credentials must stay behind a server or secure backend.
- Never commit real API keys to Git, GitHub Pages, `.env` files, or the APK.
- Use CI/CD secrets for private server-side configuration.

See `.env.example` for placeholders. No real credentials are included.
