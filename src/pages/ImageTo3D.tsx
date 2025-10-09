import { useState } from 'react';
import { ImageUploadForm } from '@/components/ImageUploadForm';
import { ModelViewer } from '@/components/ModelViewer';
import { JobsList } from '@/components/JobsList';
import { CardContent, Card } from '@/components/ui/card';
import { useCreateImageTo3D, useImageTo3DJobPoller } from '@/hooks/useImageTo3D';
import { saveJob, updateJob, StoredJob } from '@/lib/storage';
import { Box, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { CreateImageTo3DRequest } from '@/api/meshyClient';

const ImageTo3D = () => {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [viewingJob, setViewingJob] = useState<StoredJob | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const createMutation = useCreateImageTo3D();

  const { data: jobData } = useImageTo3DJobPoller({
    jobId: currentJobId,
    enabled: !!currentJobId,
    onSuccess: (job) => {
      if (job.status === 'SUCCEEDED' && job.model_urls?.glb) {
        updateJob(job.id, {
          status: 'succeeded',
          assetUrl: job.model_urls.glb,
          thumbnailUrl: job.thumbnail_url,
        });
        setViewingJob({
          id: job.id,
          prompt: 'Generated from image',
          status: 'succeeded',
          assetUrl: job.model_urls.glb,
          thumbnailUrl: job.thumbnail_url,
          createdAt: job.created_at ? new Date(job.created_at).toISOString() : new Date().toISOString(),
        });
        setRefreshTrigger(prev => prev + 1);
        toast({
          title: 'Generation complete!',
          description: 'Your 3D model is ready to view',
        });
      } else if (job.status === 'FAILED') {
        updateJob(job.id, {
          status: 'failed',
          error: job.task_error?.message,
        });
        setRefreshTrigger(prev => prev + 1);
      }
    },
    onError: (error) => {
      if (currentJobId) {
        updateJob(currentJobId, {
          status: 'failed',
          error: error.message,
        });
        setRefreshTrigger(prev => prev + 1);
      }
    },
  });

  const handleSubmit = (request: CreateImageTo3DRequest) => {
    createMutation.mutate(request, {
      onSuccess: (response) => {
        const newJob: StoredJob = {
          id: response.jobId,
          prompt: 'Generated from image',
          status: 'queued',
          createdAt: new Date().toISOString(),
          type: '3d'
        };
        saveJob(newJob);
        setCurrentJobId(response.jobId);
        setRefreshTrigger(prev => prev + 1);
      },
    });
  };

  const handleViewJob = (job: StoredJob) => {
    setViewingJob(job);
  };

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
                <h1 className="text-2xl font-bold text-gradient">
                  Meshy Image → 3D Studio
                </h1>
                <p className="text-sm text-muted-foreground">
                  Generate 3D models from images
                </p>
              </div>
            </div>
            
            <nav className="flex gap-4">
              <Link 
                to="/3d" 
                className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Text to 3D
              </Link>
              <Link 
                to="/image-to-3d" 
                className="px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground"
              >
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
          {/* Image Upload Form */}
          <ImageUploadForm
            onSubmit={handleSubmit}
            isLoading={createMutation.isPending}
          />

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left: Jobs List */}
            <div>
              <JobsList
                onViewJob={handleViewJob}
                refreshTrigger={refreshTrigger}
              />
            </div>

            {/* Right: Model Viewer */}
            <div className="space-y-4">
              <ModelViewer
                modelUrl={viewingJob?.assetUrl || null}
                modelName={viewingJob?.name || viewingJob?.prompt}
              />
            </div>
          </div>

          {/* Info Section */}
          <Card className="bg-muted/20 border-primary/20">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6 text-sm">
                <div>
                  <h3 className="font-semibold mb-2 text-primary">Getting Started</h3>
                  <p className="text-muted-foreground">
                    Upload an image or provide a URL. The system will generate a 3D model based on the image content.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-primary">Best Practices</h3>
                  <p className="text-muted-foreground">
                    Use clear images with good contrast. Avoid busy backgrounds. Simple objects work best.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-primary">File Format</h3>
                  <p className="text-muted-foreground">
                    All models are exported as GLB files, compatible with most 3D software and game engines.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-16">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Powered by Meshy API • Built with React Three Fiber
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ImageTo3D;