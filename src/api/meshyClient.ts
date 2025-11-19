// Meshy API Client (v2) with typed DTOs and error normalization
// Docs: https://docs.meshy.ai/api/text-to-3d

export type TextTo3DMode = 'preview' | 'refine';
export type MeshyModel = 'meshy-4' | 'meshy-5' | 'meshy-5.1' | 'latest';

export interface CreateTextTo3DRequest {
  mode: TextTo3DMode;
  prompt?: string;
  preview_task_id?: string;
  art_style?: 'realistic' | 'sculpture';
  seed?: number;
  ai_model?: MeshyModel;
  topology?: 'quad' | 'triangle';
  target_polycount?: number;
  should_remesh?: boolean;
  symmetry_mode?: 'off' | 'auto' | 'on';
  is_a_t_pose?: boolean;
  moderation?: boolean;
  enable_pbr?: boolean;
  texture_prompt?: string;
  texture_image_url?: string;
}

export interface RefineTextTo3DRequest {
  preview_task_id: string;
  enable_pbr?: boolean;
  texture_prompt?: string;
}

export interface CreateImageTo3DRequest {
  image_url: string;
  enable_pbr?: boolean;
  should_remesh?: boolean;
  should_texture?: boolean;
}

export interface CreateImageTo3DResponse { result: string; }
export interface LegacyCreateTextTo3DRequest {
  prompt: string; style?: 'realistic'|'stylized'|'low-poly'; quality?: 'draft'|'standard'|'high'; seed?: number;
}
export interface CreateTextTo3DResponse { result: string; }
export interface LegacyCreateTextTo3DResponse { jobId: string; }

export type MeshyTaskStatus = 'PENDING'|'IN_PROGRESS'|'SUCCEEDED'|'FAILED';

export interface MeshyModelUrls { glb?: string; fbx?: string; obj?: string; mtl?: string; usdz?: string; }

export interface TextTo3DTask {
  id: string;
  status: MeshyTaskStatus;
  progress?: number;
  prompt?: string;
  art_style?: string;
  model_urls?: MeshyModelUrls;
  texture_urls?: Array<Record<string, string>>;
  thumbnail_url?: string;
  created_at?: number;
  started_at?: number;
  finished_at?: number;
  task_error?: { message?: string };
}

export interface ImageTo3DTask {
  id: string;
  status: MeshyTaskStatus;
  progress?: number;
  model_urls?: MeshyModelUrls;
  texture_urls?: Array<Record<string, string>>;
  thumbnail_url?: string;
  texture_prompt?: string;
  created_at?: number;
  started_at?: number;
  finished_at?: number;
  expires_at?: number;
  task_error?: { message?: string };
  preceding_tasks?: number;
}

export interface LegacyJobResponse {
  id: string;
  status: 'queued'|'running'|'succeeded'|'failed';
  progress?: number;
  assetUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  prompt?: string;
  createdAt?: string;
}

export interface MeshyError {
  message: string;
  status?: number;
  code?: string;
  subscriptionRequired?: boolean;
  upgradeUrl?: string;
}

const BASE_URL = import.meta.env.VITE_MESHY_BASE_URL || 'https://api.meshy.ai';
const USE_PROXY = import.meta.env.VITE_USE_PROXY === 'true';

const endpoint = (path: string): string => USE_PROXY ? `/api/meshy${path}` : `${BASE_URL}${path}`;

export const proxyAssetUrl = (url: string): string => {
  if (USE_PROXY && url?.startsWith('https://assets.meshy.ai/')) {
    return `/api/meshy/asset?url=${encodeURIComponent(url)}`;
  }
  return url;
};

const headers = (): HeadersInit => {
  if (USE_PROXY) return { 'Content-Type': 'application/json' };
  const apiKey = import.meta.env.VITE_MESHY_API_KEY;
  if (!apiKey) throw new Error('VITE_MESHY_API_KEY is not configured');
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const data = await res.json();
      msg = (data as any)?.error || (data as any)?.message || msg;
      if (msg.includes('NoMorePendingTasks') || msg.includes('free plan')) {
        throw <MeshyError>{ message: msg, status: res.status, subscriptionRequired: true, upgradeUrl: 'https://www.meshy.ai/settings/subscription' };
      }
    } catch {}
    throw <MeshyError>{ message: msg, status: res.status };
  }
  return res.json() as Promise<T>;
}

export async function createTextTo3D(req: CreateTextTo3DRequest): Promise<CreateTextTo3DResponse> {
  try {
    const requestWithModel = { ...req, ai_model: req.ai_model || 'meshy-5' };
    const res = await fetch(endpoint('/openapi/v2/text-to-3d'), { method: 'POST', headers: headers(), body: JSON.stringify(requestWithModel) });
    return handleResponse<CreateTextTo3DResponse>(res);
  } catch (e) {
    if ((e as MeshyError).status) throw e;
    throw <MeshyError>{ message: e instanceof Error ? e.message : 'Failed to create 3D model', status: 0 };
  }
}

export async function refineTextTo3D(req: RefineTextTo3DRequest): Promise<CreateTextTo3DResponse> {
  try {
    const body = { mode: 'refine', preview_task_id: req.preview_task_id, enable_pbr: req.enable_pbr ?? true, ...(req.texture_prompt ? { texture_prompt: req.texture_prompt } : {}) };
    const res = await fetch(endpoint('/openapi/v2/text-to-3d'), { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    return handleResponse<CreateTextTo3DResponse>(res);
  } catch (e) {
    if ((e as MeshyError).status) throw e;
    throw <MeshyError>{ message: e instanceof Error ? e.message : 'Failed to refine 3D model', status: 0 };
  }
}

export async function createImageTo3D(req: CreateImageTo3DRequest): Promise<CreateImageTo3DResponse> {
  try {
    const res = await fetch(endpoint('/openapi/v1/image-to-3d'), { method: 'POST', headers: headers(), body: JSON.stringify(req) });
    return handleResponse<CreateImageTo3DResponse>(res);
  } catch (e) {
    if ((e as MeshyError).status) throw e;
    throw <MeshyError>{ message: e instanceof Error ? e.message : 'Failed to create 3D model from image', status: 0 };
  }
}

export async function get3DTask(taskId: string): Promise<TextTo3DTask> {
  try {
    const res = await fetch(endpoint(`/openapi/v2/text-to-3d/${taskId}`), { method: 'GET', headers: headers() });
    return handleResponse<TextTo3DTask>(res);
  } catch (e) {
    if ((e as MeshyError).status) throw e;
    throw <MeshyError>{ message: e instanceof Error ? e.message : 'Failed to fetch 3D task', status: 0 };
  }
}

// --- SSE ---
export interface TaskUpdate {
  id: string;
  progress: number;
  status: MeshyTaskStatus;
  model_urls?: MeshyModelUrls;
  texture_urls?: Array<Record<string, string>>;
  created_at?: number;
  started_at?: number;
  finished_at?: number;
  task_error?: { message?: string };
  thumbnail_url?: string;
}
export interface TaskError { status_code: number; message: string; }

/**
 * Stream updates. Auto-closes on terminal states to prevent dangling streams.
 */
export function streamTextTo3DTask(
  taskId: string,
  onMessage: (update: TaskUpdate) => void,
  onError: (error: TaskError) => void,
): EventSource {
  const url = endpoint(`/openapi/v2/text-to-3d/${taskId}/stream`);
  const es = new EventSource(url);

  es.addEventListener('message', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as TaskUpdate;
      onMessage(data);
      if (data.status === 'SUCCEEDED' || data.status === 'FAILED') {
        // Important: stop streaming once done
        es.close();
      }
    } catch {
      /* ignore malformed chunks */
    }
  });

  es.addEventListener('error', () => {
    onError({ status_code: 500, message: 'Connection error' });
  });

  return es;
}

export async function getImageTo3DTask(taskId: string): Promise<ImageTo3DTask> {
  try {
    const res = await fetch(endpoint(`/openapi/v1/image-to-3d/${taskId}`), { method: 'GET', headers: headers() });
    return handleResponse<ImageTo3DTask>(res);
  } catch (e) {
    if ((e as MeshyError).status) throw e;
    throw <MeshyError>{ message: e instanceof Error ? e.message : 'Failed to fetch Image-to-3D task', status: 0 };
  }
}

export async function getTask(taskId: string): Promise<TextTo3DTask> { return get3DTask(taskId); }

export function downloadModel(url: string, filename = 'model.glb'): void {
  const downloadUrl = proxyAssetUrl(url);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export type { TextTo3DTask as JobResponse };
export { getTask as getJob };

// --- Rigging Interfaces ---
export interface CreateRiggingRequest {
  model_url?: string;
  input_task_id?: string;
  height_meters?: number;
}

export interface RiggingResult {
  rigged_character_fbx_url?: string;
  basic_animations?: {
    walking_glb_url?: string;
    walking_fbx_url?: string;
    walking_armature_glb_url?: string;
    running_glb_url?: string;
    running_fbx_url?: string;
    running_armature_glb_url?: string;
  };
}

export interface RiggingTask {
  id: string;
  status: MeshyTaskStatus;
  progress?: number;
  created_at?: number;
  started_at?: number;
  finished_at?: number;
  expires_at?: number;
  task_error?: { message?: string };
  result?: RiggingResult;
  preceding_tasks?: number;
}

// --- Animation Interfaces ---
export interface CreateAnimationRequest {
  rig_task_id: string;
  action_id: number;
  post_process?: {
    operation_type: 'change_fps';
    fps: 24 | 25 | 30 | 60;
  };
}

export interface AnimationResult {
  animation_glb_url?: string;
  animation_fbx_url?: string;
  processed_usdz_url?: string;
  processed_armature_fbx_url?: string;
  processed_animation_fps_fbx_url?: string;
}

export interface AnimationTask {
  id: string;
  status: MeshyTaskStatus;
  progress?: number;
  created_at?: number;
  started_at?: number;
  finished_at?: number;
  expires_at?: number;
  task_error?: { message?: string };
  result?: AnimationResult;
  preceding_tasks?: number;
}

// --- Rigging API Functions ---
export async function createRigging(req: CreateRiggingRequest): Promise<{ result: string }> {
  try {
    const res = await fetch(endpoint('/openapi/v1/rigging'), { 
      method: 'POST', 
      headers: headers(), 
      body: JSON.stringify(req) 
    });
    return handleResponse<{ result: string }>(res);
  } catch (e) {
    if ((e as MeshyError).status) throw e;
    throw <MeshyError>{ message: e instanceof Error ? e.message : 'Failed to create rigging task', status: 0 };
  }
}

export async function getRiggingTask(taskId: string): Promise<RiggingTask> {
  try {
    const res = await fetch(endpoint(`/openapi/v1/rigging/${taskId}`), { 
      method: 'GET', 
      headers: headers() 
    });
    return handleResponse<RiggingTask>(res);
  } catch (e) {
    if ((e as MeshyError).status) throw e;
    throw <MeshyError>{ message: e instanceof Error ? e.message : 'Failed to fetch rigging task', status: 0 };
  }
}

export async function deleteRiggingTask(taskId: string): Promise<void> {
  try {
    const res = await fetch(endpoint(`/openapi/v1/rigging/${taskId}`), { 
      method: 'DELETE', 
      headers: headers() 
    });
    if (!res.ok) {
      throw <MeshyError>{ message: `HTTP ${res.status}: ${res.statusText}`, status: res.status };
    }
  } catch (e) {
    if ((e as MeshyError).status) throw e;
    throw <MeshyError>{ message: e instanceof Error ? e.message : 'Failed to delete rigging task', status: 0 };
  }
}

// --- Animation API Functions ---
export async function createAnimation(req: CreateAnimationRequest): Promise<{ result: string }> {
  try {
    console.log('Creating animation with request:', req);
    const res = await fetch(endpoint('/openapi/v1/animations'), { 
      method: 'POST', 
      headers: headers(), 
      body: JSON.stringify(req) 
    });
    console.log('Animation API response status:', res.status);
    return handleResponse<{ result: string }>(res);
  } catch (e) {
    console.error('Animation API error:', e);
    if ((e as MeshyError).status) throw e;
    throw <MeshyError>{ message: e instanceof Error ? e.message : 'Failed to create animation task', status: 0 };
  }
}

export async function getAnimationTask(taskId: string): Promise<AnimationTask> {
  try {
    const res = await fetch(endpoint(`/openapi/v1/animations/${taskId}`), { 
      method: 'GET', 
      headers: headers() 
    });
    return handleResponse<AnimationTask>(res);
  } catch (e) {
    if ((e as MeshyError).status) throw e;
    throw <MeshyError>{ message: e instanceof Error ? e.message : 'Failed to fetch animation task', status: 0 };
  }
}

export async function deleteAnimationTask(taskId: string): Promise<void> {
  try {
    const res = await fetch(endpoint(`/openapi/v1/animations/${taskId}`), { 
      method: 'DELETE', 
      headers: headers() 
    });
    if (!res.ok) {
      throw <MeshyError>{ message: `HTTP ${res.status}: ${res.statusText}`, status: res.status };
    }
  } catch (e) {
    if ((e as MeshyError).status) throw e;
    throw <MeshyError>{ message: e instanceof Error ? e.message : 'Failed to delete animation task', status: 0 };
  }
}

// --- SSE for Rigging ---
export interface RiggingTaskUpdate extends RiggingTask {}
export interface AnimationTaskUpdate extends AnimationTask {}

/**
 * Stream rigging task updates. Auto-closes on terminal states.
 */
export function streamRiggingTask(
  taskId: string,
  onMessage: (update: RiggingTaskUpdate) => void,
  onError: (error: TaskError) => void,
): EventSource {
  const url = endpoint(`/openapi/v1/rigging/${taskId}/stream`);
  const es = new EventSource(url);

  es.addEventListener('message', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as RiggingTaskUpdate;
      onMessage(data);
      if (data.status === 'SUCCEEDED' || data.status === 'FAILED') {
        es.close();
      }
    } catch {
      /* ignore malformed chunks */
    }
  });

  es.addEventListener('error', () => {
    onError({ status_code: 500, message: 'Connection error' });
  });

  return es;
}

/**
 * Stream animation task updates. Auto-closes on terminal states.
 */
export function streamAnimationTask(
  taskId: string,
  onMessage: (update: AnimationTaskUpdate) => void,
  onError: (error: TaskError) => void,
): EventSource {
  const url = endpoint(`/openapi/v1/animations/${taskId}/stream`);
  const es = new EventSource(url);

  es.addEventListener('message', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as AnimationTaskUpdate;
      console.log('Animation SSE update:', data); // Add logging to see what we're getting
      onMessage(data);
      if (data.status === 'SUCCEEDED' || data.status === 'FAILED') {
        es.close();
      }
    } catch (e) {
      console.error('Failed to parse animation SSE message:', e);
      /* ignore malformed chunks */
    }
  });

  es.addEventListener('error', () => {
    onError({ status_code: 500, message: 'Connection error' });
  });

  return es;
}
