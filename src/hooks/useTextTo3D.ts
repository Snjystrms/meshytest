import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createTextTo3D,
  refineTextTo3D,
  get3DTask,
  LegacyCreateTextTo3DRequest,
  LegacyCreateTextTo3DResponse,
  LegacyJobResponse,
  MeshyError,
  streamTextTo3DTask,
  TaskUpdate,
  TaskError
} from '@/api/meshyClient';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect, useRef } from 'react';

export function useCreateTextTo3D() {
  return useMutation<LegacyCreateTextTo3DResponse, MeshyError, LegacyCreateTextTo3DRequest>({
    mutationFn: async (request) => {
      const artStyle =
        request.style === 'stylized' ? 'sculpture' : (request.style || 'realistic') as 'realistic' | 'sculpture';

      const newRequest = {
        mode: 'preview' as const,
        prompt: request.prompt,
        art_style: artStyle,
        seed: request.seed,
        ai_model: 'meshy-5' as const
      };

      const response = await createTextTo3D(newRequest);
      return { jobId: response.result };
    },
    onSuccess: () => {
      toast({
        title: 'Generation started',
        description: 'Your 3D model is being created. This may take a few minutes.',
      });
    },
    onError: (error) => {
      if (error.subscriptionRequired) {
        toast({
          title: 'Subscription Required',
          description: `Task creation on the free plan is no longer supported. Please upgrade your plan to continue. ${error.upgradeUrl ? `Upgrade at: ${error.upgradeUrl}` : ''}`,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Generation failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    },
  });
}

/**
 * Streaming hook that:
 *  - opens a single EventSource per task
 *  - auto-closes on SUCCEEDED or FAILED (prevents “infinite” streams)
 *  - exposes latest TaskUpdate + TaskError + loading/done flags
 */
export function useStreamTextTo3DTask(taskId: string | null, enabled: boolean = true) {
  const [taskUpdate, setTaskUpdate] = useState<TaskUpdate | null>(null);
  const [taskError, setTaskError] = useState<TaskError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // cleanup any previous stream if task changes or disabled
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setTaskUpdate(null);
    setTaskError(null);
    setIsDone(false);

    if (!taskId || !enabled) return;

    setIsLoading(true);
    const es = streamTextTo3DTask(
      taskId,
      (update) => {
        setIsLoading(false);
        setTaskUpdate(update);

        // Close the stream when the task reaches a terminal state
        if (update.status === 'SUCCEEDED' || update.status === 'FAILED') {
          if (esRef.current) esRef.current.close();
          esRef.current = null;
          setIsDone(true);
        }
      },
      (error) => {
        setIsLoading(false);
        setTaskError(error);
      }
    );

    esRef.current = es;

    // Hard safety: close on unmount
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [taskId, enabled]);

  return { taskUpdate, taskError, isLoading, isDone };
}

// --- Refine mutation ---
export function useRefineTextTo3D() {
  return useMutation<{ jobId: string }, MeshyError, { previewTaskId: string; enablePbr?: boolean; texturePrompt?: string }>({
    mutationFn: async ({ previewTaskId, enablePbr = true, texturePrompt }) => {
      const res = await refineTextTo3D({
        preview_task_id: previewTaskId,
        enable_pbr: enablePbr,
        texture_prompt: texturePrompt,
      });
      return { jobId: res.result };
    },
    onSuccess: () => {
      toast({
        title: 'Refining…',
        description: 'Adding textures/PBR. This typically takes 1–2 minutes.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Refine failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

interface UseJobPollerOptions {
  jobId: string | null;
  enabled?: boolean;
  onSuccess?: (job: LegacyJobResponse) => void;
  onError?: (error: MeshyError) => void;
}

export function useJobPoller({ jobId, enabled = true, onSuccess, onError }: UseJobPollerOptions) {
  return useQuery<LegacyJobResponse, MeshyError>({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) throw new Error('No job ID provided');
      const task = await get3DTask(jobId);

      return {
        id: task.id,
        status: task.status === 'PENDING' ? 'queued' :
                task.status === 'IN_PROGRESS' ? 'running' :
                task.status === 'SUCCEEDED' ? 'succeeded' : 'failed',
        progress: task.progress,
        assetUrl: task.model_urls?.glb,
        thumbnailUrl: task.thumbnail_url,
        error: task.task_error?.message,
        prompt: task.prompt,
        createdAt: task.created_at ? new Date(task.created_at).toISOString() : undefined,
      };
    },
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.status === 'succeeded' || data.status === 'failed') {
        if (data?.status === 'succeeded' && onSuccess) onSuccess(data);
        if (data?.status === 'failed' && onError) onError({ message: data.error || 'Job failed', status: 500 });
        return false;
      }
      const progress = data.progress || 0;
      if (progress < 30) return 2000;
      if (progress < 70) return 4000;
      return 6000;
    },
    retry: (failureCount, error) => {
      if (error.status && error.status >= 400 && error.status < 500) return false;
      return failureCount < 3;
    },
  });
}