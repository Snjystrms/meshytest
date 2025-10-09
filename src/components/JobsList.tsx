import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink, 
  Download,
  Copy,
  Trash2,
  Eye
} from 'lucide-react';
import { StoredJob, getJobs, deleteJob } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { downloadModel, proxyAssetUrl } from '@/api/meshyClient';

interface JobsListProps {
  onViewJob: (job: StoredJob) => void;
  refreshTrigger?: number;
}

export function JobsList({ onViewJob, refreshTrigger }: JobsListProps) {
  const [jobs, setJobs] = useState<StoredJob[]>([]);

  useEffect(() => {
    setJobs(getJobs());
  }, [refreshTrigger]);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied!',
      description: 'Asset URL copied to clipboard',
    });
  };

  const handleDownload = (url: string, jobId: string) => {
    downloadModel(url, `model-${jobId}.glb`);
    toast({
      title: 'Download started',
      description: 'Your model is being downloaded',
    });
  };

  const handleDelete = (id: string) => {
    deleteJob(id);
    setJobs(getJobs());
    toast({
      title: 'Deleted',
      description: 'Job removed from history',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-4 w-4" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'succeeded':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'succeeded':
        return 'default';
      case 'running':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (jobs.length === 0) {
    return (
      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Generation History</CardTitle>
          <CardDescription>Your created models will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No jobs yet. Create your first 3D model above!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle>Generation History</CardTitle>
        <CardDescription>{jobs.length} {jobs.length === 1 ? 'model' : 'models'} created</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors"
            >
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium truncate">
                    {job.name || job.prompt}
                  </p>
                  <Badge variant={getStatusVariant(job.status)} className="shrink-0 flex items-center gap-1">
                    {getStatusIcon(job.status)}
                    {job.status}
                  </Badge>
                </div>

                {job.status === 'running' && (
                  // Updated to show actual progress value
                  <Progress value={job.progress || 0} className="h-2" />
                )}

                {job.thumbnailUrl && (
                  <div className="mt-2">
                    <img 
                      src={proxyAssetUrl(job.thumbnailUrl)} 
                      alt="Thumbnail" 
                      className="w-16 h-16 object-cover rounded border"
                      crossOrigin="anonymous"
                    />
                  </div>
                )}

                {job.error && (
                  <p className="text-xs text-destructive">{job.error}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {job.status === 'succeeded' && job.assetUrl && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onViewJob(job)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(job.assetUrl!, job.id)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyUrl(job.assetUrl!)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy URL
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(job.assetUrl!, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(job.id)}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}