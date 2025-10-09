import { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Sparkles } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { LegacyCreateTextTo3DRequest } from '@/api/meshyClient';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from './ui/card';

interface PromptFormProps {
  onSubmit: (request: LegacyCreateTextTo3DRequest) => void;
  isLoading: boolean;
}

export function PromptForm({ onSubmit, isLoading }: PromptFormProps) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<'realistic' | 'stylized' | 'low-poly'>('realistic');
  const [quality, setQuality] = useState<'draft' | 'standard' | 'high'>('standard');
  const [seed, setSeed] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const request: LegacyCreateTextTo3DRequest = {
      prompt: prompt.trim(),
      style,
      quality,
    };

    if (seed && !isNaN(parseInt(seed))) {
      request.seed = parseInt(seed);
    }

    onSubmit(request);
  };

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Create 3D Model
        </CardTitle>
        <CardDescription>
          Describe what you want to create. Be specific about shapes, materials, and style.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt *</Label>
            <Textarea
              id="prompt"
              placeholder="e.g., 'a low-poly sci-fi drone with glowing cyan vents and metallic surface'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="style">Style</Label>
              <Select value={style} onValueChange={(v: any) => setStyle(v)}>
                <SelectTrigger id="style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realistic">Realistic</SelectItem>
                  <SelectItem value="stylized">Stylized</SelectItem>
                  <SelectItem value="low-poly">Low Poly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quality">Quality</Label>
              <Select value={quality} onValueChange={(v: any) => setQuality(v)}>
                <SelectTrigger id="quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (Fast)</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="high">High (Slow)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seed">Seed (Optional)</Label>
              <Input
                id="seed"
                type="number"
                placeholder="Random"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full btn-glow" 
            disabled={isLoading || !prompt.trim()}
            size="lg"
          >
            {isLoading ? (
              <>
                <span className="animate-pulse">Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Model
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Generation typically takes 2-5 minutes depending on quality settings
          </p>
        </form>
      </CardContent>
    </Card>
  );
}