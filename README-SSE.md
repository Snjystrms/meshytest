# SSE-based Progress Tracking for Text-to-3D API

This document explains how to use the new Server-Sent Events (SSE) based progress tracking for the Text-to-3D API.

## Overview

The implementation replaces the previous polling-based approach with real-time updates using Server-Sent Events (SSE). This provides a more efficient and responsive user experience by delivering progress updates as they happen, rather than at fixed intervals.

## Key Components

### 1. `streamTextTo3DTask` API Function

Located in [src/api/meshyClient.ts](file:///c:/Users/DELL/Desktop/meshytest/src/api/meshyClient.ts), this function establishes an SSE connection to the Meshy API's streaming endpoint:

```typescript
export function streamTextTo3DTask(
  taskId: string,
  onMessage: (update: TaskUpdate) => void,
  onError: (error: TaskError) => void
): EventSource
```

### 2. `useStreamTextTo3DTask` React Hook

Located in [src/hooks/useTextTo3D.ts](file:///c:/Users/DELL/Desktop/meshytest/src/hooks/useTextTo3D.ts), this hook provides a React-friendly interface for using the SSE connection:

```typescript
export function useStreamTextTo3DTask(taskId: string | null, enabled: boolean = true)
```

Returns an object with:
- `taskUpdate`: The latest task update or null
- `taskError`: Any error that occurred or null
- `isLoading`: Whether the connection is being established

### 3. Updated Components

- **JobsList**: Now displays real-time progress percentages
- **Index**: Uses the new hook for real-time updates
- **Storage**: Updated to store progress information

## Usage

### In a React Component

```typescript
import { useStreamTextTo3DTask } from '@/hooks/useTextTo3D';

function MyComponent({ taskId }: { taskId: string | null }) {
  const { taskUpdate, taskError, isLoading } = useStreamTextTo3DTask(taskId, !!taskId);
  
  useEffect(() => {
    if (taskUpdate) {
      // Handle real-time updates
      console.log(`Progress: ${taskUpdate.progress}%`);
    }
  }, [taskUpdate]);
  
  if (taskError) {
    // Handle errors
    console.error('SSE Error:', taskError.message);
  }
  
  return (
    <div>
      {isLoading && <p>Connecting...</p>}
      {taskUpdate && (
        <div>
          <p>Status: {taskUpdate.status}</p>
          <p>Progress: {taskUpdate.progress}%</p>
        </div>
      )}
    </div>
  );
}
```

## Benefits

1. **Real-time Updates**: Progress is updated as soon as it changes on the server
2. **Reduced Network Traffic**: Eliminates unnecessary polling requests
3. **Better User Experience**: Users see immediate feedback on task progress
4. **Efficient Resource Usage**: Server resources are used more efficiently

## Implementation Details

The implementation follows these steps:

1. When a text-to-3D task is created, the task ID is stored
2. The `useStreamTextTo3DTask` hook establishes an SSE connection to the streaming endpoint
3. As the server sends progress updates, the client receives them in real-time
4. The UI updates immediately with the new progress information
5. When the task completes, the connection is automatically closed

## Fallback Mechanism

The implementation includes a fallback to the previous polling mechanism in case SSE is not available or fails:

```typescript
useJobPoller({
  jobId: currentJobId,
  enabled: !!currentJobId && !taskUpdate, // Only use polling if SSE is not available
  // ... rest of the configuration
});
```

This ensures that the application continues to function even if SSE is not available.