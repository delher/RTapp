# Google Sheets Webhook Setup Guide

Simple setup for logging RTool data to Google Sheets - **No OAuth, No API Keys!**

---

## For Sheet Administrators

If you're managing the shared Google Sheet that multiple users will log to, follow these steps **once**:

### Step 1: Open Your Google Sheet

1. Go to your Google Sheet where you want logs to appear
2. Create a new tab/sheet called **"RTool Logs"** (or any name you prefer)

### Step 2: Add Apps Script

1. Click **Extensions** → **Apps Script**
2. Delete any existing code
3. Paste this code:

```javascript
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RTool Logs');
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      const newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('RTool Logs');
      newSheet.appendRow(['Timestamp', 'Window ID', 'Site URL', 'Transform', 'Prompt', 'Response']);
      return ContentService.createTextOutput(JSON.stringify({success: true}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      data.timestamp,
      data.windowId,
      data.siteUrl,
      data.transform,
      data.prompt,
      data.response
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, 
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Click **Save** (💾 icon) and name it "RTool Logger"

### Step 3: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **"Web app"**
4. Configure:
   - **Description**: RTool Webhook
   - **Execute as**: **Me** (your account)
   - **Who has access**: **Anyone** (important!)
5. Click **Deploy**
6. You may need to authorize:
   - Click **Authorize access**
   - Choose your Google account
   - Click **Advanced** → **Go to RTool Logger (unsafe)** (it's safe, it's your script!)
   - Click **Allow**
7. Copy the **Web app URL** - it looks like:
   ```
   https://script.google.com/macros/s/AKfycby...ABC123/exec
   ```

### Step 4: Share the Webhook URL

Send this URL to all users who will use RTool. They'll paste it into their RTool settings.

**⚠️ Security Note**: Anyone with this URL can append rows to your sheet. Keep it private among your team.

---

## For RTool Users

If someone gave you a webhook URL, here's how to set it up:

### Step 1: Install RTool Extension

1. Load the `chrome-extension` folder into Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the folder

### Step 2: Configure RTool

1. Click the RTool extension icon
2. Expand **"📊 Logging Setup"**
3. Paste the webhook URL you received
4. Click **"💾 Save Settings"**
5. Click **"🧪 Test Connection"** to verify it works
6. Check the box **"Enable automatic logging"**

### Step 3: Start Using!

Now whenever you send prompts:
- They'll automatically be logged to the shared Google Sheet
- You'll see timestamp, window, URL, transform, and prompt
- All users log to the same sheet for easy tracking

---

## What Gets Logged

Each prompt creates one row per window:

| Timestamp | Window ID | Site URL | Transform | Prompt | Response |
|-----------|-----------|----------|-----------|--------|----------|
| 2025-10-17T14:30:00.000Z | 123456 | https://chatgpt.com | encoding:base64 | SGVsbG8gd29ybGQ= | (pending) |
| 2025-10-17T14:30:00.000Z | 123457 | https://chatgpt.com | ciphers:rot13 | Uryyb jbeyq | (pending) |

- **Timestamp**: When the prompt was sent (ISO 8601 format)
- **Window ID**: Chrome window identifier
- **Site URL**: The website the prompt was sent to
- **Transform**: The Parseltongue transform applied (category:method)
- **Prompt**: The actual text sent (after transformation)
- **Response**: Placeholder for future response capture

---

## Troubleshooting

### "Test failed: Failed to fetch"
- Check that the webhook URL is correct
- Make sure it starts with `https://script.google.com/macros/s/`
- Verify the URL ends with `/exec`

### "Test failed: 403 Forbidden"
- Sheet admin: Make sure deployment is set to **"Anyone"** can access
- Re-deploy the web app if you changed the setting

### "Test failed: Script error"
- Sheet admin: Check the Apps Script for typos
- Make sure the sheet name in the script matches your actual sheet name
- Check Apps Script execution logs: **Extensions** → **Apps Script** → **Executions**

### No rows appearing in sheet
- Make sure logging is **enabled** in RTool (checkbox checked)
- Click "Test Connection" to verify webhook works
- Check that the sheet tab name matches the script

### Duplicate entries
- This is normal - one entry per window
- If you have 3 windows open, you'll get 3 rows per prompt

---

## Advanced: Customizing the Sheet

### Change the Sheet Name

In the Apps Script, change `'RTool Logs'` to your desired name:
```javascript
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Your Name Here');
```

### Add Additional Fields

Modify the `appendRow` call to include more data:
```javascript
sheet.appendRow([
  data.timestamp,
  data.windowId,
  data.siteUrl,
  data.transform,
  data.prompt,
  data.response,
  data.yourCustomField  // Add new fields here
]);
```

### Add Data Validation

1. Select a column (e.g., Column D for Transform)
2. **Data** → **Data validation**
3. Set criteria (e.g., dropdown list of allowed values)
4. This won't stop logging but will flag invalid entries

### Protect the Headers

1. Select row 1 (the header row)
2. **Data** → **Protect sheets and ranges**
3. Set permissions to protect it from accidental edits

---

## Privacy & Security

- ✅ **Your script runs under YOUR Google account** - you control everything
- ✅ **Data stays in YOUR spreadsheet** - not sent anywhere else
- ✅ **Only people with the webhook URL** can append data
- ✅ **Users cannot read existing data** through the webhook
- ✅ **You can revoke access** anytime by deploying a new version

### Revoking Access

If you need to revoke the webhook:
1. **Apps Script** → **Deploy** → **Manage deployments**
2. Click the deployment → **Archive**
3. Create a new deployment with a new URL
4. Share the new URL with authorized users only

---

## Multiple Teams / Projects

You can create multiple webhooks for different sheets:
- Create separate Google Sheets for each team
- Each sheet has its own Apps Script with its own webhook URL
- Users paste the appropriate webhook URL for their team

---

## Need Help?

- Check the Apps Script execution logs: **Extensions** → **Apps Script** → **Executions**
- Test the webhook using curl or Postman
- Check browser console for errors
- Verify the sheet permissions allow your script to write

---

## Example: Testing with curl

```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2025-10-17T14:30:00.000Z",
    "windowId": "TEST",
    "siteUrl": "https://example.com",
    "transform": "none",
    "prompt": "Test prompt",
    "response": "Test response"
  }'
```

Should return: `{"success":true}`





