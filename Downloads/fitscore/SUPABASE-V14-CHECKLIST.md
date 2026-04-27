# Supabase setup for v14 — do these once, takes 2 minutes

## 1. Enable leaked password protection (FREE)
- Go to: Authentication → Providers → Email → "Password security"
- Toggle ON: **"Prevent use of leaked passwords"** (HaveIBeenPwned)
- Save

## 2. Enforce email confirmation (already on by default — verify)
- Go to: Authentication → Sign In / Up → Email Auth
- Verify ON: **"Confirm email"**
- Save

## 3. Set minimum password length to 8 chars
- Go to: Authentication → Sign In / Up → Email Auth
- Set: **Minimum password length: 8**
- Save

## 4. (Optional) Add hCaptcha to sign-up
- Go to: Authentication → Attack Protection → Captcha
- Get free hCaptcha keys at https://www.hcaptcha.com (1 minute)
- Paste site key + secret
- Save
