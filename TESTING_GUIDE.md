# Quick Start: Testing Offline & Status Features

## 🚀 Start Your Servers

### Backend:
```bash
cd backend
npm install  # if needed
npm run dev
# Should see: Server running on http://localhost:3000
```

### Frontend:
```bash
cd frontend
npm install  # if needed
npm run dev
# Should see: http://localhost:5173
```

---

## 🧪 5-Minute Test

### **Step 1: Go Offline & Send Message**
1. Open http://localhost:5173 in browser
2. Open DevTools (F12) → Network tab
3. In Network tab, click dropdown that says "No throttling" → Select "Offline"
4. Click "Clear" to close DevTools
5. Send a message: Type and press Enter
6. **Expected:** 
   - ⏱️ Message shows clock icon (pending)
   - 🟡 Yellow offline banner appears at top: "Offline mode • Messages will be sent automatically when back online"
   - Message stays in chat (not lost)

### **Step 2: Go Back Online**
1. Open DevTools again → Network tab
2. Change from "Offline" to "No throttling"
3. **Expected:**
   - Message sends automatically 
   - Clock icon changes to ✓ (checkmark)
   - Console shows: "📤 Flushing 1 queued offline messages..."
   - Console shows: "✅ Queued message [...] sent successfully"

### **Step 3: Check Delivery Status (needs 2 browsers)**
1. Open chat in **Browser A** (logged in as User 1)
2. Open chat in **Browser B** (logged in as User 2)
3. **Browser A:** Send message to User 2
4. **Browser A:** Message shows ✓ (sent to server)
5. **Browser B:** Automatically receives message (Watch for message:new event)
6. **Browser A:** Message updates to ✓✓ (delivered)
7. **Browser B:** Open/click on the chat message to read it
8. **Browser A:** Message updates to ✓✓ (blue) = read

---

## 📱 Detailed Testing Scenarios

### **Scenario 1: Complete Offline Flow**

```
Step 1: User goes offline (DevTools: Network → Offline)
Step 2: User sends 3 messages
         Expected: All show ⏱️ clock icon
                   All queued in outbox

Step 3: User goes online (DevTools: Network → No throttling)
         Expected: All 3 messages send automatically
                   Status updates to ✓ then ✓✓

Step 4: Recipient reads the messages
         Expected: Sender sees ✓✓ (blue)
```

### **Scenario 2: Previous Messages Visible Offline**

```
Step 1: Load chat with history (while online)
Step 2: Go offline
Step 3: Scroll up to see old messages
         Expected: All messages still visible
                   No errors in console

Step 4: Go online
         Expected: Messages sync with latest status
```

### **Scenario 3: Network Interruption**

```
Step 1: Send message while online
Step 2: Immediately go offline before delivery
         Expected: Shows ✓ briefly, then might show ⏱️
                   Queued automatically

Step 3: Go online again
         Expected: Message sends and updates to ✓✓
```

### **Scenario 4: Browser Refresh While Offline**

```
Step 1: Go offline
Step 2: Send messages
Step 3: Refresh browser (Ctrl+R)
         Expected: Messages still visible!
                   Outbox queue restored
                   No data loss

Step 4: Go online
         Expected: Messages send automatically
```

---

## 🔍 Debugging - How to Check Everything

### **Check Outbox Queue (Console)**
```javascript
// In browser DevTools Console:
import { outboxManager } from './shared/lib/outboxManager'
console.log('Queue:', outboxManager.getQueue())
console.log('Queued count:', outboxManager.getQueuedCount())
console.log('Is online:', outboxManager.isOnline())
```

### **Check Local Cache (Console)**
```javascript
import { localCache } from './shared/lib/localCache'
const convId = 'paste_conversation_id_here'
console.log('Cached messages:', localCache.getMessages(convId))
console.log('Cached conversations:', localCache.getConversations())
```

### **Monitor All Socket Events**
```javascript
// In browser console, watch socket events:
const socket = getSocket()
socket.onAny((event, ...data) => {
  if (event.includes('message')) {
    console.log('📨 Socket:', event, data)
  }
})
```

### **Watch Network Activity**
1. DevTools → Network tab
2. Filter by "ws" to see WebSocket messages
3. Look for:
   - `message:send` - Message being sent
   - `message:ack` - Server acknowledged
   - `message:delivered` - Delivered to recipient
   - `message:read` - Message read by recipient

---

## ✅ Verification Checklist

- [ ] Offline mode banner appears when offline
- [ ] Sent message shows clock icon (⏱️) while offline
- [ ] Message appears in chat immediately (optimistic update)
- [ ] When going online, message auto-sends
- [ ] Status updates to checkmark (✓) after sent
- [ ] After recipient opens, status updates to double checkmark (✓✓)
- [ ] After recipient reads, status becomes blue checkmark (✓✓🔵)
- [ ] Refresh browser offline - messages still there
- [ ] Previous messages visible while offline
- [ ] No console errors
- [ ] No duplicate messages

---

## 🐛 Troubleshooting

### **Messages not sending when going online**
```javascript
// Check why flush failed:
import { outboxManager } from './shared/lib/outboxManager'
console.log('Failed messages:', outboxManager.getFailedMessages())
```

### **Status ticks not updating**
```javascript
// Check socket connection:
const socket = getSocket()
console.log('Socket connected:', socket.connected)
console.log('Socket ID:', socket.id)
```

### **Messages disappeared after refresh**
```javascript
// Check cache:
localStorage.getItem('nexus_cached_conversations')
localStorage.getItem('nexus_cached_messages_CONVID')
// If empty, messages need to be reloaded from server
```

### **Get detailed logs**
- Open DevTools Console
- Look for messages starting with:
  - 🌐 = Network event
  - 📤 = Outbox flush
  - ✅ = Success
  - ⚠️ = Warning
  - ❌ = Error

---

## 📊 Performance Tips

- Cache is limited to 100 messages per conversation (to save storage)
- Outbox queue typically has < 10 messages
- Auto-cleanup happens after 7 days
- Total localStorage usage < 2 MB for most users

---

## 🎯 Expected Console Output

When you complete a full offline→online→delivery→read cycle, you should see:

```
🌐 Network offline detected
📤 Flushing 1 queued offline messages...
✅ Queued message [uuid-here] sent successfully
✅ Flush queue completed. 0 messages remaining in queue
📨 Socket: message:ack [...]
📨 Socket: message:delivered [...]
📨 Socket: message:read [...]
```

---

## 🆘 Need Help?

Check these files for more info:
1. `OFFLINE_AND_STATUS_GUIDE.md` - Comprehensive guide
2. `CHANGES_SUMMARY.md` - What was changed
3. `backend/src/socket/handlers/message.handler.ts` - Backend logic
4. `frontend/src/socket/useSocketEvents.ts` - Socket event handling

---

## 🎉 You're All Set!

Your chat app now has **production-grade offline support** like WhatsApp!

Next steps:
1. ✅ Test with the scenarios above
2. ✅ Verify status ticks work correctly
3. ✅ Share feedback on what works/needs improvement
4. ✅ Deploy to production with confidence

Happy coding! 🚀
