import { useState } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from './ui/card';
import { Upload, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';

interface ImageUploadFormProps {
  onSubmit: (request: { image_url: string }) => void;
  isLoading: boolean;
}

// Function to compress image to base64
const compressImageToBase64 = (file: File, maxWidth: number = 1024, maxHeight: number = 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with quality reduction
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export function ImageUploadForm({ onSubmit, isLoading }: ImageUploadFormProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl('');
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPreviewUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If we have a file, compress it to base64
    if (imageFile) {
      try {
        const compressedImage = await compressImageToBase64(imageFile);
        onSubmit({ image_url: compressedImage });
      } catch (error) {
        console.error('Error compressing image:', error);
        // Fallback to original file if compression fails
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            onSubmit({ image_url: event.target.result as string });
          }
        };
        reader.readAsDataURL(imageFile);
      }
      return;
    }
    
    // If we have a URL, use it directly
    if (imageUrl) {
      onSubmit({ image_url: imageUrl });
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setImageUrl(url);
    setImageFile(null);
    setPreviewUrl(url || null);
  };

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          Create 3D from Image
        </CardTitle>
        <CardDescription>
          Upload an image or provide a URL to generate a 3D model
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-upload">Upload Image</Label>
              <div className="flex items-center gap-4">
                <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-2">Upload</span>
                  <Input 
                    id="image-upload" 
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange}
                  />
                </label>
                
                {previewUrl && (
                  <div className="flex-1">
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="max-h-32 max-w-full object-contain rounded border"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-muted"></div>
              </div>
              {/* <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div> */}
            </div>

            {/* <div className="space-y-2">
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                placeholder="https://example.com/image.png"
                value={imageUrl}
                onChange={handleUrlChange}
                disabled={!!imageFile}
              />
            </div> */}
          </div>

          <Button 
            type="submit" 
            className="w-full btn-glow" 
            disabled={isLoading || (!imageUrl && !imageFile)}
            size="lg"
          >
            {isLoading ? (
              <>
                <span className="animate-pulse">Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate 3D Model
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Generation typically takes 2-5 minutes depending on image complexity
          </p>
        </form>
      </CardContent>
    </Card>
  );
}