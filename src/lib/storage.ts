import { LegacyJobResponse } from '@/api/meshyClient';

export interface StoredJob {
  id: string;
  prompt: string;
  status: LegacyJobResponse['status'];
  assetUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  createdAt: string;
  name?: string;
  // Note: style and quality are not part of the new API but kept for backward compatibility
  style?: string;
  quality?: string;
  // Add type to distinguish between 3D models and images
  type?: '3d' | 'image';
  // Add progress for real-time updates
  progress?: number;
  // Add rigging and animation task IDs
  riggingTaskId?: string;
  animationTaskId?: string;
  // Add URLs for rigged character and animations
  riggedCharacterUrl?: string;
  walkingAnimationUrl?: string;
  runningAnimationUrl?: string;
  customAnimationUrl?: string;
}

const STORAGE_KEY = 'meshy_jobs';

export function getJobs(): StoredJob[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load jobs from storage:', error);
    return [];
  }
}

export function saveJob(job: StoredJob): void {
  try {
    const jobs = getJobs();
    const existingIndex = jobs.findIndex(j => j.id === job.id);
    
    if (existingIndex >= 0) {
      jobs[existingIndex] = job;
    } else {
      jobs.unshift(job); // Add to beginning
    }
    
    // Keep only last 20 jobs
    const trimmed = jobs.slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save job to storage:', error);
  }
}

export function updateJob(id: string, updates: Partial<StoredJob>): void {
  try {
    const jobs = getJobs();
    const job = jobs.find(j => j.id === id);
    
    if (job) {
      Object.assign(job, updates);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    }
  } catch (error) {
    console.error('Failed to update job in storage:', error);
  }
}

export function deleteJob(id: string): void {
  try {
    const jobs = getJobs().filter(j => j.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch (error) {
    console.error('Failed to delete job from storage:', error);
  }
}