import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createRigging,
  getRiggingTask,
  RiggingTask,
  MeshyError,
  streamRiggingTask,
  RiggingTaskUpdate,
  TaskError
} from '@/api/meshyClient';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect, useRef } from 'react';

export function useCreateRigging() {
  return useMutation<{ result: string }, MeshyError, { model_url?: string; input_task_id?: string; height_meters?: number }>({
    mutationFn: async (request) => {
      const res = await createRigging(request);
      return res;
    },
    onSuccess: () => {
      toast({
        title: 'Rigging started',
        description: 'Your model is being rigged. This may take a few minutes.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Rigging failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Streaming hook for rigging tasks
 */
export function useStreamRiggingTask(taskId: string | null, enabled: boolean = true) {
  const [taskUpdate, setTaskUpdate] = useState<RiggingTaskUpdate | null>(null);
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
    const es = streamRiggingTask(
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

export function useRiggingTaskPoller({ taskId, enabled = true }: { taskId: string | null; enabled?: boolean }) {
  return useQuery<RiggingTask, MeshyError>({
    queryKey: ['riggingTask', taskId],
    queryFn: async () => {
      if (!taskId) throw new Error('No task ID provided');
      return await getRiggingTask(taskId);
    },
    enabled: !!taskId && enabled,
    refetchInterval: (query) => {
         const data = query.state.data;
      if (!data || data.status === 'SUCCEEDED' || data.status === 'FAILED') {
        return false; // Stop polling
      }
      return 2000; // Poll every 2 seconds while in progress
    },
  });
}