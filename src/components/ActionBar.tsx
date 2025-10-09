import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Copy, RotateCcw, Edit2, FlaskConical, User, Play } from 'lucide-react';
import { downloadModel } from '@/api/meshyClient';
import { toast } from '@/hooks/use-toast';
import { updateJob } from '@/lib/storage';

interface ActionBarProps {
  jobId: string;
  assetUrl: string;
  currentName: string;
  prompt: string;
  onRegenerate: () => void;
  onRefine?: (opts: { previewTaskId: string; enablePbr?: boolean; texturePrompt?: string }) => void;
  onRig?: (opts: { heightMeters: number }) => void;
  onAnimate?: (opts: { actionId: number; fps?: 24 | 25 | 30 | 60 }) => void;
}

export function ActionBar({ 
  jobId, 
  assetUrl, 
  currentName, 
  prompt, 
  onRegenerate, 
  onRefine,
  onRig,
  onAnimate
}: ActionBarProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [newName, setNewName] = useState(currentName);
  const [refining, setRefining] = useState(false);
  const [isRiggingOpen, setIsRiggingOpen] = useState(false);
  const [isAnimationOpen, setIsAnimationOpen] = useState(false);
  const [heightMeters, setHeightMeters] = useState('1.8');
  const [actionId, setActionId] = useState('1');
  const [fps, setFps] = useState<'24' | '25' | '30' | '60'>('30');

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(assetUrl);
    toast({
      title: 'Copied!',
      description: 'Asset URL copied to clipboard',
    });
  };

  const handleDownload = () => {
    downloadModel(assetUrl, `${currentName.replace(/\s+/g, '-').toLowerCase()}.glb`);
    toast({
      title: 'Download started',
      description: 'Your model is being downloaded',
    });
  };

  const handleRename = () => {
    if (newName.trim()) {
      updateJob(jobId, { name: newName.trim() });
      toast({
        title: 'Renamed',
        description: 'Model name updated successfully',
      });
      setIsRenameOpen(false);
    }
  };

  const handleRefine = async () => {
    if (!onRefine) return;
    try {
      setRefining(true);
      // Pass the jobId as previewTaskId for refinement
      await onRefine({ previewTaskId: jobId, enablePbr: true });
    } finally {
      setRefining(false);
    }
  };

  const handleRig = async () => {
    if (!onRig) return;
    try {
      const height = parseFloat(heightMeters) || 1.8;
      await onRig({ heightMeters: height });
      toast({
        title: 'Rigging started',
        description: 'Your model is being rigged. This may take a few minutes.',
      });
      setIsRiggingOpen(false);
    } catch (error) {
      toast({
        title: 'Rigging failed',
        description: 'Failed to start rigging process.',
        variant: 'destructive',
      });
    }
  };

  const handleAnimate = async () => {
    if (!onAnimate) return;
    try {
      const action = parseInt(actionId) || 1;
      await onAnimate({ 
        actionId: action, 
        fps: fps !== '30' ? parseInt(fps) as 24 | 25 | 30 | 60 : undefined
      });
      toast({
        title: 'Animation started',
        description: 'Your animation is being created. This may take a few minutes.',
      });
      setIsAnimationOpen(false);
    } catch (error) {
      console.error('Animation error:', error);
      toast({
        title: 'Animation failed',
        description: 'Failed to start animation process: ' + (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={handleDownload} className="btn-glow">
        <Download className="mr-2 h-4 w-4" />
        Download GLB
      </Button>

      <Button onClick={handleCopyUrl} variant="outline">
        <Copy className="mr-2 h-4 w-4" />
        Copy Asset URL
      </Button>

      <Button onClick={onRegenerate} variant="outline">
        <RotateCcw className="mr-2 h-4 w-4" />
        Regenerate
      </Button>

      {onRefine && (
        <Button onClick={handleRefine} disabled={refining}>
          <FlaskConical className="mr-2 h-4 w-4" />
          {refining ? 'Refining…' : 'Refine (PBR)'}
        </Button>
      )}

      {onRig && (
        <Dialog open={isRiggingOpen} onOpenChange={setIsRiggingOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <User className="mr-2 h-4 w-4" />
              Rig Model
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rig 3D Model</DialogTitle>
              <DialogDescription>
                Add a rig to your 3D model to enable animations. This process may take a few minutes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="height">Character Height (meters)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="3"
                  value={heightMeters}
                  onChange={(e) => setHeightMeters(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRiggingOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRig}>
                Start Rigging
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {onAnimate && (
        <Dialog open={isAnimationOpen} onOpenChange={setIsAnimationOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Play className="mr-2 h-4 w-4" />
              Add Animation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Animation</DialogTitle>
              <DialogDescription>
                Apply an animation to your rigged character. Select an action and optional frame rate.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="action">Action ID (1-696)</Label>
                <Input
                  id="action"
                  type="number"
                  min="1"
                  max="696"
                  value={actionId}
                  onChange={(e) => setActionId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fps">Frame Rate (FPS)</Label>
                <Select value={fps} onValueChange={(value: '24' | '25' | '30' | '60') => setFps(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select FPS" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 FPS</SelectItem>
                    <SelectItem value="25">25 FPS</SelectItem>
                    <SelectItem value="30">30 FPS</SelectItem>
                    <SelectItem value="60">60 FPS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAnimationOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAnimate}>
                Create Animation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Edit2 className="mr-2 h-4 w-4" />
            Rename
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Model</DialogTitle>
            <DialogDescription>
              Give your model a custom name for easier identification
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Model Name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My awesome model"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Original prompt: {prompt}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}