import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createAnimation,
  getAnimationTask,
  AnimationTask,
  MeshyError,
  streamAnimationTask,
  AnimationTaskUpdate,
  TaskError
} from '@/api/meshyClient';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect, useRef } from 'react';

export function useCreateAnimation() {
  return useMutation<{ result: string }, MeshyError, { rig_task_id: string; action_id: number; fps?: 24 | 25 | 30 | 60 }>({
    mutationFn: async ({ rig_task_id, action_id, fps }) => {
      const request: any = {
        rig_task_id,
        action_id
      };
      
      if (fps) {
        request.post_process = {
          operation_type: 'change_fps',
          fps
        };
      }
      
      console.log('Sending animation request:', request);
      const res = await createAnimation(request);
      console.log('Animation response:', res);
      return res;
    },
    onSuccess: () => {
      toast({
        title: 'Animation started',
        description: 'Your animation is being created. This may take a few minutes.',
      });
    },
    onError: (error) => {
      console.error('Animation API error:', error);
      toast({
        title: 'Animation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Streaming hook for animation tasks
 */
export function useStreamAnimationTask(taskId: string | null, enabled: boolean = true) {
  const [taskUpdate, setTaskUpdate] = useState<AnimationTaskUpdate | null>(null);
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
    const es = streamAnimationTask(
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

export function useAnimationTaskPoller({ taskId, enabled = true }: { taskId: string | null; enabled?: boolean }) {
  return useQuery<AnimationTask, MeshyError>({
    queryKey: ['animationTask', taskId],
    queryFn: async () => {
      if (!taskId) throw new Error('No task ID provided');
      return await getAnimationTask(taskId);
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