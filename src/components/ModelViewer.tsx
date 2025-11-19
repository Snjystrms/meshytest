import { Suspense, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Stage, Grid, useGLTF, useAnimations, Loader } from '@react-three/drei';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Box3, Vector3, LoopRepeat } from 'three';
import { RotateCcw, Grid3x3, Maximize2, Play, Pause, Square } from 'lucide-react';
import { proxyAssetUrl } from '@/api/meshyClient';

interface ModelViewerProps {
  modelUrl: string | null;
  modelName?: string;
  status?: 'queued' | 'running' | 'succeeded' | 'failed';
  progress?: number;
  /** Pass the animation_glb_url (prefer …withSkin.glb) here when ready */
  animationUrl?: string | null;
  riggingStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
  riggingProgress?: number;
  animationStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
  animationProgress?: number;
}

interface AnimatedModelProps {
  modelUrl: string;
  animationUrl?: string | null;
  onAnimationData?: (actions: Record<string, any>, names: string[]) => void;
}

/**
 * Loads either the base model GLB or (if provided) the animation GLB-with-skin,
 * centers/scales it, and exposes its animations.
 */
function AnimatedModel({ modelUrl, animationUrl, onAnimationData }: AnimatedModelProps) {
  const modelSrc = proxyAssetUrl(modelUrl);
  const hasAnim = !!animationUrl && animationUrl !== '';
  const animSrc = hasAnim ? proxyAssetUrl(animationUrl as string) : null;

  const modelGltf = useGLTF(modelSrc);
  const animGltf = useGLTF(animSrc || modelSrc, true); // Skip loading if animSrc is null

  const scene = modelGltf.scene;
  const animations = useMemo(() => {
    // If we have a valid animation URL and it loaded successfully with animations, use those
    // Otherwise fall back to the model's animations
    if (hasAnim && animGltf.animations && animGltf.animations.length > 0) {
      return animGltf.animations;
    }
    return modelGltf.animations || [];
  }, [hasAnim, animGltf.animations, modelGltf.animations]);

  const { actions, names, mixer } = useAnimations(animations, scene);

  useEffect(() => {
    if (!scene || (scene as any).__initialized) return;
    (scene as any).__initialized = true;

    const box = new Box3().setFromObject(scene);
    const center = new Vector3();
    const size = new Vector3();
    box.getCenter(center);
    box.getSize(size);

    scene.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / (maxDim || 1);
    scene.scale.setScalar(scale);

    scene.updateMatrixWorld(true);
    const boxAfter = new Box3().setFromObject(scene);
    const minY = boxAfter.min.y;
    scene.position.y += -minY;
  }, [scene]);

  // Hand animation handles back to parent
  useEffect(() => {
    if (onAnimationData) onAnimationData(actions as any, names);
  }, [actions, names, onAnimationData]);

  // Ensure mixer runs even when paused/unpaused by parent
  useEffect(() => {
    if (!mixer) return;
    // drei's <Canvas> handles ticking; mixer will be advanced automatically by useAnimations
  }, [mixer]);

  return <primitive object={scene} />;
}

/** Slim progress overlay */
function ProgressOverlay({
  visible,
  progress = 0,
  label,
}: {
  visible: boolean;
  progress?: number;
  label?: string;
}) {
  if (!visible) return null;
  const pct = Math.max(0, Math.min(100, Math.round(progress || 0)));

  return (
    <div className="absolute left-0 right-0 bottom-0 p-3 pointer-events-none">
      <div className="w-full h-2 rounded bg-muted overflow-hidden">
        <div
          className="h-2 rounded bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
          aria-label={label || 'Progress'}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
      <div className="mt-1 text-xs text-muted-foreground text-right">{pct}%</div>
    </div>
  );
}

export function ModelViewer({
  modelUrl,
  modelName,
  status,
  progress = 0,
  animationUrl,
  riggingStatus,
  riggingProgress = 0,
  animationStatus,
  animationProgress = 0,
}: ModelViewerProps) {
  const [showGrid, setShowGrid] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  const [availableAnimations, setAvailableAnimations] = useState<string[]>([]);
  const controlsRef = useRef<any>();
  const actionsRef = useRef<Record<string, any>>({});
  const animationNamesRef = useRef<string[]>([]);

  const handleResetCamera = () => {
    controlsRef.current?.reset();
  };

  const handlePlayAnimation = () => {
    const actions = actionsRef.current;
    const names = animationNamesRef.current;

    if (!names || names.length === 0) return;

    const name = currentAnimation || names[0];
    const action = actions[name];

    if (action) {
      try {
        // Stop others to avoid blending surprises
        Object.values(actions).forEach((a: any) => a?.stop?.());
        action.reset();
        action.clampWhenFinished = false;
        action.setLoop(LoopRepeat, Infinity);
        action.paused = false;
        action.play();
        setIsPlaying(true);
      } catch (e) {
        console.warn('Failed to play animation:', e);
      }
    }
  };

  const handlePauseAnimation = () => {
    try {
      Object.values(actionsRef.current).forEach((a: any) => {
        if (a) a.paused = true;
      });
      setIsPlaying(false);
    } catch (e) {
      console.warn('Failed to pause animation:', e);
    }
  };

  const handleStopAnimation = () => {
    try {
      Object.values(actionsRef.current).forEach((a: any) => a?.stop?.());
      setIsPlaying(false);
    } catch (e) {
      console.warn('Failed to stop animation:', e);
    }
  };

  const isBusy = status === 'queued' || status === 'running';
  const showOverlay = isBusy && progress >= 0 && progress < 100;
  const hasAnimationUrl = !!animationUrl && animationUrl !== '' && animationUrl !== null;

  const isRiggingInProgress = riggingStatus === 'pending' || riggingStatus === 'in_progress';
  const showRiggingOverlay = isRiggingInProgress && riggingProgress >= 0;

  const isAnimationInProgress = animationStatus === 'pending' || animationStatus === 'in_progress';
  const showAnimationOverlay = isAnimationInProgress && animationProgress >= 0;

  // Receive actions/names from child
  const setAnimationData = useCallback((actions: Record<string, any>, names: string[]) => {
    actionsRef.current = actions;
    animationNamesRef.current = names;
    setAvailableAnimations(names);
    if (names.length > 0) setCurrentAnimation((prev) => prev || names[0]);
  }, []);

  if (!modelUrl) {
    return (
      <Card className="card-glow">
        <CardHeader>
          <CardTitle>3D Preview</CardTitle>
          <CardDescription>Your model will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/20">
            <div className="text-center space-y-2 px-4">
              <Box3x3 className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No model loaded</p>
              <p className="text-xs text-muted-foreground">Generate a model to see it here</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>3D Preview</CardTitle>
            <CardDescription>{modelName || 'Interactive 3D Model'}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowGrid(!showGrid)} title="Toggle grid">
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleResetCamera} title="Reset camera">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="aspect-square rounded-lg overflow-hidden bg-muted/10 relative">
          <Canvas camera={{ position: [3, 3, 3], fov: 50 }} gl={{ antialias: true, alpha: true }}>
            <Suspense fallback={null}>
              <Stage
                intensity={0.5}
                environment="city"
                shadows={{ type: 'accumulative', bias: -0.001, intensity: Math.PI }}
                adjustCamera={false}
              >
                {/* Key on both URLs so scene remounts when either changes */}
                <AnimatedModel
                  key={`${modelUrl}__${animationUrl || ''}`}
                  modelUrl={modelUrl}
                  animationUrl={animationUrl}
                  onAnimationData={setAnimationData}
                />
              </Stage>

              {showGrid && (
                <Grid
                  args={[10, 10]}
                  cellSize={0.5}
                  cellThickness={0.5}
                  sectionSize={2}
                  sectionThickness={1}
                  fadeDistance={25}
                  fadeStrength={1}
                  infiniteGrid
                />
              )}

              <Environment preset="sunset" />
              <OrbitControls
                ref={controlsRef}
                enablePan
                enableZoom
                enableRotate
                minDistance={1}
                maxDistance={10}
                makeDefault
              />
            </Suspense>
          </Canvas>

          <Loader
            containerStyles={{ backgroundColor: 'hsl(var(--background) / 0.8)' }}
            dataStyles={{ color: 'hsl(var(--primary))' }}
          />

          <ProgressOverlay visible={showOverlay} progress={progress} label="Generation progress" />
          <ProgressOverlay visible={showRiggingOverlay} progress={riggingProgress} label="Rigging model" />
          <ProgressOverlay visible={showAnimationOverlay} progress={animationProgress} label="Creating animation" />

          <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/80 px-3 py-1.5 rounded-md backdrop-blur-sm">
            <p>Drag to rotate • Scroll to zoom • Right-click to pan</p>
          </div>
        </div>

        {/* Animation Controls */}
        {hasAnimationUrl && availableAnimations.length > 0 && animationStatus === 'completed' && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={isPlaying ? handlePauseAnimation : handlePlayAnimation}
                  title={isPlaying ? 'Pause animation' : 'Play animation'}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="outline" onClick={handleStopAnimation} title="Stop animation">
                  <Square className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">Custom Animation</div>
            </div>

            {availableAnimations.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Animation:</label>
                <select
                  value={currentAnimation || ''}
                  onChange={(e) => setCurrentAnimation(e.target.value)}
                  className="text-xs border rounded px-2 py-1"
                  disabled={isPlaying || availableAnimations.length === 0}
                >
                  {availableAnimations.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Maximize2 className="h-3 w-3" />
            <span>GLB Format</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Box3x3(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}