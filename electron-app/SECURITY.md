# RTool Security Documentation

## Overview

RTool has been hardened with multiple security measures to minimize attack surface while maintaining its functionality as a red-teaming tool.

## Implemented Security Measures

### 1. Content Security Policy (CSP)
**Location**: `index.html`

Strict CSP prevents loading external resources:
```
default-src 'self'; 
script-src 'self'; 
style-src 'self' 'unsafe-inline'; 
img-src 'self' data:; 
connect-src 'self'; 
font-src 'self'; 
object-src 'none'; 
media-src 'self'; 
frame-src 'none';
```

### 2. Renderer Sandboxing
**Location**: `main.js`

- `sandbox: true` - Isolates renderer process from system
- `contextIsolation: true` - Separates Electron/Node from web content
- `nodeIntegration: false` - No Node.js APIs in renderer
- `enableRemoteModule: false` - Remote module explicitly disabled
- `allowRunningInsecureContent: false` - Blocks mixed content

### 3. Remote Module Protection
**Location**: `main.js`

All remote module access points are blocked:
- `remote-require`
- `remote-get-builtin`
- `remote-get-global`
- `remote-get-current-window`
- `remote-get-current-web-contents`

### 4. Permission Handlers
**Location**: `main.js`

Granular permission control for webviews:
- ✅ **Allowed**: `notifications` only
- ❌ **Blocked**: Camera, microphone, geolocation, MIDI, etc.

All permission requests are logged for audit.

### 5. Protocol Security
**Location**: `main.js`

Dangerous protocols are blocked:
- `file://` - Prevents local file system access
- Other non-HTTP(S) protocols rejected

### 6. URL Validation
**Location**: `renderer.js`

All URLs are validated before loading:
- ✅ Must be HTTP or HTTPS
- ❌ Blocked patterns:
  - `file://` - Local file access
  - `localhost` - Local servers
  - `127.0.0.1` / `0.0.0.0` - Loopback addresses
  - `javascript:` - JavaScript protocol injection
  - `data:` - Data URL injection
  - `vbscript:` - VBScript injection

HTTP URLs trigger security warnings (prefer HTTPS).

### 7. Prompt Handling (No Sanitization)
**Location**: `renderer.js`

⚠️ **Prompts are NOT sanitized** - This is intentional for red-teaming purposes.

RTool is designed to send ANY prompt content to target LLMs, including:
- Injection attempts
- Obfuscated content
- Malicious-looking patterns
- Special characters and encodings

**Why no sanitization?**
- Red-teaming requires testing how LLMs respond to adversarial inputs
- Parseltongue transforms often produce suspicious-looking output
- Sanitization would defeat the tool's core purpose

**Safety mechanisms:**
- Prompts only go to user-specified websites (validated URLs)
- All injection happens in isolated webviews
- No access to local file system or Node.js APIs
- User explicitly controls what gets sent and where

### 8. Webview Isolation
**Location**: `renderer.js`

Each webview has security attributes:
- `disablewebsecurity='false'` - Web security enabled
- `allowpopups='false'` - Popups blocked
- `nodeintegration='false'` - No Node.js in webviews
- `nodeintegrationinsubframes='false'` - No Node.js in subframes
- `contextIsolation=yes` - Context isolation enabled
- `partition='persist:instanceN'` - Isolated sessions per instance

## Security Logging

All security events are logged to the console:
- `[SECURITY]` - Security decisions (allowed/blocked)
- `[SECURITY] Warning:` - Potential security issues
- URL validation failures
- Permission requests
- Suspicious prompt patterns

## Remaining Risks

### Inherent to Tool Purpose

1. **User-loaded content** - Users can load any HTTPS website
2. **Prompt obfuscation** - Red-teaming requires sending potentially malicious-looking text
3. **`executeJavaScript`** - Required for prompt injection functionality

### Mitigations

- All loaded sites run in isolated webviews
- No access to local file system or Node.js APIs
- Prompt injection uses explicit DOM manipulation (no eval)
- Each instance has separate session/cookies
- All actions are logged for audit

## Best Practices for Users

1. ✅ **DO**: Use HTTPS URLs whenever possible
2. ✅ **DO**: Review console logs for security warnings
3. ✅ **DO**: Keep Electron updated (check releases)
4. ❌ **DON'T**: Load untrusted local files
5. ❌ **DON'T**: Paste untrusted JavaScript into the prompt field
6. ❌ **DON'T**: Load websites on untrusted networks without VPN

## Updating Electron

To update Electron for security patches:

```bash
npm update electron
npm audit
npm audit fix
```

Check current version:
```bash
npx electron --version
```

Current version: `^38.3.0`

## Reporting Security Issues

If you discover a security vulnerability:
1. Do not open a public issue
2. Document the vulnerability with reproduction steps
3. Contact the maintainer privately
4. Allow time for patch before public disclosure

## Security Audit Log

- **2025-10-17**: Initial security hardening implemented
  - CSP added
  - Sandboxing enabled
  - URL validation added
  - Permission handlers configured
  - Remote module blocked
  - Webview isolation configured
- **2025-10-17**: Prompt sanitization deliberately removed
  - Red-teaming tool requires ability to send ANY prompt
  - Prompts now pass through unmodified to target LLMs
  - Safety maintained via URL validation and webview isolation

## Compliance

RTool is designed for:
- ✅ Security research
- ✅ AI red-teaming
- ✅ Prompt injection testing
- ✅ Internal testing environments

RTool is NOT designed for:
- ❌ Production deployments
- ❌ Handling sensitive user data
- ❌ Public-facing services
- ❌ Compliance-critical environments

Use at your own risk in authorized testing environments only.

