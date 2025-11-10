# Frontend Migration - Slack Integration

## Goal
Add an "Integrations" tab to each agent page showing Slack connection status.

**Effort:** ~4 hours

---

## What to Build

Single component that shows:
- **Not connected:** Button to connect
- **Connected:** Workspace name + disconnect button

That's it!

---

## Files to Create

### 1. Slack Tab Component
**File:** `/packages/playground/src/domains/agents/integrations/slack-tab.tsx`

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SlackTabProps {
  agentName: string;
}

export function SlackTab({ agentName }: SlackTabProps) {
  const queryClient = useQueryClient();
  
  // Fetch connection status
  const { data: connection, isLoading } = useQuery({
    queryKey: ['slack-connection', agentName],
    queryFn: async () => {
      const res = await fetch(`/v1/slack/connections/${agentName}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  // Connect to Slack (opens OAuth popup)
  const handleConnect = () => {
    const width = 600;
    const height = 800;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    window.open(
      `/v1/slack/auth/start?agentName=${agentName}`,
      'slack-oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    // Listen for OAuth completion
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'slack-connected') {
        queryClient.invalidateQueries(['slack-connection', agentName]);
        window.removeEventListener('message', handleMessage);
      }
    };
    window.addEventListener('message', handleMessage);
  };

  // Disconnect
  const disconnect = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/slack/connections/${agentName}/disconnect`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['slack-connection', agentName]);
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!connection) {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-2">Slack Integration</h3>
        <p className="text-sm text-gray-600 mb-4">
          Connect this agent to a Slack workspace to chat via direct messages and mentions.
        </p>
        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Connect to Slack
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-2">Slack Integration</h3>
      <div className="mb-4">
        <div className="text-sm mb-1">
          <span className="text-gray-600">Status:</span>
          <span className="ml-2 text-green-600">✓ Connected</span>
        </div>
        <div className="text-sm mb-1">
          <span className="text-gray-600">Workspace:</span>
          <span className="ml-2">{connection.teamName}</span>
        </div>
        <div className="text-sm">
          <span className="text-gray-600">Bot User ID:</span>
          <span className="ml-2 font-mono text-xs">{connection.botUserId}</span>
        </div>
      </div>
      <button
        onClick={() => disconnect.mutate()}
        disabled={disconnect.isPending}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
      >
        {disconnect.isPending ? 'Disconnecting...' : 'Disconnect'}
      </button>
    </div>
  );
}
```

---

## Files to Modify

### 2. Add Tab to Agent Page
**File:** `/packages/playground/src/pages/agents/agent/index.tsx`

Add import:
```tsx
import { SlackTab } from '@/domains/agents/integrations/slack-tab';
```

Add to tabs array:
```tsx
const tabs = [
  { label: 'Chat', component: ChatTab },
  { label: 'Tools', component: ToolsTab },
  { label: 'Workflows', component: WorkflowsTab },
  { 
    label: 'Integrations', 
    component: () => <SlackTab agentName={agentName} /> 
  }, // NEW
];
```

**That's it!**

---

## OAuth Success Page

When OAuth completes, redirect to a success page that closes the popup:

**File:** `/packages/playground/src/pages/slack-success.tsx` (or in Cloud)

```tsx
export default function SlackSuccess() {
  useEffect(() => {
    // Notify parent window
    if (window.opener) {
      window.opener.postMessage({ type: 'slack-connected' }, '*');
      window.close();
    }
  }, []);

  return <div>Connected! Closing window...</div>;
}
```

---

## API Endpoint Expected

The component expects this endpoint to exist (implemented in backend):

```
GET /v1/slack/connections/:agentName
→ Returns connection object or 404

POST /v1/slack/connections/:agentName/disconnect
→ Removes connection

GET /v1/slack/auth/start?agentName=:agentName
→ Starts OAuth flow
```

---

## Styling

Use your existing design system classes. The example above uses Tailwind, but adapt to whatever you use:

```tsx
// Instead of:
className="px-4 py-2 bg-blue-600..."

// Use your components:
<Button variant="primary" onClick={handleConnect}>
  Connect to Slack
</Button>
```

---

## Cloud vs Local

If you want to hide this in local dev:

```tsx
// In agent page
const isCloud = window.location.hostname.includes('cloud.mastra.ai');

const tabs = [
  // ... other tabs
  ...(isCloud ? [{ label: 'Integrations', component: SlackTab }] : []),
];
```

---

## Testing

1. Navigate to any agent page
2. Click "Integrations" tab
3. Click "Connect to Slack"
4. OAuth popup opens → authorize
5. Popup closes, status shows "Connected"
6. Refresh page → still shows connected
7. Click "Disconnect" → shows "Not connected"

**Done!**

---

## Total Code

- **1 new component:** ~100 lines
- **1 file modified:** +5 lines
- **Total:** ~105 lines

**Time:** ~4 hours including testing

