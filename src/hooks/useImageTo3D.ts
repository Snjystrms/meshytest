import { useMutation, useQuery } from '@tanstack/react-query';
import { createImageTo3D, getImageTo3DTask, CreateImageTo3DRequest, ImageTo3DTask, MeshyError } from '@/api/meshyClient';
import { toast } from '@/hooks/use-toast';

export function useCreateImageTo3D() {
  return useMutation<{ jobId: string }, MeshyError, CreateImageTo3DRequest>({
    mutationFn: async (request) => {
      const response = await createImageTo3D(request);
      return { jobId: response.result };
    },
    onSuccess: () => {
      toast({
        title: 'Generation started',
        description: 'Your 3D model is being created from the image. This may take a few minutes.',
      });
    },
    onError: (error) => {
      if (error.subscriptionRequired) {
        toast({
          title: 'Subscription Required',
          description: `Task creation requires credits. Please upgrade your plan to continue. ${error.upgradeUrl ? `Upgrade at: ${error.upgradeUrl}` : ''}`,
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

interface UseImageTo3DJobPollerOptions {
  jobId: string | null;
  enabled?: boolean;
  onSuccess?: (job: ImageTo3DTask) => void;
  onError?: (error: MeshyError) => void;
}

export function useImageTo3DJobPoller({ jobId, enabled = true, onSuccess, onError }: UseImageTo3DJobPollerOptions) {
  return useQuery<ImageTo3DTask, MeshyError>({
    queryKey: ['imageTo3DJob', jobId],
    queryFn: async () => {
      if (!jobId) throw new Error('No job ID provided');
      return await getImageTo3DTask(jobId);
    },
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling if job is done or failed
      if (!data || data.status === 'SUCCEEDED' || data.status === 'FAILED') {
        if (data?.status === 'SUCCEEDED' && onSuccess) {
          onSuccess(data);
        }
        if (data?.status === 'FAILED' && onError) {
          onError({ message: data.task_error?.message || 'Job failed', status: 500 });
        }
        return false;
      }
      
      // Exponential backoff: start at 2s, max 8s
      const progress = data.progress || 0;
      if (progress < 30) return 2000;
      if (progress < 70) return 4000;
      return 6000;
    },
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error.status && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
  });
}