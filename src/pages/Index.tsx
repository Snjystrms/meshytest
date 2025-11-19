import { useState, useEffect } from 'react';
import { PromptForm } from '@/components/PromptForm';
import { JobsList } from '@/components/JobsList';
import { ModelViewer } from '@/components/ModelViewer';
import { ActionBar } from '@/components/ActionBar';
import { CardContent, Card } from '@/components/ui/card';
import { useCreateTextTo3D, useJobPoller, useStreamTextTo3DTask } from '@/hooks/useTextTo3D';
import { useRefineTextTo3D } from '@/hooks/useTextTo3D';
import { useCreateRigging, useStreamRiggingTask } from '@/hooks/useRigging';
import { useCreateAnimation, useStreamAnimationTask } from '@/hooks/useAnimation';
import { LegacyCreateTextTo3DRequest, RiggingTaskUpdate, AnimationTaskUpdate } from '@/api/meshyClient';
import { saveJob, updateJob, StoredJob } from '@/lib/storage';
import { Box, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const Index = () => {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [viewingJob, setViewingJob] = useState<StoredJob | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastRequest, setLastRequest] = useState<LegacyCreateTextTo3DRequest | null>(null);
  const [currentRiggingTaskId, setCurrentRiggingTaskId] = useState<string | null>(null);
  const [currentAnimationTaskId, setCurrentAnimationTaskId] = useState<string | null>(null);

  const createMutation = useCreateTextTo3D();
  const refineMutation = useRefineTextTo3D();
  const riggingMutation = useCreateRigging();
  const animationMutation = useCreateAnimation();

  // Real-time updates via SSE
  const { taskUpdate, taskError, isDone } = useStreamTextTo3DTask(currentJobId, !!currentJobId);
  const { taskUpdate: riggingTaskUpdate, taskError: riggingTaskError } = useStreamRiggingTask(currentRiggingTaskId, !!currentRiggingTaskId);
  const { taskUpdate: animationTaskUpdate, taskError: animationTaskError } = useStreamAnimationTask(currentAnimationTaskId, !!currentAnimationTaskId);

  // Push streaming progress into local storage + viewer props
  useEffect(() => {
    if (!taskUpdate) return;

    // Update storage status
    updateJob(taskUpdate.id, {
      status: taskUpdate.status === 'PENDING' ? 'queued' :
              taskUpdate.status === 'IN_PROGRESS' ? 'running' :
              taskUpdate.status === 'SUCCEEDED' ? 'succeeded' : 'failed',
      progress: taskUpdate.progress,
      assetUrl: taskUpdate.model_urls?.glb || undefined,
      thumbnailUrl: taskUpdate.thumbnail_url || undefined,
    });
    setRefreshTrigger((p) => p + 1);

    // If we're currently viewing this job, reflect live progress + final asset
    if (viewingJob?.id === taskUpdate.id) {
      setViewingJob({
        ...viewingJob,
        status: taskUpdate.status === 'PENDING' ? 'queued' :
                taskUpdate.status === 'IN_PROGRESS' ? 'running' :
                taskUpdate.status === 'SUCCEEDED' ? 'succeeded' : 'failed',
        // Keep showing old url until new one arrives; then swap
        assetUrl: taskUpdate.model_urls?.glb || viewingJob.assetUrl || null,
        progress: taskUpdate.progress,
        thumbnailUrl: taskUpdate.thumbnail_url || viewingJob.thumbnailUrl,
      });
    }

    // Terminal toasts
    if (taskUpdate.status === 'SUCCEEDED') {
      toast({ title: 'Generation complete!', description: 'Your 3D model is ready to view' });
    } else if (taskUpdate.status === 'FAILED') {
      toast({
        title: 'Generation failed',
        description: taskUpdate.task_error?.message || 'Task failed',
        variant: 'destructive',
      });
    }
  }, [taskUpdate]);

  // Handle rigging task updates
  useEffect(() => {
    if (!riggingTaskUpdate || !viewingJob?.id) return;

    const riggingStatus =
      riggingTaskUpdate.status === 'PENDING' ? 'pending' :
      riggingTaskUpdate.status === 'IN_PROGRESS' ? 'in_progress' :
      riggingTaskUpdate.status === 'SUCCEEDED' ? 'completed' : 'failed';

    updateJob(viewingJob.id, {
      riggingTaskId: riggingTaskUpdate.id,
      riggingProgress: riggingTaskUpdate.progress,
      riggingStatus,
    });

    if (viewingJob.id === currentJobId || viewingJob.riggingTaskId === riggingTaskUpdate.id) {
      setViewingJob(prev => prev ? {
        ...prev,
        riggingTaskId: riggingTaskUpdate.id,
        riggingProgress: riggingTaskUpdate.progress,
        riggingStatus,
      } : prev);
    }

    if (riggingTaskUpdate.status === 'SUCCEEDED' && riggingTaskUpdate.result) {
      updateJob(viewingJob.id, {
        riggedCharacterUrl: riggingTaskUpdate.result.rigged_character_fbx_url,
        walkingAnimationUrl: riggingTaskUpdate.result.basic_animations?.walking_glb_url,
        runningAnimationUrl: riggingTaskUpdate.result.basic_animations?.running_glb_url,
      });

      toast({
        title: 'Rigging complete!',
        description: 'Your model has been successfully rigged. You can now add animations.'
      });
    } else if (riggingTaskUpdate.status === 'FAILED') {
      toast({
        title: 'Rigging failed',
        description: riggingTaskUpdate.task_error?.message || 'Rigging task failed',
        variant: 'destructive',
      });
    }

    setRefreshTrigger((p) => p + 1);
  }, [riggingTaskUpdate, viewingJob?.id]);

  // Handle animation task updates
  useEffect(() => {
    if (!animationTaskUpdate || !viewingJob?.id) return;

    const animationStatus =
      animationTaskUpdate.status === 'PENDING' ? 'pending' :
      animationTaskUpdate.status === 'IN_PROGRESS' ? 'in_progress' :
      animationTaskUpdate.status === 'SUCCEEDED' ? 'completed' : 'failed';

    updateJob(viewingJob.id, {
      animationTaskId: animationTaskUpdate.id,
      animationProgress: animationTaskUpdate.progress,
      animationStatus,
    });

    if (viewingJob.id === currentJobId || viewingJob.animationTaskId === animationTaskUpdate.id) {
      setViewingJob(prev => prev ? {
        ...prev,
        animationTaskId: animationTaskUpdate.id,
        animationProgress: animationTaskUpdate.progress,
        animationStatus,
      } : prev);
    }

    if (animationTaskUpdate.status === 'SUCCEEDED' && animationTaskUpdate.result) {
      // Check if we have a valid animation URL
      const animationUrl = animationTaskUpdate.result.animation_glb_url;
      const hasValidAnimationUrl = !!animationUrl && animationUrl !== '';
      
      if (hasValidAnimationUrl) {
        updateJob(viewingJob.id, {
          customAnimationUrl: animationUrl,
        });

        if (viewingJob.id === currentJobId || viewingJob.animationTaskId === animationTaskUpdate.id) {
          setViewingJob(prev => prev ? {
            ...prev,
            customAnimationUrl: animationUrl,
          } : prev);
        }

        toast({
          title: 'Animation complete!',
          description: 'Your custom animation is ready to play.'
        });
      } else {
        // Handle case where animation task succeeded but no URL was provided
        toast({
          title: 'Animation completed',
          description: 'Animation task finished, but no animation file was generated.'
        });
      }
    } else if (animationTaskUpdate.status === 'FAILED') {
      toast({
        title: 'Animation failed',
        description: animationTaskUpdate.task_error?.message || 'Animation task failed',
        variant: 'destructive',
      });
    }

    setRefreshTrigger((p) => p + 1);
  }, [animationTaskUpdate, viewingJob?.id]);

  // Surface SSE errors
  useEffect(() => {
    if (taskError) {
      toast({ title: 'Connection error', description: taskError.message, variant: 'destructive' });
    }
  }, [taskError]);

  // Surface rigging SSE errors
  useEffect(() => {
    if (riggingTaskError) {
      toast({ title: 'Rigging connection error', description: riggingTaskError.message, variant: 'destructive' });
    }
  }, [riggingTaskError]);

  // Surface animation SSE errors
  useEffect(() => {
    if (animationTaskError) {
      toast({ title: 'Animation connection error', description: animationTaskError.message, variant: 'destructive' });
    }
  }, [animationTaskError]);

  // Fallback poller (only runs if there is no `taskUpdate` yet)
  useJobPoller({
    jobId: currentJobId,
    enabled: !!currentJobId && !taskUpdate, // disable polling once SSE is flowing
    onSuccess: (job) => {
      if (job.status === 'succeeded' && job.assetUrl) {
        updateJob(job.id, { status: 'succeeded', assetUrl: job.assetUrl, thumbnailUrl: job.thumbnailUrl });
        setViewingJob((prev) => prev && prev.id === job.id ? {
          ...prev, status: 'succeeded', assetUrl: job.assetUrl, thumbnailUrl: job.thumbnailUrl, progress: 100
        } : prev);
        setRefreshTrigger((p) => p + 1);
        toast({ title: 'Generation complete!', description: 'Your 3D model is ready to view' });
      } else if (job.status === 'failed') {
        updateJob(job.id, { status: 'failed', error: job.error });
        setRefreshTrigger((p) => p + 1);
      } else {
        updateJob(job.id, { status: job.status, progress: job.progress });
      }
    },
    onError: (error) => {
      if (currentJobId) {
        updateJob(currentJobId, { status: 'failed', error: error.message });
        setRefreshTrigger((p) => p + 1);
      }
    },
  });

  const handleSubmit = (request: LegacyCreateTextTo3DRequest) => {
    setLastRequest(request);
    createMutation.mutate(request, {
      onSuccess: (response) => {
        const newJob: StoredJob = {
          id: response.jobId,
          prompt: request.prompt,
          status: 'queued',
          createdAt: new Date().toISOString(),
          // @ts-ignore legacy props
          style: request.style,
          quality: request.quality,
          progress: 0,
        };
        saveJob(newJob);
        setCurrentJobId(response.jobId);
        setViewingJob(newJob); // immediately select the new job so viewer can show progress
        setRefreshTrigger((p) => p + 1);
      },
    });
  };

  const handleRegenerate = () => {
    if (lastRequest) handleSubmit(lastRequest);
  };

  // Trigger refine for the currently viewed job
  const handleRefine = ({ previewTaskId, enablePbr = true, texturePrompt }: { previewTaskId: string; enablePbr?: boolean; texturePrompt?: string }) => {
    refineMutation.mutate(
      { previewTaskId, enablePbr, texturePrompt },
      {
        onSuccess: ({ jobId }) => {
          setCurrentJobId(jobId);
          // Create a new job entry for the refine process
          const newRefineJob: StoredJob = {
            id: jobId,
            prompt: viewingJob?.prompt || '',
            status: 'queued',
            createdAt: new Date().toISOString(),
            progress: 0,
            isRefined: true,
            name: viewingJob?.name ? `${viewingJob.name} (Refined)` : 'Refined Model'
          };
          saveJob(newRefineJob);
          setViewingJob(newRefineJob);
          setRefreshTrigger((p) => p + 1);
        },
        onError: (error) => {
          if (error.subscriptionRequired) {
            toast({
              title: 'Subscription Required',
              description: `Task creation on the free plan is no longer supported. Please upgrade your plan to continue. ${error.upgradeUrl ? `Upgrade at: ${error.upgradeUrl}` : ''}`,
              variant: 'destructive'
            });
          } else {
            toast({ title: 'Refine failed', description: error.message, variant: 'destructive' });
          }
        }
      }
    );
  };

  // Trigger rigging for the currently viewed job
  const handleRig = async ({ heightMeters = 1.8 }: { heightMeters?: number }) => {
    if (!viewingJob?.assetUrl) {
      toast({ 
        title: 'No model available', 
        description: 'Please generate a model first before rigging.', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      const response = await riggingMutation.mutateAsync({
        model_url: viewingJob.assetUrl,
        height_meters: heightMeters
      });
      
      setCurrentRiggingTaskId(response.result);

      updateJob(viewingJob.id, {
        riggingTaskId: response.result,
        riggingProgress: 0,
        riggingStatus: 'pending'
      });

      setViewingJob(prev => prev ? {
        ...prev,
        riggingTaskId: response.result,
        riggingProgress: 0,
        riggingStatus: 'pending' as const
      } : prev);
      
      setRefreshTrigger((p) => p + 1);
    } catch (error) {
      toast({ 
        title: 'Rigging failed', 
        description: 'Failed to start rigging process.', 
        variant: 'destructive' 
      });
    }
  };

  // Trigger animation for the currently viewed job
  const handleAnimate = async ({ 
    actionId, 
    fps 
  }: { 
    actionId: number; 
    fps?: 24 | 25 | 30 | 60 
  }) => {
    if (!viewingJob?.riggingTaskId) {
      toast({ 
        title: 'No rig available', 
        description: 'Please rig your model first before adding animations.', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      console.log('Creating animation with:', {
        rig_task_id: viewingJob.riggingTaskId,
        action_id: actionId,
        fps
      });
      
      const response = await animationMutation.mutateAsync({
        rig_task_id: viewingJob.riggingTaskId,
        action_id: actionId,
        fps
      });
      
      console.log('Animation creation response:', response);
      
      setCurrentAnimationTaskId(response.result);

      updateJob(viewingJob.id, {
        animationTaskId: response.result,
        animationProgress: 0,
        animationStatus: 'pending'
      });

      setViewingJob(prev => prev ? {
        ...prev,
        animationTaskId: response.result,
        animationProgress: 0,
        animationStatus: 'pending' as const
      } : prev);
      
      setRefreshTrigger((p) => p + 1);
    } catch (error) {
      console.error('Animation creation error:', error);
      toast({ 
        title: 'Animation failed', 
        description: 'Failed to start animation process: ' + (error as Error).message, 
        variant: 'destructive' 
      });
    }
  };

  const handleViewJob = (job: StoredJob) => {
    setViewingJob(job);
    // If the user clicks a finished item, stop tracking another job
    setCurrentJobId(job.id);
  };

  const viewerStatus =
    viewingJob?.status || (taskUpdate ? (taskUpdate.status === 'IN_PROGRESS' ? 'running' : taskUpdate.status === 'PENDING' ? 'queued' : 'succeeded') : undefined);

  const viewerProgress =
    (viewingJob?.progress ?? (taskUpdate?.progress ?? 0));

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Box className="h-8 w-8 text-primary" />
                <div className="absolute inset-0 blur-lg bg-primary/20 -z-10" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">Meshy Text → 3D Studio</h1>
                <p className="text-sm text-muted-foreground">Generate 3D models from text</p>
              </div>
            </div>
            <nav className="flex gap-4">
              <Link to="/3d" className="px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground">
                Text to 3D
              </Link>
              <Link to="/image-to-3d" className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Image to 3D
                </div>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <PromptForm onSubmit={handleSubmit} isLoading={createMutation.isPending} />

          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <JobsList onViewJob={handleViewJob} refreshTrigger={refreshTrigger} />
            </div>

            <div>
              <ModelViewer
                modelUrl={viewingJob?.assetUrl || null}
                modelName={viewingJob?.name || viewingJob?.prompt}
                status={viewerStatus as any}
                progress={viewerProgress}
                animationUrl={viewingJob?.customAnimationUrl || null}
                riggingStatus={viewingJob?.riggingStatus}
                riggingProgress={viewingJob?.riggingProgress}
                animationStatus={viewingJob?.animationStatus}
                animationProgress={viewingJob?.animationProgress}
              />
              {viewingJob && (
                <div className="mt-6">
                  <ActionBar
                    jobId={viewingJob.id}
                    assetUrl={viewingJob.assetUrl || ''}
                    currentName={viewingJob.name || viewingJob.prompt || 'Generated Model'}
                    prompt={viewingJob.prompt || ''}
                    onRegenerate={handleRegenerate}
                    onRefine={handleRefine}
                    onRig={handleRig}
                    onAnimate={handleAnimate}
                    isRefined={viewingJob.isRefined}
                    riggingStatus={viewingJob.riggingStatus}
                    animationStatus={viewingJob.animationStatus}
                  />
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;